package com.pesito.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pesito.ai.model.ChatMemory;
import com.pesito.ai.rag.embedding.EmbeddingStrategy;
import com.pesito.ai.rag.embedding.EmbeddingStrategyResolver;
import com.pesito.ai.repository.ChatMemoryRepository;
import com.pesito.ai.tool.ToolCall;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Memoria semántica de largo plazo del agente.
 *
 * Guardado: cada mensaje relevante del chat se embebe con la API de embeddings
 * del proveedor activo del usuario (OpenAI o Gemini, vía patrón Strategy) y se
 * persiste en MongoDB (colección chat_memories) tagueado con el proveedor.
 *
 * Recuperación (tool search_conversation_history): similitud de coseno
 * calculada en Java, solo entre vectores del mismo proveedor. Si el proveedor
 * activo no soporta embeddings (Claude) o los documentos están pausados,
 * degrada a búsqueda por palabras clave — sin consumo de tokens.
 */
@Service
public class ChatMemoryService {

    private static final Logger log = LoggerFactory.getLogger(ChatMemoryService.class);

    private static final int MIN_CONTENT_LENGTH = 25;
    private static final int MAX_MEMORIES_PER_USER = 1000;
    private static final int TOP_K = 5;
    private static final double MIN_COSINE_SCORE = 0.3;

    private static final Pattern TRIVIAL_PATTERN = Pattern.compile(
            "(?i)^\\s*(hola|buenas|buen día|buen dia|buenos días|buenos dias|gracias|ok|oka|dale|listo|genial|perfecto|sí|si|no|chau|adiós|adios)[!.\\s]*$");

    private final ChatMemoryRepository repo;
    private final EmbeddingStrategyResolver embeddings;
    private final UserProfileService userProfileService;
    private final ObjectMapper mapper;

    public ChatMemoryService(ChatMemoryRepository repo, EmbeddingStrategyResolver embeddings,
                             UserProfileService userProfileService, ObjectMapper mapper) {
        this.repo = repo;
        this.embeddings = embeddings;
        this.userProfileService = userProfileService;
        this.mapper = mapper;
    }

    // ── Guardado (asíncrono, best-effort) ────────────────────────────────────

    /**
     * Persiste un mensaje del chat como memoria de largo plazo, embebido con
     * el proveedor activo si soporta embeddings y los documentos no están
     * pausados. Nunca bloquea ni afecta la respuesta del chat.
     */
    @Async
    public void remember(String userId, String sessionId, String role, String content,
                         String provider, String apiKey) {
        if (userId == null || userId.isBlank() || content == null) return;
        try {
            String trimmed = content.trim();
            if (trimmed.length() < MIN_CONTENT_LENGTH) return;
            if (TRIVIAL_PATTERN.matcher(trimmed).matches()) return;
            if (trimmed.startsWith("[")) return; // contexto inyectado, no diálogo real

            String hash = md5(userId + ":" + trimmed);
            if (repo.existsByUserIdAndContentHash(userId, hash)) return;

            float[] embedding = null;
            String embeddingProvider = null;
            Optional<EmbeddingStrategy> strategy = embeddings.forProvider(provider);
            if (strategy.isPresent() && apiKey != null && !apiKey.isBlank()
                    && !userProfileService.isDocumentsPaused(userId)) {
                try {
                    embedding = strategy.get().embedOne(trimmed, apiKey);
                    embeddingProvider = strategy.get().provider();
                } catch (Exception e) {
                    log.warn("[MEMORY] embedding falló para userId={}: {} — se guarda sin vector", userId, e.getMessage());
                }
            }

            repo.save(new ChatMemory(userId, sessionId, role, trimmed, hash, embedding, embeddingProvider));
            log.debug("[MEMORY] guardado userId={} role={} provider={} len={}",
                    userId, role, embeddingProvider, trimmed.length());

            enforceCap(userId);
        } catch (Exception e) {
            log.warn("[MEMORY] no se pudo guardar memoria de userId={}: {}", userId, e.getMessage());
        }
    }

    private void enforceCap(String userId) {
        if (repo.countByUserId(userId) > MAX_MEMORIES_PER_USER) {
            repo.deleteAll(repo.findTop100ByUserIdOrderByCreatedAtAsc(userId));
        }
    }

    // ── Recuperación (tool search_conversation_history) ──────────────────────

    /**
     * Ejecuta la tool search_conversation_history y devuelve JSON listo para
     * inyectarse como tool_result. Vector si el proveedor activo soporta
     * embeddings; keyword en cualquier otro caso (sin tokens).
     */
    public String executeTool(String userId, ToolCall call, String provider, String apiKey) {
        try {
            String query = call.arguments() != null ? call.arguments().path("query").asText("") : "";
            if (query.isBlank()) {
                return errorJson("Falta el parámetro 'query'.");
            }

            List<ChatMemory> corpus = repo.findTop500ByUserIdOrderByCreatedAtDesc(userId);
            Optional<EmbeddingStrategy> strategy = embeddings.forProvider(provider);
            boolean canEmbed = strategy.isPresent() && apiKey != null && !apiKey.isBlank()
                    && !userProfileService.isDocumentsPaused(userId);

            List<Scored> matches = canEmbed
                    ? searchVector(query, corpus, strategy.get(), apiKey)
                    : searchKeyword(query, corpus);

            ObjectNode result = mapper.createObjectNode();
            ArrayNode arr = result.putArray("results");
            for (Scored match : matches) {
                ObjectNode node = arr.addObject();
                node.put("role", match.memory().getRole());
                node.put("content", match.memory().getContent());
                node.put("date", match.memory().getCreatedAt() != null
                        ? match.memory().getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)
                        : "");
                node.put("score", Math.round(match.score() * 100.0) / 100.0);
            }
            result.put("count", matches.size());
            if (matches.isEmpty()) {
                result.put("note", "Sin recuerdos relevantes en conversaciones pasadas.");
            }
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            return errorJson("Error ejecutando search_conversation_history: " + e.getMessage());
        }
    }

    // ── Migración de proveedor (Caso B: cambio openai ↔ gemini) ──────────────

    /**
     * Re-embebe todas las memorias del usuario con el proveedor nuevo. Se usa
     * cuando el usuario cambia entre proveedores con espacios vectoriales
     * incompatibles y elige "Actualizar mis documentos".
     */
    public int reembedAll(String userId, String provider, String apiKey) {
        EmbeddingStrategy strategy = embeddings.forProvider(provider)
                .orElseThrow(() -> new IllegalArgumentException("El proveedor " + provider + " no soporta embeddings."));

        List<ChatMemory> memories = repo.findTop500ByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(m -> !strategy.provider().equals(m.getEmbeddingProvider()))
                .toList();
        if (memories.isEmpty()) return 0;

        List<String> texts = memories.stream().map(ChatMemory::getContent).toList();
        List<float[]> vectors = strategy.embed(texts, apiKey);
        for (int i = 0; i < memories.size(); i++) {
            memories.get(i).setEmbedding(vectors.get(i));
            memories.get(i).setEmbeddingProvider(strategy.provider());
        }
        repo.saveAll(memories);
        log.info("[MEMORY] re-embebidas {} memorias de userId={} con provider={}",
                memories.size(), userId, strategy.provider());
        return memories.size();
    }

    private record Scored(ChatMemory memory, double score) {
    }

    private List<Scored> searchVector(String query, List<ChatMemory> corpus,
                                      EmbeddingStrategy strategy, String apiKey) {
        float[] queryEmbedding;
        try {
            queryEmbedding = strategy.embedOne(query, apiKey);
        } catch (Exception e) {
            log.warn("[MEMORY] embedding de la query falló: {} — fallback a keyword", e.getMessage());
            return searchKeyword(query, corpus);
        }

        List<Scored> scored = new ArrayList<>();
        for (ChatMemory memory : corpus) {
            // Solo comparar vectores del mismo proveedor: espacios incompatibles.
            if (memory.getEmbedding() == null || !strategy.provider().equals(memory.getEmbeddingProvider())) {
                continue;
            }
            double score = cosineSimilarity(queryEmbedding, memory.getEmbedding());
            if (score >= MIN_COSINE_SCORE) {
                scored.add(new Scored(memory, score));
            }
        }
        // Si ninguna memoria tiene vectores del proveedor activo (cambio reciente
        // de proveedor sin migrar), degradar a keyword para no perder recuerdos.
        if (scored.isEmpty()) {
            List<Scored> keyword = searchKeyword(query, corpus);
            if (!keyword.isEmpty()) return keyword;
        }
        scored.sort(Comparator.comparingDouble(Scored::score).reversed());
        return scored.stream().limit(TOP_K).toList();
    }

    private List<Scored> searchKeyword(String query, List<ChatMemory> corpus) {
        String[] words = query.toLowerCase().split("\\s+");
        List<Scored> scored = new ArrayList<>();
        for (ChatMemory memory : corpus) {
            String lower = memory.getContent().toLowerCase();
            int score = 0;
            for (String word : words) {
                if (word.length() > 2 && lower.contains(word)) score++;
            }
            if (score > 0) scored.add(new Scored(memory, score));
        }
        scored.sort(Comparator.comparingDouble(Scored::score).reversed());
        return scored.stream().limit(TOP_K).toList();
    }

    /** Similitud de coseno calculada en Java: dot(a,b) / (||a|| * ||b||). */
    static double cosineSimilarity(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) return 0;
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0 || normB == 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private String md5(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String errorJson(String message) {
        ObjectNode node = mapper.createObjectNode();
        node.put("error", message);
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            return "{\"error\":\"" + message.replace("\"", "'") + "\"}";
        }
    }
}

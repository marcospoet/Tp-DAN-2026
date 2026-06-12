package com.pesito.ai.rag;

import com.pesito.ai.rag.embedding.EmbeddingStrategy;
import com.pesito.ai.rag.embedding.EmbeddingStrategyResolver;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Orquesta la indexación (lazy, con detección de cambios via MD5) y la búsqueda
 * sobre la knowledge base.
 *
 * Estrategia de búsqueda según el proveedor activo del usuario (patrón Strategy):
 *   - openai / gemini → embeddings nativos del proveedor con la key del usuario,
 *     búsqueda vectorial (coseno) en pgvector filtrada por proveedor.
 *   - claude (sin API de embeddings) → búsqueda keyword en memoria.
 */
@Service
public class RagService {

    private final KnowledgeBaseLoader loader;
    private final TextChunker chunker;
    private final EmbeddingStrategyResolver embeddings;
    private final KnowledgeChunkRepository repository;

    public RagService(KnowledgeBaseLoader loader, TextChunker chunker,
                       EmbeddingStrategyResolver embeddings, KnowledgeChunkRepository repository) {
        this.loader = loader;
        this.chunker = chunker;
        this.embeddings = embeddings;
        this.repository = repository;
    }

    /**
     * Búsqueda vectorial con los embeddings del proveedor activo. Si el
     * proveedor no soporta embeddings, devuelve empty y el llamador degrada
     * a {@link #searchText}.
     */
    public Optional<List<RetrievedChunk>> search(String query, String provider, String apiKey, int topK) {
        return embeddings.forProvider(provider).map(strategy -> {
            ensureIndexed(strategy, apiKey);
            float[] queryEmbedding = strategy.embedOne(query, apiKey);
            return repository.searchSimilar(queryEmbedding, strategy.provider(), topK);
        });
    }

    /**
     * Reindexa los documentos de la knowledge base para el proveedor dado,
     * solo si el contenido cambió desde la última indexación (hash MD5).
     */
    public void ensureIndexed(EmbeddingStrategy strategy, String apiKey) {
        String provider = strategy.provider();
        for (KnowledgeSource source : loader.load()) {
            String hash = md5(source.content());
            if (repository.findHash(source.name(), provider).map(hash::equals).orElse(false)) {
                continue;
            }
            repository.deleteChunks(source.name(), provider);
            List<String> chunks = chunker.chunk(source.content());
            if (!chunks.isEmpty()) {
                List<float[]> vectors = strategy.embed(chunks, apiKey);
                for (int i = 0; i < chunks.size(); i++) {
                    repository.insertChunk(source.name(), provider, i, chunks.get(i), vectors.get(i));
                }
            }
            repository.upsertHash(source.name(), provider, hash);
        }
    }

    /**
     * Búsqueda keyword en memoria — para proveedores sin API de embeddings
     * (Claude) o cuando los documentos están pausados.
     */
    public List<RetrievedChunk> searchText(String query, int topK) {
        record Scored(String source, String content, int score) {}
        String[] words = query.toLowerCase().split("\\s+");

        List<Scored> candidates = new ArrayList<>();
        for (KnowledgeSource source : loader.load()) {
            for (String chunk : chunker.chunk(source.content())) {
                String lower = chunk.toLowerCase();
                int score = 0;
                for (String word : words) {
                    if (word.length() > 2 && lower.contains(word)) score++;
                }
                if (score > 0) candidates.add(new Scored(source.name(), chunk, score));
            }
        }

        candidates.sort((a, b) -> Integer.compare(b.score(), a.score()));
        return candidates.stream()
                .limit(topK)
                .map(s -> new RetrievedChunk(s.source(), s.content()))
                .collect(Collectors.toList());
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
}

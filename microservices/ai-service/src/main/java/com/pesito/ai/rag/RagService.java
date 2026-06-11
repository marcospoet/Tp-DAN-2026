package com.pesito.ai.rag;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Orquesta la indexación (lazy, con detección de cambios via MD5) y la
 * búsqueda por similitud de coseno sobre la knowledge base en pgvector.
 */
@Service
public class RagService {

    private final KnowledgeBaseLoader loader;
    private final TextChunker chunker;
    private final EmbeddingService embeddingService;
    private final KnowledgeChunkRepository repository;

    public RagService(KnowledgeBaseLoader loader, TextChunker chunker,
                       EmbeddingService embeddingService, KnowledgeChunkRepository repository) {
        this.loader = loader;
        this.chunker = chunker;
        this.embeddingService = embeddingService;
        this.repository = repository;
    }

    /**
     * Reindexa los documentos de la knowledge base cuyo contenido cambió desde
     * la última indexación (o que nunca se indexaron).
     */
    public void ensureIndexed(String embeddingApiKey) {
        for (KnowledgeSource source : loader.load()) {
            String hash = md5(source.content());
            if (repository.findHash(source.name()).map(hash::equals).orElse(false)) {
                continue;
            }
            repository.deleteChunks(source.name());
            List<String> chunks = chunker.chunk(source.content());
            if (!chunks.isEmpty()) {
                List<float[]> embeddings = embeddingService.embed(chunks, embeddingApiKey);
                for (int i = 0; i < chunks.size(); i++) {
                    repository.insertChunk(source.name(), i, chunks.get(i), embeddings.get(i));
                }
            }
            repository.upsertHash(source.name(), hash);
        }
    }

    public List<RetrievedChunk> search(String query, String embeddingApiKey, int topK) {
        ensureIndexed(embeddingApiKey);
        float[] queryEmbedding = embeddingService.embedOne(query, embeddingApiKey);
        return repository.searchSimilar(queryEmbedding, topK);
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

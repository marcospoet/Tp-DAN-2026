package com.pesito.ai.service;

import com.pesito.ai.rag.RagService;
import com.pesito.ai.rag.embedding.EmbeddingStrategy;
import com.pesito.ai.rag.embedding.EmbeddingStrategyResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Migración de embeddings al cambiar entre proveedores incompatibles
 * (Caso B: openai ↔ gemini). El usuario eligió "Actualizar mis documentos":
 * se reindexa la knowledge base con el proveedor nuevo, se re-embeben sus
 * memorias de chat y el perfil, y se despausan los documentos.
 *
 * Asíncrona: el endpoint devuelve 202 y el procesamiento corre en background
 * consumiendo saldo de la cuenta nueva del usuario.
 */
@Service
public class EmbeddingMigrationService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingMigrationService.class);

    private final EmbeddingStrategyResolver embeddings;
    private final RagService ragService;
    private final ChatMemoryService chatMemoryService;
    private final UserProfileService userProfileService;

    public EmbeddingMigrationService(EmbeddingStrategyResolver embeddings, RagService ragService,
                                     ChatMemoryService chatMemoryService, UserProfileService userProfileService) {
        this.embeddings = embeddings;
        this.ragService = ragService;
        this.chatMemoryService = chatMemoryService;
        this.userProfileService = userProfileService;
    }

    @Async
    public void migrate(String userId, String provider, String apiKey) {
        try {
            EmbeddingStrategy strategy = embeddings.forProvider(provider).orElseThrow(() ->
                    new IllegalArgumentException("El proveedor " + provider + " no soporta embeddings."));

            log.info("[MIGRATION] inicio userId={} provider={}", userId, provider);
            ragService.ensureIndexed(strategy, apiKey);
            int memories = chatMemoryService.reembedAll(userId, provider, apiKey);
            userProfileService.reembedSummary(userId, provider, apiKey);
            userProfileService.setDocumentsPaused(userId, false);
            log.info("[MIGRATION] completada userId={} provider={} memoriasReembebidas={}",
                    userId, provider, memories);
        } catch (Exception e) {
            log.error("[MIGRATION] falló para userId={} provider={}: {}", userId, provider, e.getMessage());
        }
    }
}

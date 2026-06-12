package com.pesito.ai.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Memoria semántica de largo plazo: cada mensaje relevante del chat se guarda
 * embebido (1536 dims, con la API de embeddings del proveedor activo del
 * usuario) como array de floats en MongoDB. La recuperación se hace por
 * similitud de coseno calculada en Java (tool search_conversation_history),
 * lo que permite responder referencias a conversaciones de semanas atrás que
 * ya salieron de la ventana de 40 turnos.
 */
@Document(collection = "chat_memories")
public class ChatMemory {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String sessionId;
    private String role;              // "user" | "assistant"
    private String content;
    private String contentHash;       // MD5 de userId+content, para deduplicar
    private float[] embedding;        // null si el proveedor activo no soporta embeddings (Claude)
    private String embeddingProvider; // "openai" | "gemini" — vectores de distintos proveedores no son comparables
    private LocalDateTime createdAt;

    public ChatMemory() {
    }

    public ChatMemory(String userId, String sessionId, String role, String content,
                      String contentHash, float[] embedding, String embeddingProvider) {
        this.userId = userId;
        this.sessionId = sessionId;
        this.role = role;
        this.content = content;
        this.contentHash = contentHash;
        this.embedding = embedding;
        this.embeddingProvider = embeddingProvider;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getContentHash() { return contentHash; }
    public void setContentHash(String contentHash) { this.contentHash = contentHash; }

    public float[] getEmbedding() { return embedding; }
    public void setEmbedding(float[] embedding) { this.embedding = embedding; }

    public String getEmbeddingProvider() { return embeddingProvider; }
    public void setEmbeddingProvider(String embeddingProvider) { this.embeddingProvider = embeddingProvider; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

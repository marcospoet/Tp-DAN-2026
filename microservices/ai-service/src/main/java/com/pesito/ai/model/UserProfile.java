package com.pesito.ai.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Perfil de largo plazo del usuario, persistido entre sesiones de chat.
 * Se actualiza de forma asincrónica a partir del contexto financiero de cada
 * conversación y se inyecta como nota en el system prompt de los chats
 * siguientes (memoria que sobrevive al límite de 40 turnos de ChatSession).
 */
@Document(collection = "agent_profiles")
public class UserProfile {

    @Id
    private String userId;

    private String topCategory;
    private LocalDateTime updatedAt;

    // Perfil financiero semántico: resumen en texto generado por LLM a partir
    // de los resúmenes mensuales, embebido para búsqueda semántica.
    private String summary;
    private float[] summaryEmbedding;
    private String summaryEmbeddingProvider; // "openai" | "gemini"
    private LocalDateTime summaryGeneratedAt;

    // Caso B del cambio de proveedor: el usuario eligió "Solo chatear" — las
    // búsquedas semánticas degradan a keyword hasta que migre sus documentos.
    private boolean documentsPaused;

    public UserProfile() {
    }

    public UserProfile(String userId, String topCategory) {
        this.userId = userId;
        this.topCategory = topCategory;
        this.updatedAt = LocalDateTime.now();
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTopCategory() { return topCategory; }
    public void setTopCategory(String topCategory) { this.topCategory = topCategory; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public float[] getSummaryEmbedding() { return summaryEmbedding; }
    public void setSummaryEmbedding(float[] summaryEmbedding) { this.summaryEmbedding = summaryEmbedding; }

    public String getSummaryEmbeddingProvider() { return summaryEmbeddingProvider; }
    public void setSummaryEmbeddingProvider(String summaryEmbeddingProvider) { this.summaryEmbeddingProvider = summaryEmbeddingProvider; }

    public boolean isDocumentsPaused() { return documentsPaused; }
    public void setDocumentsPaused(boolean documentsPaused) { this.documentsPaused = documentsPaused; }

    public LocalDateTime getSummaryGeneratedAt() { return summaryGeneratedAt; }
    public void setSummaryGeneratedAt(LocalDateTime summaryGeneratedAt) { this.summaryGeneratedAt = summaryGeneratedAt; }
}

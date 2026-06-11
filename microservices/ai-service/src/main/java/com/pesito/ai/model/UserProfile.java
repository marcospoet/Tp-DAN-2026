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
}

package com.pesito.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public class ChatRequest {

    private String userId;

    @Size(max = 100, message = "sessionId inválido.")
    private String sessionId;

    @NotBlank(message = "El mensaje no puede estar vacío.")
    @Size(max = 2000, message = "El mensaje no puede superar los 2000 caracteres.")
    private String message;

    @Size(max = 100_000, message = "El contexto financiero es demasiado grande.")
    private String financialContext = "";

    @Size(max = 50, message = "El historial no puede superar los 50 mensajes.")
    private List<ChatTurnDto> history;

    @Size(max = 20)
    private String provider;

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getFinancialContext() { return financialContext; }
    public void setFinancialContext(String financialContext) { this.financialContext = financialContext; }

    public List<ChatTurnDto> getHistory() { return history; }
    public void setHistory(List<ChatTurnDto> history) { this.history = history; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}

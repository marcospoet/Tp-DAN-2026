package com.pesito.ai.dto;

import java.util.List;

public class ChatRequest {

    private String userId;
    private String sessionId;
    private String message;
    private String financialContext = "";
    private List<ChatTurnDto> history;
    private String provider;
    private String apiKey;

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

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}

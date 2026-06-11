package com.pesito.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    private String provider = "claude";
    private String claudeApiKey = "";
    private String openaiApiKey = "";
    private String geminiApiKey = "";
    private String transactionServiceBaseUrl = "http://localhost:8082";
    private boolean toolsEnabled = true;

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getClaudeApiKey() { return claudeApiKey; }
    public void setClaudeApiKey(String claudeApiKey) { this.claudeApiKey = claudeApiKey; }

    public String getOpenaiApiKey() { return openaiApiKey; }
    public void setOpenaiApiKey(String openaiApiKey) { this.openaiApiKey = openaiApiKey; }

    public String getGeminiApiKey() { return geminiApiKey; }
    public void setGeminiApiKey(String geminiApiKey) { this.geminiApiKey = geminiApiKey; }

    public String getTransactionServiceBaseUrl() { return transactionServiceBaseUrl; }
    public void setTransactionServiceBaseUrl(String transactionServiceBaseUrl) { this.transactionServiceBaseUrl = transactionServiceBaseUrl; }

    public boolean isToolsEnabled() { return toolsEnabled; }
    public void setToolsEnabled(boolean toolsEnabled) { this.toolsEnabled = toolsEnabled; }

    public String getActiveApiKey() {
        return switch (provider.toLowerCase()) {
            case "openai" -> openaiApiKey;
            case "gemini" -> geminiApiKey;
            default -> claudeApiKey;
        };
    }
}

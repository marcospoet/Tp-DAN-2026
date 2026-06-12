package com.pesito.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    private String transactionServiceBaseUrl = "http://localhost:8082";
    private String authServiceBaseUrl = "http://localhost:8081";
    private String internalApiSecret = "";
    private boolean toolsEnabled = true;
    private String langfusePublicKey = "";
    private String langfuseSecretKey = "";
    private String langfuseHost = "https://cloud.langfuse.com";

    public String getTransactionServiceBaseUrl() { return transactionServiceBaseUrl; }
    public void setTransactionServiceBaseUrl(String transactionServiceBaseUrl) { this.transactionServiceBaseUrl = transactionServiceBaseUrl; }

    public String getAuthServiceBaseUrl() { return authServiceBaseUrl; }
    public void setAuthServiceBaseUrl(String authServiceBaseUrl) { this.authServiceBaseUrl = authServiceBaseUrl; }

    public String getInternalApiSecret() { return internalApiSecret; }
    public void setInternalApiSecret(String internalApiSecret) { this.internalApiSecret = internalApiSecret; }

    public boolean isToolsEnabled() { return toolsEnabled; }
    public void setToolsEnabled(boolean toolsEnabled) { this.toolsEnabled = toolsEnabled; }

    public String getLangfusePublicKey() { return langfusePublicKey; }
    public void setLangfusePublicKey(String langfusePublicKey) { this.langfusePublicKey = langfusePublicKey; }

    public String getLangfuseSecretKey() { return langfuseSecretKey; }
    public void setLangfuseSecretKey(String langfuseSecretKey) { this.langfuseSecretKey = langfuseSecretKey; }

    public String getLangfuseHost() { return langfuseHost; }
    public void setLangfuseHost(String langfuseHost) { this.langfuseHost = langfuseHost; }
}

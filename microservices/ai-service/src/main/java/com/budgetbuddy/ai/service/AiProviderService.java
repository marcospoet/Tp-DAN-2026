package com.budgetbuddy.ai.service;

import com.budgetbuddy.ai.config.AiProperties;
import com.budgetbuddy.ai.dto.ChatTurnDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;

/**
 * Centraliza las llamadas a los proveedores de IA (Claude, OpenAI, Gemini).
 * Las API keys se gestionan server-side via variables de entorno.
 * El frontend NO maneja claves desde Fase B.
 */
@Service
public class AiProviderService {

    private static final String CLAUDE_URL = "https://api.anthropic.com/v1/messages";
    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    private static final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    private final WebClient webClient;
    private final AiProperties props;
    private final ObjectMapper mapper;

    public AiProviderService(WebClient webClient, AiProperties props) {
        this.webClient = webClient;
        this.props = props;
        this.mapper = new ObjectMapper();
    }

    // ── Provider / key resolution ─────────────────────────────────────────────

    private String resolveProvider(String override) {
        return (override != null && !override.isBlank()) ? override.toLowerCase() : props.getProvider().toLowerCase();
    }

    private String resolveKey(String provider, String override) {
        if (override != null && !override.isBlank()) return override;
        return switch (provider) {
            case "openai" -> props.getOpenaiApiKey();
            case "gemini" -> props.getGeminiApiKey();
            default -> props.getClaudeApiKey();
        };
    }

    /**
     * Single-turn call for transaction parsing and intent detection.
     * Returns the raw AI text response; parsing is done by the caller.
     */
    public String callSingleTurn(String systemPrompt, String userMessage) {
        return callSingleTurn(systemPrompt, userMessage, null, null, null, null);
    }

    /**
     * Single-turn call with optional image attachment.
     */
    public String callSingleTurn(String systemPrompt, String userMessage, String imageBase64, String imageMimeType) {
        return callSingleTurn(systemPrompt, userMessage, imageBase64, imageMimeType, null, null);
    }

    /**
     * Single-turn call with optional image and provider/key overrides.
     * If providerOverride or apiKeyOverride are blank, falls back to env-var config.
     */
    public String callSingleTurn(String systemPrompt, String userMessage, String imageBase64, String imageMimeType,
                                 String providerOverride, String apiKeyOverride) {
        String p = resolveProvider(providerOverride);
        String k = resolveKey(p, apiKeyOverride);
        return switch (p) {
            case "openai" -> callOpenAI(systemPrompt, userMessage, imageBase64, imageMimeType, k);
            case "gemini" -> callGemini(systemPrompt, userMessage, imageBase64, imageMimeType, k);
            default -> callClaude(systemPrompt, userMessage, imageBase64, imageMimeType, k);
        };
    }

    /**
     * Multi-turn chat call. history = all turns including the current user message.
     */
    public String callChat(String systemPrompt, List<ChatTurnDto> history) {
        return callChat(systemPrompt, history, null, null);
    }

    /**
     * Multi-turn chat call with optional provider/key overrides.
     */
    public String callChat(String systemPrompt, List<ChatTurnDto> history,
                           String providerOverride, String apiKeyOverride) {
        String p = resolveProvider(providerOverride);
        String k = resolveKey(p, apiKeyOverride);
        return switch (p) {
            case "openai" -> callOpenAIChat(systemPrompt, history, k);
            case "gemini" -> callGeminiChat(systemPrompt, history, k);
            default -> callClaudeChat(systemPrompt, history, k);
        };
    }

    // ── Claude ────────────────────────────────────────────────────────────────

    private String callClaude(String systemPrompt, String userMessage, String imageBase64, String mimeType, String apiKey) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", "claude-3-5-haiku-20241022");
            body.put("max_tokens", 400);
            body.put("system", systemPrompt);

            ArrayNode messages = mapper.createArrayNode();
            ObjectNode userMsg = mapper.createObjectNode();
            userMsg.put("role", "user");

            if (imageBase64 != null && !imageBase64.isBlank()) {
                ArrayNode content = mapper.createArrayNode();
                ObjectNode imgBlock = mapper.createObjectNode();
                imgBlock.put("type", "image");
                ObjectNode source = mapper.createObjectNode();
                source.put("type", "base64");
                source.put("media_type", mimeType != null ? mimeType : "image/jpeg");
                source.put("data", imageBase64);
                imgBlock.set("source", source);
                content.add(imgBlock);
                ObjectNode textBlock = mapper.createObjectNode();
                textBlock.put("type", "text");
                textBlock.put("text", userMessage);
                content.add(textBlock);
                userMsg.set("content", content);
            } else {
                userMsg.put("content", userMessage);
            }

            messages.add(userMsg);
            body.set("messages", messages);

            String response = webClient.post()
                    .uri(CLAUDE_URL)
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("content").get(0).path("text").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error Claude " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error llamando a Claude: " + e.getMessage());
        }
    }

    private String callClaudeChat(String systemPrompt, List<ChatTurnDto> history, String apiKey) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", "claude-3-5-haiku-20241022");
            body.put("max_tokens", 300);
            body.put("system", systemPrompt);

            ArrayNode messages = mapper.createArrayNode();
            for (ChatTurnDto turn : history) {
                ObjectNode msg = mapper.createObjectNode();
                msg.put("role", turn.getRole());
                msg.put("content", turn.getText() != null ? turn.getText() : "");
                messages.add(msg);
            }
            body.set("messages", messages);

            String response = webClient.post()
                    .uri(CLAUDE_URL)
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("content").get(0).path("text").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error Claude chat " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error llamando a Claude chat: " + e.getMessage());
        }
    }

    // ── OpenAI ────────────────────────────────────────────────────────────────

    private String callOpenAI(String systemPrompt, String userMessage, String imageBase64, String mimeType, String apiKey) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", "gpt-4o-mini");
            body.put("max_tokens", 400);
            body.put("temperature", 0.1);

            ArrayNode messages = mapper.createArrayNode();
            ObjectNode sysMsg = mapper.createObjectNode();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);
            messages.add(sysMsg);

            ObjectNode userMsg = mapper.createObjectNode();
            userMsg.put("role", "user");

            if (imageBase64 != null && !imageBase64.isBlank()) {
                ArrayNode content = mapper.createArrayNode();
                ObjectNode imgBlock = mapper.createObjectNode();
                imgBlock.put("type", "image_url");
                ObjectNode imgUrl = mapper.createObjectNode();
                imgUrl.put("url", "data:" + (mimeType != null ? mimeType : "image/jpeg") + ";base64," + imageBase64);
                imgBlock.set("image_url", imgUrl);
                content.add(imgBlock);
                ObjectNode textBlock = mapper.createObjectNode();
                textBlock.put("type", "text");
                textBlock.put("text", userMessage);
                content.add(textBlock);
                userMsg.set("content", content);
            } else {
                userMsg.put("content", userMessage);
            }

            messages.add(userMsg);
            body.set("messages", messages);

            String response = webClient.post()
                    .uri(OPENAI_URL)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("choices").get(0).path("message").path("content").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error OpenAI " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error llamando a OpenAI: " + e.getMessage());
        }
    }

    private String callOpenAIChat(String systemPrompt, List<ChatTurnDto> history, String apiKey) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", "gpt-4o-mini");
            body.put("max_tokens", 300);
            body.put("temperature", 0.7);

            ArrayNode messages = mapper.createArrayNode();
            ObjectNode sysMsg = mapper.createObjectNode();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);
            messages.add(sysMsg);

            for (ChatTurnDto turn : history) {
                ObjectNode msg = mapper.createObjectNode();
                msg.put("role", turn.getRole());
                msg.put("content", turn.getText() != null ? turn.getText() : "");
                messages.add(msg);
            }
            body.set("messages", messages);

            String response = webClient.post()
                    .uri(OPENAI_URL)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("choices").get(0).path("message").path("content").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error OpenAI chat " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error llamando a OpenAI chat: " + e.getMessage());
        }
    }

    // ── Gemini ────────────────────────────────────────────────────────────────

    private String callGemini(String systemPrompt, String userMessage, String imageBase64, String mimeType, String apiKey) {
        try {
            ObjectNode body = mapper.createObjectNode();

            ObjectNode systemInstruction = mapper.createObjectNode();
            ArrayNode sysParts = mapper.createArrayNode();
            ObjectNode sysText = mapper.createObjectNode();
            sysText.put("text", systemPrompt);
            sysParts.add(sysText);
            systemInstruction.set("parts", sysParts);
            body.set("system_instruction", systemInstruction);

            ArrayNode contents = mapper.createArrayNode();
            ObjectNode content = mapper.createObjectNode();
            content.put("role", "user");
            ArrayNode parts = mapper.createArrayNode();

            if (imageBase64 != null && !imageBase64.isBlank()) {
                ObjectNode imgPart = mapper.createObjectNode();
                ObjectNode inlineData = mapper.createObjectNode();
                inlineData.put("mime_type", mimeType != null ? mimeType : "image/jpeg");
                inlineData.put("data", imageBase64);
                imgPart.set("inline_data", inlineData);
                parts.add(imgPart);
            }

            ObjectNode textPart = mapper.createObjectNode();
            textPart.put("text", userMessage);
            parts.add(textPart);
            content.set("parts", parts);
            contents.add(content);
            body.set("contents", contents);

            ObjectNode genConfig = mapper.createObjectNode();
            genConfig.put("maxOutputTokens", 400);
            genConfig.put("temperature", 0.1);
            body.set("generationConfig", genConfig);

            String response = webClient.post()
                    .uri(GEMINI_URL + "?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error Gemini " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error llamando a Gemini: " + e.getMessage());
        }
    }

    private String callGeminiChat(String systemPrompt, List<ChatTurnDto> history, String apiKey) {
        try {
            ObjectNode body = mapper.createObjectNode();

            ObjectNode systemInstruction = mapper.createObjectNode();
            ArrayNode sysParts = mapper.createArrayNode();
            ObjectNode sysText = mapper.createObjectNode();
            sysText.put("text", systemPrompt);
            sysParts.add(sysText);
            systemInstruction.set("parts", sysParts);
            body.set("system_instruction", systemInstruction);

            ArrayNode contents = mapper.createArrayNode();
            for (ChatTurnDto turn : history) {
                ObjectNode content = mapper.createObjectNode();
                // Gemini uses "model" instead of "assistant"
                content.put("role", "assistant".equals(turn.getRole()) ? "model" : "user");
                ArrayNode parts = mapper.createArrayNode();
                ObjectNode textPart = mapper.createObjectNode();
                textPart.put("text", turn.getText() != null ? turn.getText() : "");
                parts.add(textPart);
                content.set("parts", parts);
                contents.add(content);
            }
            body.set("contents", contents);

            ObjectNode genConfig = mapper.createObjectNode();
            genConfig.put("maxOutputTokens", 300);
            genConfig.put("temperature", 0.7);
            body.set("generationConfig", genConfig);

            String response = webClient.post()
                    .uri(GEMINI_URL + "?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error Gemini chat " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error llamando a Gemini chat: " + e.getMessage());
        }
    }
}

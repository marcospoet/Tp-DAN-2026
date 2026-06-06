package com.budgetbuddy.ai.service;

import com.budgetbuddy.ai.config.AiProperties;
import com.budgetbuddy.ai.dto.ChatTurnDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
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
        return callSingleTurn(systemPrompt, userMessage, imageBase64, imageMimeType, null, null, providerOverride, apiKeyOverride);
    }

    /**
     * Single-turn call with optional image, optional file (PDF) and provider/key overrides.
     * Claude supports PDF via "type":"document"; Gemini via inline_data; OpenAI skips the file.
     */
    public String callSingleTurn(String systemPrompt, String userMessage, String imageBase64, String imageMimeType,
                                 String fileBase64, String fileMimeType,
                                 String providerOverride, String apiKeyOverride) {
        String p = resolveProvider(providerOverride);
        String k = resolveKey(p, apiKeyOverride);
        return switch (p) {
            case "openai" -> callOpenAI(systemPrompt, userMessage, imageBase64, imageMimeType, fileBase64, fileMimeType, k);
            case "gemini" -> callGemini(systemPrompt, userMessage, imageBase64, imageMimeType, fileBase64, fileMimeType, k);
            default -> callClaude(systemPrompt, userMessage, imageBase64, imageMimeType, fileBase64, fileMimeType, k);
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

    private String callClaude(String systemPrompt, String userMessage, String imageBase64, String mimeType,
                              String fileBase64, String fileMimeType, String apiKey) {
        try {
            boolean hasImage = imageBase64 != null && !imageBase64.isBlank();
            boolean hasFile = fileBase64 != null && !fileBase64.isBlank();

            ObjectNode body = mapper.createObjectNode();
            // claude-3-5-haiku does NOT support document (PDF) blocks — use Sonnet for PDFs
            body.put("model", hasFile ? "claude-3-5-sonnet-20241022" : "claude-3-5-haiku-20241022");
            // PDFs may yield multi-item invoices → give more output tokens
            body.put("max_tokens", hasFile ? 800 : 400);
            body.put("system", systemPrompt);

            ArrayNode messages = mapper.createArrayNode();
            ObjectNode userMsg = mapper.createObjectNode();
            userMsg.put("role", "user");

            if (hasFile || hasImage) {
                ArrayNode content = mapper.createArrayNode();
                if (hasFile) {
                    // PDF via Claude's document content block
                    ObjectNode docBlock = mapper.createObjectNode();
                    docBlock.put("type", "document");
                    ObjectNode docSource = mapper.createObjectNode();
                    docSource.put("type", "base64");
                    docSource.put("media_type", fileMimeType != null ? fileMimeType : "application/pdf");
                    docSource.put("data", fileBase64);
                    docBlock.set("source", docSource);
                    content.add(docBlock);
                }
                if (hasImage) {
                    ObjectNode imgBlock = mapper.createObjectNode();
                    imgBlock.put("type", "image");
                    ObjectNode source = mapper.createObjectNode();
                    source.put("type", "base64");
                    source.put("media_type", mimeType != null ? mimeType : "image/jpeg");
                    source.put("data", imageBase64);
                    imgBlock.set("source", source);
                    content.add(imgBlock);
                }
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

            // PDF document blocks require the pdfs beta header
            WebClient.RequestBodySpec claudeReq = webClient.post()
                    .uri(CLAUDE_URL)
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01");
            if (hasFile) {
                claudeReq = claudeReq.header("anthropic-beta", "pdfs-2024-09-25");
            }

            String response = claudeReq
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

    private String callOpenAI(String systemPrompt, String userMessage, String imageBase64, String mimeType,
                              String fileBase64, String fileMimeType, String apiKey) {
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

            // OpenAI vision: PDF → render first page as PNG, then send as image_url
            boolean hasPdf = fileBase64 != null && !fileBase64.isBlank();
            String visibleImageBase64 = imageBase64;
            String visibleMimeType = mimeType;
            boolean pdfConverted = false;
            if (hasPdf) {
                try {
                    visibleImageBase64 = pdfFirstPageToBase64Png(fileBase64);
                    visibleMimeType = "image/png";
                    pdfConverted = true;
                } catch (Exception e) {
                    // PDF rendering failed — fall through, send text only
                }
            }

            String effectiveMessage = (hasPdf && !pdfConverted)
                    ? userMessage + "\n[PDF adjunto no pudo procesarse como imagen. Analizá el texto disponible.]"
                    : userMessage;

            if (visibleImageBase64 != null && !visibleImageBase64.isBlank()) {
                ArrayNode content = mapper.createArrayNode();
                ObjectNode imgBlock = mapper.createObjectNode();
                imgBlock.put("type", "image_url");
                ObjectNode imgUrl = mapper.createObjectNode();
                imgUrl.put("url", "data:" + (visibleMimeType != null ? visibleMimeType : "image/jpeg") + ";base64," + visibleImageBase64);
                imgBlock.set("image_url", imgUrl);
                content.add(imgBlock);
                ObjectNode textBlock = mapper.createObjectNode();
                textBlock.put("type", "text");
                textBlock.put("text", effectiveMessage);
                content.add(textBlock);
                userMsg.set("content", content);
            } else {
                userMsg.put("content", effectiveMessage);
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

    private String callGemini(String systemPrompt, String userMessage, String imageBase64, String mimeType,
                              String fileBase64, String fileMimeType, String apiKey) {
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

            // PDF via inline_data (Gemini supports PDFs the same way as images)
            if (fileBase64 != null && !fileBase64.isBlank()) {
                ObjectNode filePart = mapper.createObjectNode();
                ObjectNode fileInline = mapper.createObjectNode();
                fileInline.put("mime_type", fileMimeType != null ? fileMimeType : "application/pdf");
                fileInline.put("data", fileBase64);
                filePart.set("inline_data", fileInline);
                parts.add(filePart);
            }

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

    // ── PDF rendering ─────────────────────────────────────────────────────────

    /**
     * Renders the first page of a base64-encoded PDF to a base64 PNG image.
     * Used so providers without native PDF support (OpenAI) can process invoices via vision.
     */
    private String pdfFirstPageToBase64Png(String pdfBase64) throws IOException {
        System.setProperty("java.awt.headless", "true");
        byte[] pdfBytes = Base64.getDecoder().decode(pdfBase64);
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            if (document.getNumberOfPages() == 0) throw new IOException("PDF sin páginas.");
            PDFRenderer renderer = new PDFRenderer(document);
            BufferedImage image = renderer.renderImageWithDPI(0, 150, ImageType.RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        }
    }

    // ── Audio transcription ───────────────────────────────────────────────────

    /**
     * Transcribes audio using the provider's best available method.
     * OpenAI → Whisper, Gemini → multimodal inline_data, Claude → null (unsupported).
     */
    public String transcribeAudio(String audioBase64, String mimeType, String providerOverride, String apiKeyOverride) {
        String p = resolveProvider(providerOverride);
        String k = resolveKey(p, apiKeyOverride);
        return switch (p) {
            case "openai" -> transcribeWithWhisper(audioBase64, mimeType, k);
            case "gemini" -> transcribeWithGemini(audioBase64, mimeType, k);
            default -> null; // Claude — no tiene API de transcripción de audio
        };
    }

    private String transcribeWithGemini(String audioBase64, String mimeType, String apiKey) {
        try {
            String safeMime = (mimeType != null && !mimeType.isBlank()) ? mimeType : "audio/webm";

            ObjectNode body = mapper.createObjectNode();

            ArrayNode contents = mapper.createArrayNode();
            ObjectNode content = mapper.createObjectNode();
            content.put("role", "user");
            ArrayNode parts = mapper.createArrayNode();

            ObjectNode audioPart = mapper.createObjectNode();
            ObjectNode inlineData = mapper.createObjectNode();
            inlineData.put("mime_type", safeMime);
            inlineData.put("data", audioBase64);
            audioPart.set("inline_data", inlineData);
            parts.add(audioPart);

            ObjectNode textPart = mapper.createObjectNode();
            textPart.put("text", "Transcribí exactamente lo que se dice en este audio en español. Devolvé únicamente el texto transcripto, sin explicaciones ni formato adicional.");
            parts.add(textPart);

            content.set("parts", parts);
            contents.add(content);
            body.set("contents", contents);

            ObjectNode genConfig = mapper.createObjectNode();
            genConfig.put("maxOutputTokens", 200);
            genConfig.put("temperature", 0);
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
            throw new RuntimeException("Error Gemini transcripción " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error transcribiendo con Gemini: " + e.getMessage());
        }
    }

    private String transcribeWithWhisper(String audioBase64, String mimeType, String apiKey) {
        try {
            byte[] audioBytes = Base64.getDecoder().decode(audioBase64);
            String safeMime = (mimeType != null && !mimeType.isBlank()) ? mimeType : "audio/webm";

            // Derive a sensible filename extension from the MIME type
            String ext = safeMime.contains("webm") ? "webm"
                    : safeMime.contains("mp4") ? "mp4"
                    : safeMime.contains("mpeg") ? "mp3"
                    : safeMime.contains("ogg") ? "ogg"
                    : safeMime.contains("wav") ? "wav"
                    : "webm";
            String filename = "audio." + ext;
            final String finalMime = safeMime;

            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("model", "whisper-1");
            builder.part("language", "es");
            builder.part("file", new ByteArrayResource(audioBytes) {
                @Override public String getFilename() { return filename; }
            }, MediaType.parseMediaType(finalMime));

            String response = webClient.post()
                    .uri("https://api.openai.com/v1/audio/transcriptions")
                    .header("Authorization", "Bearer " + apiKey)
                    .body(BodyInserters.fromMultipartData(builder.build()))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode json = mapper.readTree(response);
            return json.path("text").asText();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Error Whisper " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Error transcribiendo audio: " + e.getMessage());
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

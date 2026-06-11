package com.pesito.ai.controller;

import com.pesito.ai.dto.ChatRequest;
import com.pesito.ai.dto.ChatResponse;
import com.pesito.ai.dto.DetectIntentRequest;
import com.pesito.ai.dto.ParseRequest;
import com.pesito.ai.dto.RawAiResponse;
import com.pesito.ai.dto.TranscribeRequest;
import com.pesito.ai.exception.AiProviderUnavailableException;
import com.pesito.ai.service.AiProviderService;
import com.pesito.ai.service.ChatService;
import com.pesito.ai.service.PromptService;
import com.pesito.ai.service.UserApiKeysClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for AI endpoints.
 *
 * All endpoints are under /api/ai/** and routed here by the API Gateway.
 * The API keys for AI providers are managed server-side via environment variables.
 * The frontend does NOT send API keys from Phase B onward.
 *
 * userId is read from X-User-Id header (injected by the API Gateway JWT filter
 * when it is implemented; for now it can also be sent in the request body).
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final AiProviderService aiProvider;
    private final ChatService chatService;
    private final PromptService prompts;
    private final UserApiKeysClient userApiKeysClient;

    public AiController(AiProviderService aiProvider,
                        ChatService chatService,
                        PromptService prompts,
                        UserApiKeysClient userApiKeysClient) {
        this.aiProvider = aiProvider;
        this.chatService = chatService;
        this.prompts = prompts;
        this.userApiKeysClient = userApiKeysClient;
    }

    /**
     * Resuelve la API key del usuario para el provider indicado consultando el
     * endpoint interno de auth-service. La key nunca viaja desde el frontend.
     */
    private String resolveUserApiKey(String userId, String provider) {
        UserApiKeysClient.UserApiKeys keys = userApiKeysClient.getApiKeys(userId);
        String p = aiProvider.resolveProvider(provider);
        return switch (p) {
            case "openai" -> keys.openai();
            case "gemini" -> keys.gemini();
            default -> keys.claude();
        };
    }

    /**
     * Parse free-form text (and optionally an image) into transaction JSON.
     * Returns the raw AI response string; parsing/validation runs on the frontend
     * (reuses the existing extractAndValidate logic in lib/ai.ts).
     *
     * POST /api/ai/parse
     * Body: { input, imageBase64?, imageMimeType?, fileBase64?, fileMimeType?, todayDate? }
     */
    @PostMapping("/parse")
    public ResponseEntity<?> parse(
            @RequestBody ParseRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            String safeInput = prompts.sanitizeUserInput(req.getInput());
            String userMessage = prompts.buildUserMessage(safeInput, req.getTodayDate());

            // When a PDF/file is attached, append an explicit extraction instruction so the model
            // knows it must read the document rather than rely only on the user's text.
            boolean hasPdf = req.getFileBase64() != null && !req.getFileBase64().isBlank();
            if (hasPdf) {
                userMessage += "\n[PDF de factura adjunto. Leé el contenido del PDF y extraé: monto TOTAL (buscá 'Total', 'Total a pagar', 'Importe total' al pie del documento), nombre del proveedor/establecimiento y categoría del gasto. Respondé con JSON aunque el usuario no haya escrito texto.]";
            }
            log.info("Parsing request — input length: {}, hasPdf: {}", safeInput.length(), hasPdf);

            String apiKey = resolveUserApiKey(userId, req.getProvider());
            String raw = aiProvider.callSingleTurn(
                    PromptService.SYSTEM_PROMPT,
                    userMessage,
                    req.getImageBase64(),
                    req.getImageMimeType(),
                    req.getFileBase64(),
                    req.getFileMimeType(),
                    req.getProvider(),
                    apiKey
            );
            log.info("Parse raw response: {}", raw);
            return ResponseEntity.ok(new RawAiResponse(raw));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/parse: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/parse: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error del servicio de IA. Intentá de nuevo."));
        }
    }

    /**
     * Conversational financial chat with persisted session history in MongoDB.
     *
     * POST /api/ai/chat
     * Body: { userId, sessionId?, message, financialContext, history? }
     */
    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody ChatRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {
        try {
            // Header takes priority over body userId
            if (headerUserId != null && !headerUserId.isBlank()) {
                req.setUserId(headerUserId);
            }
            if (req.getMessage() == null || req.getMessage().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "El mensaje no puede estar vacío."));
            }
            // Sanitize the incoming user message
            String safeMsg = prompts.sanitizeUserInput(req.getMessage());
            req.setMessage(safeMsg);

            UserApiKeysClient.UserApiKeys userKeys = userApiKeysClient.getApiKeys(req.getUserId());
            String provider = aiProvider.resolveProvider(req.getProvider());
            String apiKey = switch (provider) {
                case "openai" -> userKeys.openai();
                case "gemini" -> userKeys.gemini();
                default -> userKeys.claude();
            };

            ChatResponse response = chatService.chat(req, req.getProvider(), apiKey, userKeys.openai());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/chat: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/chat: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error del servicio de chat. Intentá de nuevo."));
        }
    }

    /**
     * Detect the intent of a chat message (delete / update / recurring / csv-mapping).
     * Returns the raw AI JSON string; parsing runs on the frontend.
     *
     * POST /api/ai/detect-intent
     * Body: { message, intentType, todayDate? }
     */
    @PostMapping("/detect-intent")
    public ResponseEntity<?> detectIntent(
            @RequestBody DetectIntentRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            String safeMsg = prompts.sanitizeUserInput(req.getMessage());
            String userMessage = prompts.buildDetectMessage(safeMsg, req.getTodayDate());

            String systemPrompt = switch (req.getIntentType() != null ? req.getIntentType() : "") {
                case "update" -> PromptService.UPDATE_DETECT_PROMPT;
                case "recurring" -> PromptService.RECURRING_DETECT_PROMPT;
                case "csv" -> PromptService.CSV_MAPPING_PROMPT;
                default -> PromptService.DELETE_DETECT_PROMPT;
            };

            String apiKey = resolveUserApiKey(userId, req.getProvider());
            String raw = aiProvider.callSingleTurn(systemPrompt, userMessage, null, null, req.getProvider(), apiKey);
            return ResponseEntity.ok(new RawAiResponse(raw));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/detect-intent: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/detect-intent: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error del servicio de IA. Intentá de nuevo."));
        }
    }

    /**
     * CSV column mapping — identifies date/description/amount columns from headers + sample rows.
     *
     * POST /api/ai/csv-mapping
     * Body: { headers: string[], sampleRows: string[][] }
     */
    @PostMapping("/csv-mapping")
    public ResponseEntity<?> csvMapping(
            @RequestBody Map<String, Object> req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            String userContent = buildCsvMappingUserContent(req);
            String raw = aiProvider.callSingleTurn(PromptService.CSV_MAPPING_PROMPT, userContent);
            return ResponseEntity.ok(new RawAiResponse(raw));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/csv-mapping: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/csv-mapping: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error al analizar el CSV. Intentá de nuevo."));
        }
    }

    /**
     * Audio transcription via OpenAI Whisper.
     * Returns null for providers that don't support transcription (Claude, Gemini).
     *
     * POST /api/ai/transcribe
     * Body: { audioBase64, mimeType?, provider?, apiKey? }
     */
    @PostMapping("/transcribe")
    public ResponseEntity<?> transcribe(
            @RequestBody TranscribeRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            if (req.getAudioBase64() == null || req.getAudioBase64().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No se recibió audio."));
            }
            String apiKey = resolveUserApiKey(userId, req.getProvider());
            String transcription = aiProvider.transcribeAudio(
                    req.getAudioBase64(), req.getMimeType(),
                    req.getProvider(), apiKey);
            return ResponseEntity.ok(Map.of("transcription", transcription != null ? transcription : ""));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/transcribe: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/transcribe: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error al transcribir el audio. Intentá de nuevo."));
        }
    }

    @SuppressWarnings("unchecked")
    private String buildCsvMappingUserContent(Map<String, Object> req) {
        var headers = (java.util.List<String>) req.getOrDefault("headers", java.util.List.of());
        var sampleRows = (java.util.List<java.util.List<String>>) req.getOrDefault("sampleRows", java.util.List.of());

        // Truncate to limit injection surface
        var safeHeaders = headers.stream().limit(12)
                .map(h -> h.substring(0, Math.min(h.length(), 40)))
                .toList();
        var safeRows = sampleRows.stream().limit(3)
                .map(row -> row.stream().limit(12)
                        .map(c -> c.substring(0, Math.min(c.length(), 60)))
                        .toList())
                .toList();

        return "Cabeceras: " + safeHeaders + "\nFilas de muestra:\n" + safeRows +
                "\n\nDevolvé ÚNICAMENTE JSON (sin markdown):\n" +
                "{\"dateCol\":0,\"descCol\":1,\"amountCol\":2,\"debitCol\":null,\"creditCol\":null,\"dateFormat\":\"dd/mm/yyyy\"}";
    }
}

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
import com.pesito.ai.service.EmbeddingMigrationService;
import com.pesito.ai.service.PromptService;
import com.pesito.ai.service.UserApiKeysClient;
import com.pesito.ai.service.UserProfileService;
import jakarta.validation.Valid;
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
 * userId is read exclusively from the X-User-Id header, injected by the API
 * Gateway JWT filter. Client-supplied userIds (body or spoofed header) are
 * never trusted: the gateway overwrites the header with the JWT claim.
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final AiProviderService aiProvider;
    private final ChatService chatService;
    private final PromptService prompts;
    private final UserApiKeysClient userApiKeysClient;
    private final UserProfileService userProfileService;
    private final EmbeddingMigrationService migrationService;

    public AiController(AiProviderService aiProvider,
                        ChatService chatService,
                        PromptService prompts,
                        UserApiKeysClient userApiKeysClient,
                        UserProfileService userProfileService,
                        EmbeddingMigrationService migrationService) {
        this.aiProvider = aiProvider;
        this.chatService = chatService;
        this.prompts = prompts;
        this.userApiKeysClient = userApiKeysClient;
        this.userProfileService = userProfileService;
        this.migrationService = migrationService;
    }

    /**
     * Resuelve la API key del usuario para el provider indicado consultando el
     * endpoint interno de auth-service. La key nunca viaja desde el frontend.
     */
    private String resolveUserApiKey(String userId, String provider) {
        UserApiKeysClient.UserApiKeys keys = userApiKeysClient.getApiKeys(userId);
        String p = aiProvider.resolveProvider(provider);
        String key = switch (p) {
            case "openai" -> keys.openai();
            case "gemini" -> keys.gemini();
            default -> keys.claude();
        };
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException(
                "No configuraste tu clave de API para " + p + ". Andá a Ajustes → Cuenta."
            );
        }
        return key;
    }

    /**
     * Mapea una excepción del proveedor de IA a una respuesta HTTP.
     * Los errores de cuota/rate-limit (429 / RESOURCE_EXHAUSTED) se devuelven
     * como 429 con un mensaje específico para que el frontend los distinga de
     * una falla genérica del servicio (ver translateError en lib/ai.ts).
     */
    private ResponseEntity<?> providerErrorResponse(Exception e, String defaultMessage) {
        String msg = e.getMessage() != null ? e.getMessage() : "";
        if (msg.matches("(?is).*(429|RESOURCE_EXHAUSTED|quota exceeded).*")) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Límite de requests alcanzado en tu cuenta de IA. Esperá unos segundos e intentá de nuevo."));
        }
        return ResponseEntity.internalServerError().body(Map.of("error", defaultMessage));
    }

    /**
     * Cambio de proveedor con espacios vectoriales incompatibles (Caso B):
     * "Actualizar mis documentos" — reindexa la knowledge base, re-embebe las
     * memorias de chat y el perfil con el proveedor nuevo. Corre en background
     * (202 Accepted) y consume saldo de la cuenta nueva del usuario.
     *
     * POST /api/ai/embeddings/migrate
     * Body: { provider: "openai" | "gemini" }
     */
    @PostMapping("/embeddings/migrate")
    public ResponseEntity<?> migrateEmbeddings(
            @RequestBody Map<String, String> body,
            @RequestHeader("X-User-Id") String userId) {
        try {
            String provider = aiProvider.resolveProvider(body.get("provider"));
            // El usuario acaba de guardar la key nueva: invalidar el caché antes de resolverla
            userApiKeysClient.evict(userId);
            String apiKey = resolveUserApiKey(userId, provider);
            // Una sola migración por usuario a la vez: evita re-embeber en paralelo
            // y disparos en loop que consuman saldo de la API key del usuario
            if (!migrationService.tryAcquire(userId)) {
                return ResponseEntity.status(409)
                        .body(Map.of("error", "Ya hay una actualización de documentos en curso. Esperá a que termine."));
            }
            migrationService.migrate(userId, provider, apiKey);
            return ResponseEntity.accepted().body(Map.of("started", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/embeddings/migrate: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "No se pudo iniciar la actualización de documentos."));
        }
    }

    /**
     * Cambio de proveedor, opción "Solo chatear" (Caso B): pausa la lectura
     * semántica de documentos — sin consumo de tokens — hasta que el usuario
     * decida migrarlos.
     *
     * POST /api/ai/embeddings/pause
     */
    @PostMapping("/embeddings/pause")
    public ResponseEntity<?> pauseDocuments(
            @RequestHeader("X-User-Id") String userId) {
        try {
            userProfileService.setDocumentsPaused(userId, true);
            return ResponseEntity.ok(Map.of("paused", true));
        } catch (Exception e) {
            log.error("Error in /api/ai/embeddings/pause: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "No se pudo pausar la lectura de documentos."));
        }
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
            @Valid @RequestBody ParseRequest req,
            @RequestHeader("X-User-Id") String userId) {
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
            return providerErrorResponse(e, "Error del servicio de IA. Intentá de nuevo.");
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
            @Valid @RequestBody ChatRequest req,
            @RequestHeader("X-User-Id") String headerUserId) {
        try {
            // El userId del body se ignora siempre: solo vale el del gateway
            req.setUserId(headerUserId);
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
            if (apiKey == null || apiKey.isBlank()) {
                throw new IllegalArgumentException(
                    "No configuraste tu clave de API para " + provider + ". Andá a Ajustes → Cuenta."
                );
            }

            ChatResponse response = chatService.chat(req, req.getProvider(), apiKey);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/chat: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/chat: {}", e.getMessage());
            return providerErrorResponse(e, "Error del servicio de chat. Intentá de nuevo.");
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
            @Valid @RequestBody DetectIntentRequest req,
            @RequestHeader("X-User-Id") String userId) {
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
            return providerErrorResponse(e, "Error del servicio de IA. Intentá de nuevo.");
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
            @RequestHeader("X-User-Id") String userId) {
        try {
            String provider = req.get("provider") instanceof String s ? s : null;
            String apiKey = resolveUserApiKey(userId, provider);
            String userContent = buildCsvMappingUserContent(req);
            String raw = aiProvider.callSingleTurn(PromptService.CSV_MAPPING_PROMPT, userContent, null, null, provider, apiKey);
            return ResponseEntity.ok(new RawAiResponse(raw));
        } catch (AiProviderUnavailableException e) {
            log.warn("AI provider unavailable in /api/ai/csv-mapping: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error in /api/ai/csv-mapping: {}", e.getMessage());
            return providerErrorResponse(e, "Error al analizar el CSV. Intentá de nuevo.");
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
            @Valid @RequestBody TranscribeRequest req,
            @RequestHeader("X-User-Id") String userId) {
        try {
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
            return providerErrorResponse(e, "Error al transcribir el audio. Intentá de nuevo.");
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

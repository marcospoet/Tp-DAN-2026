package com.pesito.ai.observability;

import com.pesito.ai.config.AiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cliente mínimo de Langfuse vía su Ingestion API pública
 * (POST /api/public/ingestion).
 *
 * - Graceful no-op: si LANGFUSE_PUBLIC_KEY no está configurada, todos los
 *   métodos retornan sin hacer llamadas HTTP.
 * - Fire-and-forget: los envíos se hacen con subscribe() y nunca bloquean
 *   ni rompen el loop del agente.
 */
@Service
public class LangfuseService {

    private static final Logger log = LoggerFactory.getLogger(LangfuseService.class);

    private final AiProperties props;
    private final WebClient client;
    private final boolean enabled;

    public LangfuseService(AiProperties props) {
        this.props = props;
        this.enabled = props.getLangfusePublicKey() != null && !props.getLangfusePublicKey().isBlank()
                && props.getLangfuseSecretKey() != null && !props.getLangfuseSecretKey().isBlank();
        this.client = enabled
                ? WebClient.builder()
                    .baseUrl(props.getLangfuseHost())
                    .defaultHeader("Authorization", basicAuth())
                    .build()
                : null;
        if (enabled) {
            log.info("[LANGFUSE] tracing habilitado → {}", props.getLangfuseHost());
        } else {
            log.info("[LANGFUSE] sin claves configuradas — tracing deshabilitado (no-op)");
        }
    }

    private String basicAuth() {
        String creds = props.getLangfusePublicKey() + ":" + props.getLangfuseSecretKey();
        return "Basic " + Base64.getEncoder().encodeToString(creds.getBytes(StandardCharsets.UTF_8));
    }

    /** Crea un trace para una conversación del agente. Retorna el traceId. */
    public String startTrace(String userId, String input) {
        String traceId = UUID.randomUUID().toString();
        if (!enabled) return traceId;
        Map<String, Object> body = new HashMap<>();
        body.put("id", traceId);
        body.put("name", "pesito-agent-chat");
        body.put("userId", userId);
        body.put("input", truncate(input));
        body.put("timestamp", Instant.now().toString());
        send("trace-create", body);
        return traceId;
    }

    /** Registra una invocación de tool (o llamada LLM) como span del trace. */
    public void addSpan(String traceId, String name, Object input, String output) {
        if (!enabled) return;
        Map<String, Object> body = new HashMap<>();
        body.put("id", UUID.randomUUID().toString());
        body.put("traceId", traceId);
        body.put("name", name);
        body.put("input", input != null ? truncate(input.toString()) : null);
        body.put("output", truncate(output));
        body.put("startTime", Instant.now().toString());
        body.put("endTime", Instant.now().toString());
        send("span-create", body);
    }

    /** Cierra el trace con la respuesta final del agente (upsert sobre el mismo id). */
    public void finishTrace(String traceId, String output) {
        if (!enabled) return;
        Map<String, Object> body = new HashMap<>();
        body.put("id", traceId);
        body.put("output", truncate(output));
        send("trace-create", body);
    }

    private void send(String eventType, Map<String, Object> eventBody) {
        Map<String, Object> event = new HashMap<>();
        event.put("id", UUID.randomUUID().toString());
        event.put("type", eventType);
        event.put("timestamp", Instant.now().toString());
        event.put("body", eventBody);

        List<Map<String, Object>> batch = new ArrayList<>();
        batch.add(event);

        client.post()
                .uri("/api/public/ingestion")
                .bodyValue(Map.of("batch", batch))
                .retrieve()
                .toBodilessEntity()
                .doOnError(e -> log.debug("[LANGFUSE] error enviando evento {}: {}", eventType, e.getMessage()))
                .onErrorComplete()
                .subscribe();
    }

    private String truncate(String text) {
        if (text == null) return null;
        return text.length() > 2000 ? text.substring(0, 2000) + "…" : text;
    }
}

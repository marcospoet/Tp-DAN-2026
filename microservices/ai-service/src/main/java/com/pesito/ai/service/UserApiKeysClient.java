package com.pesito.ai.service;

import com.pesito.ai.config.AiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Obtiene las API keys descifradas del usuario desde el endpoint interno
 * de auth-service (GET /internal/users/{userId}/api-keys).
 *
 * Ante un error (usuario sin keys, timeout, auth-service caído, secret
 * inválido) devuelve {@link UserApiKeys#EMPTY} y loguea el error real para
 * que la falla nunca sea silenciosa — sin keys el chat responde 400 con
 * "No configuraste tu clave de API".
 *
 * El resultado se cachea 60s por usuario (Caffeine): evita un round-trip a
 * auth-service (query + descifrado AES) en cada request de IA. Un cambio de
 * keys en Settings tarda como mucho 60s en impactar.
 */
@Service
public class UserApiKeysClient {

    private static final Logger log = LoggerFactory.getLogger(UserApiKeysClient.class);

    public record UserApiKeys(String claude, String openai, String gemini) {
        public static final UserApiKeys EMPTY = new UserApiKeys(null, null, null);
    }

    private record InternalApiKeysResponse(String apiKeyClaude, String apiKeyOpenai, String apiKeyGemini) {}

    private final WebClient authServiceWebClient;
    private final String internalApiSecret;

    public UserApiKeysClient(@Qualifier("authServiceWebClient") WebClient authServiceWebClient,
                              AiProperties aiProperties) {
        this.authServiceWebClient = authServiceWebClient;
        this.internalApiSecret = aiProperties.getInternalApiSecret();
    }

    /**
     * Invalida el caché de keys del usuario. Se llama cuando el usuario acaba
     * de cambiar sus keys (flujo de migración de proveedor) para no resolver
     * una key vieja durante los 60s de TTL.
     */
    @CacheEvict(value = "user-api-keys")
    public void evict(String userId) {
    }

    @Cacheable(value = "user-api-keys", condition = "#userId != null && !#userId.isBlank()")
    public UserApiKeys getApiKeys(String userId) {
        if (userId == null || userId.isBlank()) {
            return UserApiKeys.EMPTY;
        }
        try {
            InternalApiKeysResponse response = authServiceWebClient.get()
                    .uri("/internal/users/{userId}/api-keys", userId)
                    .header("X-Internal-Secret", internalApiSecret)
                    .retrieve()
                    .bodyToMono(InternalApiKeysResponse.class)
                    .block();

            if (response == null) {
                return UserApiKeys.EMPTY;
            }
            return new UserApiKeys(response.apiKeyClaude(), response.apiKeyOpenai(), response.apiKeyGemini());
        } catch (WebClientResponseException e) {
            // 403 acá casi siempre significa INTERNAL_API_SECRET ausente o distinto entre servicios
            log.error("[API_KEYS] auth-service respondió {} para userId={} — revisar INTERNAL_API_SECRET en .env",
                    e.getStatusCode(), userId);
            return UserApiKeys.EMPTY;
        } catch (Exception e) {
            log.error("[API_KEYS] no se pudieron obtener las keys de userId={}: {}", userId, e.getMessage());
            return UserApiKeys.EMPTY;
        }
    }
}

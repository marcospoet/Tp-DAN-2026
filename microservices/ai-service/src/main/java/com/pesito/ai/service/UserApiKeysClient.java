package com.pesito.ai.service;

import com.pesito.ai.config.AiProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Obtiene las API keys descifradas del usuario desde el endpoint interno
 * de auth-service (GET /internal/users/{userId}/api-keys).
 *
 * Falla en modo "abierto": ante cualquier error (usuario sin keys, timeout,
 * auth-service caído, etc.) devuelve {@link UserApiKeys#EMPTY}, dejando que
 * AiProviderService recurra a las keys server-side configuradas por entorno.
 *
 * El resultado se cachea 60s por usuario (Caffeine): evita un round-trip a
 * auth-service (query + descifrado AES) en cada request de IA. Un cambio de
 * keys en Settings tarda como mucho 60s en impactar.
 */
@Service
public class UserApiKeysClient {

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
        } catch (Exception e) {
            return UserApiKeys.EMPTY;
        }
    }
}

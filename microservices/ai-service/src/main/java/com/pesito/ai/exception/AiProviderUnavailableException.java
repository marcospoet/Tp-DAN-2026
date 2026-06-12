package com.pesito.ai.exception;

/**
 * Thrown when the circuit breaker for AI providers (Claude/OpenAI/Gemini) is
 * open, i.e. the provider is failing repeatedly and calls are short-circuited
 * instead of being attempted.
 */
public class AiProviderUnavailableException extends RuntimeException {

    public AiProviderUnavailableException(String message) {
        super(message);
    }
}

package com.pesito.auth.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fail-fast de secretos: fuera del perfil "local" el servicio
 * no arranca con secretos faltantes, demasiado cortos o con valores de
 * ejemplo/desarrollo (los de .env.example o application-local.properties).
 */
@Component
@Profile("!local")
public class SecretsValidator {

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${app.encryption.secret:}")
    private String encryptionSecret;

    @Value("${app.internal-api-secret:}")
    private String internalApiSecret;

    @PostConstruct
    void validate() {
        check("JWT_SECRET", jwtSecret);
        check("APP_ENCRYPTION_SECRET", encryptionSecret);
        check("INTERNAL_API_SECRET", internalApiSecret);
    }

    static void check(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                name + " no esta configurado. Generarlo con: openssl rand -hex 32");
        }
        if (value.length() < 32) {
            throw new IllegalStateException(
                name + " es demasiado corto (minimo 32 caracteres). Generarlo con: openssl rand -hex 32");
        }
        String lower = value.toLowerCase();
        if (lower.contains("cambiar") || lower.contains("reemplazar") || lower.startsWith("pesito-")) {
            throw new IllegalStateException(
                name + " tiene un valor de ejemplo/desarrollo. Generar uno real con: openssl rand -hex 32");
        }
    }
}

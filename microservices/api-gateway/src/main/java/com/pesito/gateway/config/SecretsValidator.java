package com.pesito.gateway.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fail-fast de secretos: fuera del perfil "local" el gateway no
 * arranca con un JWT_SECRET faltante, demasiado corto o con el valor de
 * ejemplo/desarrollo.
 */
@Component
@Profile("!local")
public class SecretsValidator {

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @PostConstruct
    void validate() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET no esta configurado. Generarlo con: openssl rand -hex 32");
        }
        if (jwtSecret.length() < 32) {
            throw new IllegalStateException(
                "JWT_SECRET es demasiado corto (minimo 32 caracteres). Generarlo con: openssl rand -hex 32");
        }
        String lower = jwtSecret.toLowerCase();
        if (lower.contains("cambiar") || lower.contains("reemplazar") || lower.startsWith("pesito-")) {
            throw new IllegalStateException(
                "JWT_SECRET tiene un valor de ejemplo/desarrollo. Generar uno real con: openssl rand -hex 32");
        }
    }
}

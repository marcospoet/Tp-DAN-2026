package com.pesito.auth.controller;

import com.pesito.auth.dto.InternalApiKeysResponse;
import com.pesito.auth.entity.Profile;
import com.pesito.auth.entity.User;
import com.pesito.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * InternalController — endpoints de uso exclusivo entre microservicios.
 *
 * No esta expuesto a traves del api-gateway (no hay ruta /internal/** registrada),
 * solo es alcanzable por red interna de Docker. Adicionalmente protegido por un
 * secreto compartido (X-Internal-Secret).
 */
@RestController
@RequiredArgsConstructor
public class InternalController {

    private final UserRepository userRepository;

    @Value("${app.internal-api-secret}")
    private String internalApiSecret;

    // Transaccional: con open-in-view=false la sesion de Hibernate ya no cubre
    // todo el request, y User::getProfile es una relacion lazy
    @Transactional(readOnly = true)
    @GetMapping("/internal/users/{userId}/api-keys")
    public ResponseEntity<InternalApiKeysResponse> getApiKeys(
        @PathVariable String userId,
        @RequestHeader(value = "X-Internal-Secret", required = false) String secret
    ) {
        if (internalApiSecret == null || internalApiSecret.isBlank()
            || secret == null || !internalApiSecret.equals(secret)) {
            return ResponseEntity.status(403).build();
        }

        UUID id;
        try {
            id = UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        return userRepository.findById(id)
            .map(User::getProfile)
            .map(p -> ResponseEntity.ok(new InternalApiKeysResponse(
                p.getApiKeyClaude(), p.getApiKeyOpenai(), p.getApiKeyGemini()
            )))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}

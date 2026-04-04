package com.budgetbuddy.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * HealthController — endpoint de verificacion del servicio.
 *
 * Verificar con: curl http://localhost:8083/health
 * Verificar registro en Eureka: http://localhost:8761
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "ai-service"
        ));
    }
}

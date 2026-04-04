package com.budgetbuddy.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * HealthController — endpoint de verificacion del servicio.
 *
 * Ademas del /actuator/health provisto por Spring Boot Actuator,
 * este endpoint custom permite verificar que el servicio arranco
 * correctamente y se registro en Eureka.
 *
 * Verificar con: curl http://localhost:8081/health
 * Verificar registro en Eureka: http://localhost:8761
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "auth-service"
        ));
    }
}

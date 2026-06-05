package com.budgetbuddy.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class FallbackController {

    @RequestMapping("/fallback/auth")
    public ResponseEntity<Map<String, String>> authFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "El servicio de autenticación no está disponible",
                        "mensaje", "Intente nuevamente en unos segundos"
                ));
    }

    @RequestMapping("/fallback/transactions")
    public ResponseEntity<Map<String, String>> transactionsFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "El servicio de transacciones no está disponible",
                        "mensaje", "Sus datos están seguros. Intente nuevamente en unos segundos"
                ));
    }

    @RequestMapping("/fallback/ai")
    public ResponseEntity<Map<String, String>> aiFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "El asistente de IA no está disponible",
                        "mensaje", "El análisis inteligente está temporalmente fuera de servicio"
                ));
    }
}

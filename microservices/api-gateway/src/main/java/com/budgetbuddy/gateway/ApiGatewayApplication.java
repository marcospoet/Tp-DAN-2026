package com.budgetbuddy.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * API Gateway — único punto de entrada al sistema BudgetBuddy.
 *
 * Responsabilidades:
 *  - Enrutar requests al microservicio correcto vía Eureka (lb://nombre-servicio)
 *  - Validar JWT antes de dejar pasar cada request (implementar en Fase 3)
 *  - Aplicar Circuit Breaker + Retry + Rate Limiter con Resilience4J
 *  - Exponer métricas en /actuator/prometheus para Prometheus
 *
 * Rutas configuradas en application.properties:
 *  /api/auth/**        → auth-service      (puerto 8081)
 *  /api/transactions/** → transaction-service (puerto 8082)
 *  /api/ai/**          → ai-service        (puerto 8083)
 */
@SpringBootApplication
@EnableDiscoveryClient
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}

package com.budgetbuddy.eureka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * Eureka Server — Service Discovery para BudgetBuddy.
 *
 * Todos los microservicios (auth-service, transaction-service, ai-service, api-gateway)
 * se registran aquí al arrancar. El Gateway consulta este registro para resolver
 * rutas con balanceo de carga (lb://nombre-servicio).
 *
 * UI disponible en: http://localhost:8761
 */
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}

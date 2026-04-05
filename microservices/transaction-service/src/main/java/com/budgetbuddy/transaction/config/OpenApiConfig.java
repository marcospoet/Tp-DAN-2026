package com.budgetbuddy.transaction.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig{

    @Bean
    public OpenAPI openAPI(){
        return new OpenAPI()
                .info(new Info()
                        .title("Transaction Service API")
                        .description("CRUD de transacciones y cotizaciones")
                        .version("1.0.0")
                        .contact(new Contact().name("TP DAN 2026 — UTN FRSF")))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth",new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Ingresá el token JWT obtenido en /api/auth/login")));

    }

}

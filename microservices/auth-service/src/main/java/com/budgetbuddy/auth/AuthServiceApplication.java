package com.budgetbuddy.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Auth Service — Autenticacion y Perfiles de BudgetBuddy.
 *
 * Responsabilidades:
 *  - Registro de nuevos usuarios (POST /api/auth/register)
 *  - Login con email/password → devuelve JWT (POST /api/auth/login)
 *  - CRUD del perfil de usuario: nombre, presupuesto, modo, claves de IA
 *  - Publicar eventos async a RabbitMQ: user.registered, user.deleted
 *
 * Base de datos: PostgreSQL, schema "auth"
 *  Tablas: auth.users, auth.profiles
 *  Migraciones gestionadas por Flyway (src/main/resources/db/migration/)
 *
 * TODO (Fase 3 — implementar en este orden):
 *  1. Entidades JPA: User, Profile
 *  2. Repositorios: UserRepository, ProfileRepository
 *  3. Configuracion de seguridad: SecurityConfig (permitir /api/auth/register y /api/auth/login)
 *  4. Servicio: AuthService (BCrypt hash, JWT con JJWT)
 *  5. Controlador: AuthController
 *  6. Publicador RabbitMQ: UserEventPublisher
 */
@SpringBootApplication
@EnableDiscoveryClient
public class AuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}

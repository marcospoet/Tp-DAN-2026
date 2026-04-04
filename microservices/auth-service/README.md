# auth-service
## Autenticación y Perfiles de Usuario

---

## Responsabilidad

Contexto de dominio: **Identidad y Perfiles**

Gestiona todo lo relacionado a la identidad del usuario y sus preferencias personales.
Es la única fuente de verdad sobre quién es el usuario y cómo quiere usar la aplicación.

---

## Stack

- Spring Boot 3.x
- Spring Security 6.x (con JWT)
- Spring Data JPA + Hibernate
- PostgreSQL (schema: `auth`)
- Spring Cloud Netflix Eureka Client
- Spring Boot Actuator + Micrometer
- Puerto: `8081`

---

## Dependencias Maven requeridas

```xml
<!-- Core -->
<dependency>spring-boot-starter-web</dependency>
<dependency>spring-boot-starter-security</dependency>
<dependency>spring-boot-starter-data-jpa</dependency>

<!-- JWT (JJWT library) -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.11.5</version>
</dependency>
<dependency>io.jsonwebtoken:jjwt-impl:0.11.5:runtime</dependency>
<dependency>io.jsonwebtoken:jjwt-jackson:0.11.5:runtime</dependency>

<!-- Eureka Client -->
<dependency>spring-cloud-starter-netflix-eureka-client</dependency>

<!-- PostgreSQL driver -->
<dependency>org.postgresql:postgresql</dependency>

<!-- Actuator + Prometheus -->
<dependency>spring-boot-starter-actuator</dependency>
<dependency>io.micrometer:micrometer-registry-prometheus</dependency>

<!-- RabbitMQ -->
<dependency>spring-boot-starter-amqp</dependency>

<!-- Logstash encoder para logs JSON -->
<dependency>net.logstash.logback:logstash-logback-encoder:7.4</dependency>
```

---

## Configuración (application.yml)

```yaml
server:
  port: 8081

spring:
  application:
    name: AUTH-SERVICE
  datasource:
    url: jdbc:postgresql://postgres:5432/budgetbuddy?currentSchema=auth
    username: ${AUTH_DB_USER}         # Variable de entorno
    password: ${AUTH_DB_PASSWORD}     # Variable de entorno — NUNCA hardcodear
  jpa:
    hibernate:
      ddl-auto: validate              # En prod usar Flyway/Liquibase para migraciones
    properties:
      hibernate:
        default_schema: auth

eureka:
  client:
    service-url:
      defaultZone: http://eureka-server:8761/eureka/

jwt:
  secret: ${JWT_SECRET}              # Clave compartida con api-gateway
  expiration: 86400000               # 24 horas en ms

rabbitmq:
  exchange: budgetbuddy.events
```

---

## Endpoints REST

| Método | Path | Autenticación | Descripción |
|--------|------|:---:|-------------|
| `POST` | `/api/auth/register` | ❌ | Registro con email/password |
| `POST` | `/api/auth/login` | ❌ | Login, devuelve JWT |
| `POST` | `/api/auth/oauth/google` | ❌ | Login con Google OAuth token |
| `POST` | `/api/auth/oauth/github` | ❌ | Login con GitHub OAuth token |
| `POST` | `/api/auth/forgot-password` | ❌ | Solicitar reset de contraseña |
| `POST` | `/api/auth/reset-password` | ❌ | Confirmar nuevo password con token |
| `GET` | `/api/auth/profile` | ✅ JWT | Obtener perfil del usuario |
| `PUT` | `/api/auth/profile` | ✅ JWT | Actualizar perfil (nombre, budget, IA key, etc.) |
| `DELETE` | `/api/auth/account` | ✅ JWT | Eliminar cuenta (publica `user.deleted`) |

**Nota:** Los endpoints marcados con ✅ JWT leen el header `X-User-Id` inyectado por el Gateway.
No necesitan re-validar el JWT.

---

## Eventos publicados en RabbitMQ

```json
// user.registered
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "Marcos",
  "timestamp": "2025-04-04T12:00:00Z"
}

// user.deleted
{
  "userId": "uuid",
  "timestamp": "2025-04-04T12:00:00Z"
}

// user.password-reset-requested
{
  "userId": "uuid",
  "email": "user@example.com",
  "resetToken": "token-temporal",
  "expiresAt": "2025-04-04T13:00:00Z"
}
```

---

## Modelo de Datos (Entidades JPA)

```
Entities:
  UserEntity       → tabla auth.users
  ProfileEntity    → tabla auth.profiles (1:1 con users)
  OAuthConnection  → tabla auth.oauth_connections (N:1 con users)
```

---

## Seguridad: Emisión del JWT

El JWT contiene:
```json
{
  "sub": "userId-uuid",
  "email": "user@example.com",
  "profileMode": "standard",
  "aiProvider": "claude",
  "iat": 1700000000,
  "exp": 1700086400
}
```

**Importante:** Las API keys del usuario (Claude, OpenAI, Gemini) NO van en el JWT.
El ai-service las obtiene llamando a auth-service con el `userId` cuando las necesita,
o el frontend las envía directamente en cada request al ai-service.

---

## Flyway (Migraciones de Base de Datos)

Ubicación de scripts: `src/main/resources/db/migration/`

```
V1__create_schema.sql         → CREATE SCHEMA auth
V2__create_users_table.sql    → CREATE TABLE auth.users
V3__create_profiles_table.sql → CREATE TABLE auth.profiles
V4__create_oauth_table.sql    → CREATE TABLE auth.oauth_connections
```

---

## Origen en el proyecto actual

La lógica que migra a este servicio viene de:
- `lib/app-context.tsx` → funciones: `signIn()`, `signUp()`, `signOut()`, `resetPasswordForEmail()`, `loadProfile()`, `saveProfile()`
- Modelo: `Profile` interface en `lib/app-context.tsx`
- Supabase Auth → reemplazado por Spring Security + JWT propio

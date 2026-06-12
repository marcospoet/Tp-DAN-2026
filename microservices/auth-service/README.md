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
- Spring Security 6.x (JWT + OAuth2 Client para Google/GitHub)
- Spring Data JPA + Hibernate + Flyway
- PostgreSQL (schema: `auth`)
- Bean Validation (`@Valid` en registro y perfil)
- Spring Mail (verificación de email — Mailhog en dev)
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

## Configuración (application.properties)

```properties
server.port=8081
spring.application.name=auth-service

# PostgreSQL — schema: auth
# SIN default para la password: en local usar el perfil "local"
spring.datasource.url=jdbc:postgresql://${POSTGRES_HOST:localhost}:5432/${POSTGRES_DB:pesito}
spring.datasource.username=${AUTH_DB_USER:auth_user}
spring.datasource.password=${AUTH_DB_PASSWORD}

# JPA — Flyway es quien crea y migra el schema, Hibernate solo valida
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.properties.hibernate.default_schema=auth

# Flyway — scripts en src/main/resources/db/migration/
spring.flyway.schemas=auth
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true

# RabbitMQ
spring.rabbitmq.host=${RABBITMQ_HOST:localhost}
spring.rabbitmq.username=${RABBITMQ_USER:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}

# Eureka
eureka.client.service-url.defaultZone=http://${EUREKA_HOST:localhost}:8761/eureka

# Secretos — SIN defaults: el servicio no arranca si faltan.
# SecretsValidator (perfil != local) además rechaza valores cortos o de ejemplo.
jwt.secret=${JWT_SECRET}
app.encryption.secret=${APP_ENCRYPTION_SECRET}
app.internal-api-secret=${INTERNAL_API_SECRET}

# Actuator
management.endpoints.web.exposure.include=health,info,prometheus
```

> Los valores de desarrollo viven en `application-local.properties` (perfil `local`,
> activado con `mvn spring-boot:run "-Dspring-boot.run.profiles=local"`). Docker/k8s
> usan el perfil `docker` y exigen las env vars reales.

---

## Endpoints REST

| Método | Path | Autenticación | Descripción |
|--------|------|:---:|-------------|
| `POST` | `/api/auth/register` | ❌ | Registro — valida password: mín. 8 chars, mayúscula, minúscula y número |
| `POST` | `/api/auth/login` | ❌ | Login, devuelve JWT |
| `GET` | `/api/auth/validate` | ❌ | Validar token |
| `GET` | `/api/auth/verify-email` | ❌ | Verificación de email (link del mail) |
| `POST` | `/api/auth/resend-verification` | ❌ | Reenviar mail de verificación |
| `GET/POST` | `/oauth2/**`, `/login/oauth2/**` | ❌ | Flujo OAuth2 con Google/GitHub (redirect) |
| `GET` | `/api/auth/profile` | ✅ JWT | Obtener perfil (API keys enmascaradas) |
| `PUT` | `/api/auth/profile` | ✅ JWT | Actualizar perfil — campos omitidos no se tocan; key vacía = borrar |
| `POST` | `/api/auth/change-password` | ✅ JWT | Cambiar contraseña |
| `DELETE` | `/api/auth/profile` | ✅ JWT | Eliminar cuenta (publica `user.deleted`) |
| `GET` | `/internal/users/{userId}/api-keys` | 🔒 `X-Internal-Secret` | Devuelve las API keys del usuario **descifradas**, para uso exclusivo de ai-service |

**Nota:** Los endpoints marcados con ✅ JWT leen el header `X-User-Id` inyectado por el Gateway.
No necesitan re-validar el JWT.

**Nota:** El endpoint `/internal/**` no está expuesto por el API Gateway (no hay ruta
`/internal/**` configurada) y solo es alcanzable container-to-container dentro de la
red de Docker. Su seguridad no depende de Spring Security (está en `permitAll()`),
sino de la validación del header `X-Internal-Secret` contra `app.internal-api-secret`
dentro del propio controller, con **comparación constant-time**
(`MessageDigest.isEqual`) para no filtrar el secreto vía timing attack.

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

**Importante:** Las API keys del usuario (Claude, OpenAI, Gemini) NO van en el JWT
y el frontend nunca las envía en los requests al ai-service. El ai-service las
obtiene llamando internamente a `GET /internal/users/{userId}/api-keys` de
auth-service usando el `userId` (header `X-User-Id`).

---

## API Keys de IA: cifrado en reposo y resolución interna

Las API keys de IA del usuario (`apiKeyClaude`, `apiKeyOpenai`, `apiKeyGemini`) se
guardan **cifradas con AES-256-GCM** en `auth.profiles`
(`ApiKeyEncryptionUtil` + `EncryptedStringConverter`, formato
`Base64(IV[12] || ciphertext+authTag)`, clave derivada de `app.encryption.secret`
vía PBKDF2). Filas legacy con `''` (anteriores al cifrado) se tratan como
ausencia de key.

- `GET /api/auth/profile` devuelve la key **enmascarada** (`sk-p...****jikA`,
  primeros 4 + últimos 4 caracteres) — nunca el valor real, solo para mostrarla
  en Ajustes.
- `PUT /api/auth/profile`: si el valor recibido coincide con la versión
  enmascarada de la key actual (es decir, el usuario guardó el formulario sin
  re-tipear la key), se ignora y se conserva la key real almacenada. Solo se
  sobreescribe si el usuario envía un valor nuevo distinto, o vacío para borrarla.
- `GET /internal/users/{userId}/api-keys`: devuelve las keys **descifradas**,
  protegido por el header `X-Internal-Secret` (config `app.internal-api-secret`,
  env `INTERNAL_API_SECRET`, compartido con ai-service). Lo usa exclusivamente
  ai-service para resolver la key del usuario al llamar a Claude/OpenAI/Gemini,
  sin que la key real pase nunca por el frontend ni por el API Gateway.

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
- Spring Security + JWT propio

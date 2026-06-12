# api-gateway
## API Gateway — Spring Cloud Gateway + Resilience4J

---

## Responsabilidad

Único punto de entrada público de toda la arquitectura. Se encarga de:
- **Enrutamiento:** redirige cada request al microservicio correcto según el path
- **Autenticación:** valida el JWT en cada request antes de enrutar
- **Resiliencia:** Circuit Breaker, Retry y Rate Limiter via Resilience4J
- **CORS:** configura las políticas para el frontend Next.js
- **Load Balancing:** si hubiera múltiples instancias de un servicio, Eureka provee el LB

---

## Configuración

**Stack:**
- Spring Boot 3.x
- Spring Cloud Gateway (reactivo, basado en WebFlux)
- Spring Cloud Netflix Eureka Client
- Resilience4J Spring Cloud Circuit Breaker
- Puerto: `8080`

**Dependencias Maven requeridas:**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-reactor-resilience4j</artifactId>
</dependency>
```

---

## Rutas configuradas (application.properties)

```properties
# Auto-discovery via Eureka (útil para desarrollo)
spring.cloud.gateway.discovery.locator.enabled=true
spring.cloud.gateway.discovery.locator.lower-case-service-id=true

# Ruta: auth-service
spring.cloud.gateway.routes[0].id=auth-service
spring.cloud.gateway.routes[0].uri=lb://auth-service
spring.cloud.gateway.routes[0].predicates[0]=Path=/api/auth/**

# Ruta: transaction-service
spring.cloud.gateway.routes[1].id=transaction-service
spring.cloud.gateway.routes[1].uri=lb://transaction-service
spring.cloud.gateway.routes[1].predicates[0]=Path=/api/transactions/**

# Ruta: ai-service
spring.cloud.gateway.routes[2].id=ai-service
spring.cloud.gateway.routes[2].uri=lb://ai-service
spring.cloud.gateway.routes[2].predicates[0]=Path=/api/ai/**

# Rutas adicionales: /api/rates (transaction-service) y OAuth2
# (/oauth2/**, /login/oauth2/** → auth-service)
```

Los filtros `CircuitBreaker` + `Retry` están aplicados por ruta (config Java en
`ResilienceConfig.java`) con fallbacks en `FallbackController.java`.

---

## CORS

```properties
# Origins configurables por env var; whitelist explícita de headers.
# X-User-Id NO se acepta del navegador: lo inyecta el gateway desde el JWT.
spring.cloud.gateway.globalcors.cors-configurations.[/**].allowedOrigins=${CORS_ALLOWED_ORIGINS:http://localhost:3001,http://localhost:3000}
spring.cloud.gateway.globalcors.cors-configurations.[/**].allowedMethods=GET,POST,PUT,DELETE,OPTIONS
spring.cloud.gateway.globalcors.cors-configurations.[/**].allowedHeaders=Authorization,Content-Type
```

> En la práctica el browser casi no golpea el gateway directo: el frontend usa un
> proxy server-side de Next.js. CORS solo aplica a las redirecciones OAuth2 y a
> clientes que llamen al gateway desde un navegador.

---

## Resilience4J — Configuración por servicio

```properties
# Circuit Breaker — auth-service
resilience4j.circuitbreaker.instances.auth-service.sliding-window-size=10
resilience4j.circuitbreaker.instances.auth-service.failure-rate-threshold=50
resilience4j.circuitbreaker.instances.auth-service.wait-duration-in-open-state=10s

# Circuit Breaker — transaction-service
resilience4j.circuitbreaker.instances.transaction-service.sliding-window-size=10
resilience4j.circuitbreaker.instances.transaction-service.failure-rate-threshold=50
resilience4j.circuitbreaker.instances.transaction-service.wait-duration-in-open-state=10s

# Circuit Breaker — ai-service
resilience4j.circuitbreaker.instances.ai-service.sliding-window-size=5
resilience4j.circuitbreaker.instances.ai-service.failure-rate-threshold=60
resilience4j.circuitbreaker.instances.ai-service.wait-duration-in-open-state=15s
```

> Los nombres de instancia (`auth-service`, `transaction-service`, `ai-service`) deben coincidir con el `name` del filtro `CircuitBreaker` en cada ruta.

---

## Filtro JWT (`JwtAuthenticationFilter`)

Filtro global (`GlobalFilter`, order -100) que:
1. Extrae el token del header `Authorization: Bearer {jwt}`
2. Valida la firma con la clave secreta compartida con auth-service (`JWT_SECRET`)
3. Si es válido: **setea** el header `X-User-Id` con el claim `userId` del token —
   `headers.set()` pisa cualquier `X-User-Id` spoofeado por el cliente
4. Si falta o es inválido: devuelve `401 Unauthorized` inmediatamente
5. Paths públicos exentos: `/api/auth/login`, `/api/auth/register`, `/api/auth/validate`,
   `/api/auth/verify-email`, `/oauth2/`, `/login/oauth2/`, `/actuator`

## Validación de secretos al arrancar

`SecretsValidator` (perfil `!local`) corta el arranque si `JWT_SECRET` falta, tiene
menos de 32 caracteres o conserva un valor de ejemplo/desarrollo.
El valor de desarrollo vive en `application-local.properties` (perfil `local`).

---

## Endpoints de Fallback

Cuando un Circuit Breaker está abierto, el Gateway redirige a `/fallback/{service}`:

```
GET /fallback/auth         → 503 { "error": "Servicio de autenticación no disponible" }
GET /fallback/transactions → 503 { "error": "Servicio de transacciones no disponible" }
GET /fallback/ai           → 200 { "message": "El asistente AI no está disponible. Podés registrar transacciones manualmente." }
```

---

## Métricas expuestas

- `/actuator/prometheus` → métricas de Resilience4J (estado de circuit breakers, contadores de retry)
- `/actuator/health` → estado general del gateway

**Métricas clave en Grafana:**
- `resilience4j_circuitbreaker_state` (0=CLOSED, 1=OPEN, 2=HALF_OPEN)
- `resilience4j_circuitbreaker_calls_total` (por outcome: success, failure, timeout)
- `spring_cloud_gateway_requests_seconds` (latencia por ruta)

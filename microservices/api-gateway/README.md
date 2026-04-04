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
```

> **TODO (Fase 3):** agregar filtros `CircuitBreaker` a cada ruta y crear endpoints de fallback en `FallbackController.java`.

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

## Filtro JWT personalizado

El Gateway incluye un filtro global que:
1. Extrae el token del header `Authorization: Bearer {jwt}`
2. Valida la firma usando la clave secreta compartida con auth-service
3. Si es válido: agrega headers `X-User-Id` y `X-User-Email` al request downstream
4. Si es inválido: devuelve `401 Unauthorized` inmediatamente
5. Rutas exentas de JWT: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/oauth/**`

```java
// Lógica del filtro (pseudocódigo para implementar):
// GatewayFilter → extract JWT → validate → mutate request con X-User-Id → chain.filter()
```

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

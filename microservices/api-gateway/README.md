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

## Rutas configuradas (application.yml)

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: auth-service
          uri: lb://AUTH-SERVICE          # lb:// usa Eureka para resolución
          predicates:
            - Path=/api/auth/**
          filters:
            - name: CircuitBreaker
              args:
                name: authCircuitBreaker
                fallbackUri: forward:/fallback/auth

        - id: transaction-service
          uri: lb://TRANSACTION-SERVICE
          predicates:
            - Path=/api/transactions/**
          filters:
            - name: CircuitBreaker
              args:
                name: txCircuitBreaker
                fallbackUri: forward:/fallback/transactions
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200

        - id: ai-service
          uri: lb://AI-SERVICE
          predicates:
            - Path=/api/ai/**
          filters:
            - name: CircuitBreaker
              args:
                name: aiCircuitBreaker
                fallbackUri: forward:/fallback/ai
```

---

## Resilience4J — Configuración por servicio

```yaml
resilience4j:
  circuitbreaker:
    instances:
      authCircuitBreaker:
        slidingWindowSize: 10
        failureRateThreshold: 50        # Abre si 50% de calls fallan
        waitDurationInOpenState: 10s    # Espera 10s antes de pasar a HALF_OPEN
        permittedCallsInHalfOpenState: 3

      txCircuitBreaker:
        slidingWindowSize: 20
        failureRateThreshold: 50
        waitDurationInOpenState: 15s

      aiCircuitBreaker:
        slidingWindowSize: 5
        failureRateThreshold: 60
        waitDurationInOpenState: 30s   # AI puede tardar más en recuperarse
        slowCallRateThreshold: 80
        slowCallDurationThreshold: 25s  # Calls > 25s se consideran "lentas"

  retry:
    instances:
      authCircuitBreaker:
        maxAttempts: 3
        waitDuration: 500ms
      txCircuitBreaker:
        maxAttempts: 2
        waitDuration: 200ms
      aiCircuitBreaker:
        maxAttempts: 1                  # AI no se reintenta (idempotencia no garantizada)
```

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

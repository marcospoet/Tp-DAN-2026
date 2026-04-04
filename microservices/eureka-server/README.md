# eureka-server
## Service Discovery — Spring Cloud Netflix Eureka

---

## Responsabilidad

Servidor central de registro de servicios. Todos los microservicios (auth, transaction, ai, gateway)
se registran aquí al iniciar. Permite que se descubran entre sí por nombre en lugar de por IP/puerto fijo.

---

## Configuración

**Stack:**
- Spring Boot 3.x
- Spring Cloud Netflix Eureka Server
- Puerto: `8761`

**Dependencias Maven requeridas:**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
```

**application.properties:**
```properties
server.port=8761
spring.application.name=eureka-server

# El servidor no se registra a sí mismo ni busca otros servidores Eureka
eureka.client.register-with-eureka=false
eureka.client.fetch-registry=false

# Reduce el tiempo de espera al arrancar sin clientes conectados
eureka.server.wait-time-in-ms-when-sync-empty=0

# Actuator
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=always
```

**Clase principal:**
```java
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication { ... }
```

---

## URL de la UI

`http://localhost:8761` → muestra todos los servicios registrados con su estado (UP/DOWN)

---

## Cómo se registran los clientes

Cada microservicio incluye en su `application.properties`:
```properties
eureka.client.service-url.defaultZone=http://${EUREKA_HOST:localhost}:8761/eureka
```

Y en sus dependencias Maven:
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

---

## Orden de arranque

**Debe arrancar ANTES que cualquier otro microservicio.**
En docker-compose: todos los servicios tienen `depends_on: eureka-server`.

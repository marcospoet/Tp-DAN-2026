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

**application.yml:**
```yaml
server:
  port: 8761

eureka:
  instance:
    hostname: eureka-server
  client:
    register-with-eureka: false   # El servidor no se registra a sí mismo
    fetch-registry: false
  server:
    enable-self-preservation: false  # Simplifica el desarrollo local
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

Cada microservicio incluye en su `application.yml`:
```yaml
eureka:
  client:
    service-url:
      defaultZone: http://eureka-server:8761/eureka/
  instance:
    prefer-ip-address: true
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

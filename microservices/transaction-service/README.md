# transaction-service
## Transacciones Financieras, Cotizaciones y Exportación

---

## Responsabilidad

Contexto de dominio: **Finanzas y Transacciones**

Es la única fuente de verdad sobre las transacciones económicas del usuario.
Ningún otro servicio puede leer ni escribir en las tablas `txn.transactions` o `txn.receipts`.

---

## Stack

- Spring Boot 3.x
- Spring Data JPA + Hibernate
- PostgreSQL (schema: `txn`)
- Spring Cloud Netflix Eureka Client
- Spring Boot Actuator + Micrometer
- Resilience4J (para llamadas a DolarAPI externo)
- MinIO Client (o AWS S3 SDK) para comprobantes
- Spring AMQP (RabbitMQ)
- Puerto: `8082`

---

## Dependencias Maven requeridas

```xml
<dependency>spring-boot-starter-web</dependency>
<dependency>spring-boot-starter-data-jpa</dependency>
<dependency>org.postgresql:postgresql</dependency>
<dependency>spring-cloud-starter-netflix-eureka-client</dependency>
<dependency>spring-boot-starter-amqp</dependency>
<dependency>spring-boot-starter-actuator</dependency>
<dependency>io.micrometer:micrometer-registry-prometheus</dependency>
<dependency>net.logstash.logback:logstash-logback-encoder:7.4</dependency>

<!-- Resilience4J para llamadas a DolarAPI -->
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
</dependency>

<!-- Para exportación CSV (Apache Commons CSV) -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-csv</artifactId>
    <version>1.10.0</version>
</dependency>

<!-- Para exportación PDF (OpenPDF o Flying Saucer) -->
<dependency>
    <groupId>com.github.librepdf</groupId>
    <artifactId>openpdf</artifactId>
    <version>1.3.30</version>
</dependency>

<!-- MinIO SDK para comprobantes -->
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.7</version>
</dependency>
```

---

## Configuración (application.properties)

```properties
server.port=8082
spring.application.name=transaction-service

# PostgreSQL — schema: txn
# txn_user solo tiene acceso al schema txn, no al schema auth
spring.datasource.url=jdbc:postgresql://${POSTGRES_HOST:localhost}:5432/${POSTGRES_DB:budgetbuddy}
spring.datasource.username=${TXN_DB_USER:txn_user}
spring.datasource.password=${TXN_DB_PASSWORD:txn_pass}
spring.datasource.driver-class-name=org.postgresql.Driver

spring.jpa.hibernate.ddl-auto=validate
spring.jpa.properties.hibernate.default_schema=txn

# Flyway
spring.flyway.schemas=txn
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true

# RabbitMQ
# Consume: user.deleted | Publica: transaction.created, budget.threshold.exceeded
spring.rabbitmq.host=${RABBITMQ_HOST:localhost}
spring.rabbitmq.port=5672
spring.rabbitmq.username=${RABBITMQ_USER:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}

# Eureka
eureka.client.service-url.defaultZone=http://${EUREKA_HOST:localhost}:8761/eureka

# Actuator
management.endpoints.web.exposure.include=health,info,prometheus
management.endpoint.health.show-details=always
```

> **TODO:** agregar configuración de MinIO, DolarAPI y Resilience4J cuando se implementen esas funcionalidades.

---

## Endpoints REST

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/api/transactions` | Listar transacciones (paginadas, con filtros) |
| `POST` | `/api/transactions` | Crear transacción |
| `GET` | `/api/transactions/{id}` | Obtener transacción por ID |
| `PUT` | `/api/transactions/{id}` | Actualizar transacción |
| `DELETE` | `/api/transactions/{id}` | Eliminar transacción |
| `GET` | `/api/transactions/summary` | Totales del período (para summary cards) |
| `GET` | `/api/transactions/rates` | Cotizaciones actuales (proxy DolarAPI) |
| `POST` | `/api/transactions/{id}/receipt` | Subir comprobante (multipart) |
| `GET` | `/api/transactions/{id}/receipt` | URL firmada del comprobante |
| `GET` | `/api/transactions/export/csv` | Exportar CSV del período |
| `GET` | `/api/transactions/export/pdf` | Exportar PDF del período |

**Parámetros de query para listado:**
- `period`: `week` | `month` | `year` | `custom`
- `from` / `to`: fechas para period=custom (ISO 8601)
- `page` / `size`: paginación
- `type`: `income` | `expense` (filtro opcional)
- `search`: búsqueda por descripción/categoría

**Todos los endpoints leen `X-User-Id` del header** (inyectado por el Gateway).

---

## Proxy de Cotizaciones (DolarAPI)

El servicio cachea las cotizaciones en memoria por 5 minutos para evitar llamar a DolarAPI
en cada request de un usuario.

```
DolarAPI responde: [ { casa: "blue", compra: 1200, venta: 1250 }, ... ]
                              ↓ (con Resilience4J Retry + Circuit Breaker)
transaction-service cachea en Map<String, Rate> por 5 minutos
                              ↓
GET /api/transactions/rates → { blue: 1250, oficial: 1080, tarjeta: 1350, mep: 1230 }
```

**Fallback cuando DolarAPI no responde:**
1. Devuelve la última cotización cacheada
2. Si no hay cache → devuelve `null` para cada tipo (el frontend muestra "No disponible")

---

## Regla de negocio: txRate es inmutable

Al crear una transacción con `currency: "USD"`, se debe:
1. Tomar la cotización actual del tipo elegido (blue, oficial, tarjeta, mep, manual)
2. Guardar ese valor en `tx_rate` junto con `exchange_rate_type`
3. Una vez guardado, `tx_rate` NUNCA se actualiza aunque la cotización cambie

El campo `amount_usd` se calcula como: `amount (ARS) / tx_rate`

---

## Eventos consumidos de RabbitMQ

```
user.deleted → elimina todas las transacciones donde user_id = {userId}
               también elimina los archivos de comprobantes en MinIO
```

---

## Eventos publicados en RabbitMQ

```json
// transaction.created
{
  "transactionId": "uuid",
  "userId": "uuid",
  "type": "expense",
  "amount": 4200,
  "currency": "ARS",
  "category": "Comida",
  "date": "2025-04-15",
  "timestamp": "2025-04-15T10:30:00Z"
}

// budget.threshold.exceeded
{
  "userId": "uuid",
  "monthlyBudget": 150000,
  "currentExpenses": 135000,
  "percentage": 90,
  "timestamp": "2025-04-15T10:30:00Z"
}
```

**Nota:** `budget.threshold.exceeded` se verifica después de cada `POST /api/transactions`.
Se necesita el `monthly_budget` del perfil del usuario: se obtiene llamando a auth-service
via REST (GET `/api/auth/profile/{userId}`) o se envía en el JWT.

---

## Flyway — Migraciones

```
V1__create_schema.sql             → CREATE SCHEMA txn
V2__create_transactions_table.sql → CREATE TABLE txn.transactions (con todos los índices)
V3__create_receipts_table.sql     → CREATE TABLE txn.receipts
```

---

## Origen en el proyecto actual

La lógica que migra a este servicio viene de:
- `lib/app-context.tsx` → funciones: `addTransaction()`, `updateTransaction()`, `deleteTransaction()`, `loadTransactions()`
- `hooks/use-exchange-rate.ts` → integración con DolarAPI
- `components/analytics-page.tsx` → lógica de exportación CSV/PDF (funciones `handleExportCsv()`, `handleExportPdf()`)
- Modelo: `Transaction` interface en `lib/app-context.tsx`

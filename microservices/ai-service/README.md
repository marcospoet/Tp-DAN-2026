# ai-service
## Procesamiento de IA, Chat Conversacional y Analytics

---

## Responsabilidad

Contexto de dominio: **Inteligencia Artificial y Analytics**

Centraliza toda la interacción con modelos de lenguaje (Claude, OpenAI, Gemini).
Gestiona el historial de conversaciones en MongoDB y computa las métricas de analytics.
No persiste transacciones directamente: devuelve el resultado parseado al cliente.

---

## Stack

- Spring Boot 3.x
- Spring Data MongoDB
- MongoDB (colecciones propias: chat_sessions, analytics_cache)
- PostgreSQL (schema `ai`, vía Spring Data JDBC + Flyway) — exclusivo para RAG/pgvector
- Spring Cloud Netflix Eureka Client
- Spring Boot Actuator + Micrometer
- Spring AMQP (RabbitMQ)
- WebClient (para llamadas a APIs externas: Anthropic, OpenAI, Google)
- Apache PDFBox (extracción de texto de PDFs para la knowledge base RAG)
- Puerto: `8083`

---

## Dependencias Maven requeridas

```xml
<dependency>spring-boot-starter-web</dependency>
<dependency>spring-boot-starter-data-mongodb</dependency>
<dependency>spring-cloud-starter-netflix-eureka-client</dependency>
<dependency>spring-boot-starter-amqp</dependency>
<dependency>spring-boot-starter-actuator</dependency>
<dependency>io.micrometer:micrometer-registry-prometheus</dependency>
<dependency>net.logstash.logback:logstash-logback-encoder:7.4</dependency>

<!-- WebClient para llamadas a APIs de IA -->
<dependency>spring-boot-starter-webflux</dependency>

<!-- Para manejo de imágenes (compresión, base64) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>

<!-- PDF rendering / extracción de texto (vision + RAG) -->
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.1</version>
</dependency>

<!-- RAG — pgvector (PostgreSQL), schema "ai" -->
<dependency>spring-boot-starter-jdbc</dependency>
<dependency>org.postgresql:postgresql</dependency>      <!-- runtime -->
<dependency>org.flywaydb:flyway-core</dependency>
<dependency>com.pgvector:pgvector:0.1.6</dependency>
```

---

## Configuración (application.properties)

```properties
server.port=8083
spring.application.name=ai-service

# MongoDB — única base de datos de este servicio (sin acceso a PostgreSQL)
# Colecciones: chat_sessions, chat_messages, analytics_cache
spring.data.mongodb.uri=mongodb://${MONGO_USER:ai_user}:${MONGO_PASSWORD:ai_pass}@${MONGO_HOST:localhost}:27017/ai_db?authSource=admin

# RabbitMQ
# Consume: transaction.created (invalida cache de analytics)
spring.rabbitmq.host=${RABBITMQ_HOST:localhost}
spring.rabbitmq.port=5672
spring.rabbitmq.username=${RABBITMQ_USER:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}

# Eureka
eureka.client.service-url.defaultZone=http://${EUREKA_HOST:localhost}:8761/eureka

# RAG — pgvector (PostgreSQL), schema "ai"
# Knowledge base estática (Markdown/PDF) indexada bajo demanda
spring.datasource.url=jdbc:postgresql://${POSTGRES_HOST:localhost}:5432/${POSTGRES_DB:pesito}?currentSchema=ai,public
spring.datasource.username=${AI_DB_USER:ai_db_user}
spring.datasource.password=${AI_DB_PASSWORD:ai_pass}
spring.flyway.schemas=ai
spring.flyway.default-schema=ai

# Actuator
management.endpoints.web.exposure.include=health,info,prometheus
management.endpoint.health.show-details=always
```

---

## Endpoints REST

| Método | Path | Descripción |
|--------|------|-------------|
| `POST` | `/api/ai/parse` | Parsear texto/imagen/audio → transacción(es) |
| `POST` | `/api/ai/chat` | Mensaje conversacional → respuesta del asistente |
| `GET` | `/api/ai/chat/history` | Historial de mensajes del usuario |
| `DELETE` | `/api/ai/chat/history` | Limpiar historial |
| `GET` | `/api/ai/analytics/summary` | Resumen financiero del período |
| `GET` | `/api/ai/analytics/trends` | Datos para gráfico de tendencias (12 meses) |
| `GET` | `/api/ai/analytics/categories` | Breakdown por categoría (para PieChart) |
| `GET` | `/api/ai/analytics/heatmap` | Datos para heatmap de gastos diarios |
| `POST` | `/api/ai/detect/update` | Detectar intención de modificar transacción |
| `POST` | `/api/ai/detect/delete` | Detectar intención de eliminar transacción |
| `POST` | `/api/ai/detect/recurring` | Detectar intención de marcar como recurrente |

**Todos los endpoints leen `X-User-Id` del header** (inyectado por el Gateway).

---

## Flujo de Parseo (POST /api/ai/parse)

```
Cliente envía: { text: "café 800", attachments: [], apiKey: "sk-ant-...", provider: "claude" }
      ↓
ai-service valida formato de la API key (prefijo: sk-ant-, sk-, AIza)
      ↓
Construye el prompt con instrucciones + validaciones de injection
      ↓
Llama a la API del proveedor (con timeout de 30s)
      ↓
Recibe JSON: { transactions: [{ description, amount, type, category, icon, daysAgo, currency }] }
      ↓
Devuelve al cliente: la lista de transacciones parseadas (sin persistir)
      ↓
El cliente llama a transaction-service para persistir cada una
```

**Importante:** ai-service NO llama a transaction-service directamente para crear la transacción.
El cliente (frontend) recibe el objeto parseado y decide si lo persiste. Esto evita acoplamiento
entre servicios y permite que el usuario revise antes de guardar.

---

## Flujo de Analytics (GET /api/ai/analytics/*)

El ai-service necesita los datos de transacciones para calcular analytics.
Hay dos estrategias posibles (elegir una):

### Opción A: Llamada REST a transaction-service (recomendado para el TP)
```
GET /api/ai/analytics/summary
      ↓
ai-service llama internamente a: GET http://transaction-service/api/transactions/summary
      ↓
transaction-service devuelve los datos agregados
      ↓
ai-service aplica lógica de analytics (proyecciones, comparativas)
      ↓
Guarda resultado en analytics_cache (MongoDB) con TTL
      ↓
Devuelve al cliente
```

### Opción B: Recibir datos del evento (más desacoplado, más complejo)
- Consumir `transaction.created` events y mantener un agregado en MongoDB
- Más complejo pero evita llamadas síncronas entre servicios internos

**Para el TP se recomienda Opción A** por simplicidad y claridad conceptual.

---

## Contexto financiero para el chat

Cuando el usuario envía un mensaje al chat, ai-service construye un contexto que incluye:

```
- Cotización USD activa: 1 USD = {usdRate} ARS
- Últimas 60 transacciones (obtenidas de transaction-service)
- Resumen mensual: ingresos, gastos, neto, proyección
- Presupuesto mensual y saldo restante (obtenido de auth-service)
- Promedio diario de gastos
- Top 3 categorías del mes
```

Este contexto se envía al LLM como system prompt, junto con el historial de la conversación.

---

## RAG — Knowledge base financiera (search_financial_knowledge)

Además de las tools sobre datos del usuario, el agente cuenta con la tool
`search_financial_knowledge(query)`, que hace búsqueda semántica sobre una
knowledge base estática de entidades financieras argentinas (Mercado Pago,
Ualá, Brubank, Naranja X, AFIP/BCRA, educación financiera) usando **pgvector**.

### Archivos fuente

```
src/main/resources/knowledge-base/
├── markdown/   ← FAQ_MERCADOPAGO.md, FAQ_UALA.md, FAQ_BRUBANK.md,
│                 FAQ_NARANJAX.md, EDUCACION_FINANCIERA.md, AFIP_BCRA.md
└── pdf/        ← vacío (.gitkeep); soportado vía Apache PDFBox
```

### Indexado perezoso (lazy)

No hay indexado al *startup*. Cada vez que el agente invoca
`search_financial_knowledge`, `RagService.ensureIndexed()`:

1. Lee los archivos de `knowledge-base/` (`KnowledgeBaseLoader`).
2. Calcula el hash MD5 de cada archivo y lo compara contra
   `ai.knowledge_sources.content_hash`.
3. Si cambió (o es nuevo): borra los chunks anteriores, lo divide en chunks
   de ~500 palabras con solapamiento de ~50 (`TextChunker`), genera los
   embeddings (`EmbeddingService`, OpenAI `text-embedding-3-small`,
   1536 dims) y los inserta en `ai.knowledge_chunks` (`KnowledgeChunkRepository`,
   vía `com.pgvector.PGvector`).
4. Si no cambió: no hace nada.

Luego embebe la query y busca los 5 chunks más similares por cosine
similarity (`embedding <=> query_vector`).

### API key para embeddings

RAG necesita una API key de **OpenAI** para generar embeddings,
independientemente del proveedor de LLM elegido para el chat:

- `provider=openai` con `apiKey` del usuario → se usa esa key.
- Cualquier otro caso (Claude, Gemini, o sin key de OpenAI) → se usa
  `OPENAI_API_KEY` configurada server-side como fallback.
- Si ninguna está disponible, la tool devuelve
  `{"error": "RAG requiere una API key de OpenAI..."}` y el LLM se lo informa
  al usuario en vez de inventar una respuesta.

### Esquema (Flyway, schema `ai`)

```sql
ai.knowledge_sources (source PK, content_hash, indexed_at)
ai.knowledge_chunks  (id, source, chunk_index, content, embedding vector(1536))
```

El usuario `ai_db_user` solo tiene permisos sobre el schema `ai` (no accede a
`auth`/`txn`). La extensión `vector` se compila desde fuente en la imagen
custom de `infrastructure/postgres/Dockerfile` (pgvector v0.7.4 sobre
`postgres:16-alpine`).

---

## Protección contra Prompt Injection

La lógica de `lib/ai.ts` del proyecto original incluye 89+ patrones de detección de inyección.
Al migrar a ai-service, se debe implementar `sanitizeUserInput()` antes de cada llamada al LLM:
- Strips HTML tags
- Detecta instrucciones del sistema embebidas en texto del usuario
- Rechaza inputs con patrones sospechosos (inglés + español + portugués)

---

## Gestión del Historial de Chat (MongoDB)

```
chat_sessions collection:
  - Creada cuando el usuario inicia una conversación
  - sessionId es único por userId + fecha de inicio

chat_messages collection:
  - Cada mensaje (user o assistant) es un documento
  - Índice por (sessionId, createdAt) para recuperación eficiente
  - Los últimos 50 mensajes se envían al LLM en cada request (rolling window)
```

---

## Eventos consumidos de RabbitMQ

```
transaction.created → invalida el analytics_cache del userId afectado
                      (elimina o marca como inválido el documento en MongoDB)

budget.threshold.exceeded → puede agregar un mensaje proactivo en el chat
                            (próxima implementación)
```

---

## Invalidación de Cache de Analytics

Cuando llega el evento `transaction.created`:
```java
// Pseudocódigo:
analyticsCache.deleteByUserId(userId);
// El próximo GET /api/ai/analytics/* reconstruirá el cache
```

---

## Origen en el proyecto actual

La lógica que migra a este servicio viene de:
- `lib/ai.ts` → funciones: `callAI()`, `callAIChat()`, `callAIUpdateDetect()`, `callAIDeleteDetect()`, `callAIRecurringDetect()`, `callTextAI()`, `sanitizeUserInput()`, `validateKeyFormat()`
- `hooks/use-chat-handler.ts` → `buildFinancialContext()`, routing de intenciones (DELETE_WORDS, MODIFY_WORDS, RECURRING_WORDS), `findTransactionByMatch()`
- `components/analytics-page.tsx` → cálculos de tendencias anuales, proyecciones, breakdown por categoría
- Modelo: `ChatMessage` interface en `components/dashboard/shared.tsx`

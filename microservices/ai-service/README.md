# ai-service
## Procesamiento de IA, Agente Conversacional, RAG y Memoria

---

## Responsabilidad

Contexto de dominio: **Inteligencia Artificial**

Centraliza toda la interacción con modelos de lenguaje (Claude, OpenAI, Gemini).
Implementa un **agente con tool calling** sobre los datos del usuario, una knowledge
base **RAG con pgvector** (embeddings por proveedor), **memoria semántica de largo
plazo** en MongoDB y un **perfil financiero** generado por LLM que persiste entre sesiones.

Las API keys de los proveedores son **siempre por usuario**: las resuelve llamando al
endpoint interno de auth-service (nunca hay claves server-side ni viajan desde el frontend).

---

## Stack

- Spring Boot 3.x
- Spring Data MongoDB (colecciones: `chat_sessions`, `chat_memories`, `agent_profiles`)
- PostgreSQL (schema `ai`, vía Spring JDBC + Flyway) — exclusivo para RAG/pgvector
- Spring Cloud Netflix Eureka Client
- Spring Boot Actuator + Micrometer
- Spring AMQP (RabbitMQ)
- WebClient (llamadas a Anthropic, OpenAI, Google y Langfuse)
- Apache PDFBox (render de PDFs a imagen para visión + extracción de texto para RAG)
- Caffeine (cache de API keys de usuario, TTL 60s)
- Bean Validation (`@Valid` en todos los DTOs de entrada)
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

<!-- Bean Validation — @Valid en los controllers + constraints en DTOs -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>

<!-- Cache Caffeine — API keys de usuario (TTL 60s) -->
<dependency>spring-boot-starter-cache</dependency>
<dependency>com.github.ben-manes.caffeine:caffeine</dependency>

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

# MongoDB — chat, memoria de largo plazo y perfiles del agente
# SIN default para la password: en local usar el perfil "local"
spring.data.mongodb.uri=mongodb://${MONGO_USER:ai_user}:${MONGO_PASSWORD}@${MONGO_HOST:localhost}:27017/ai_db?authSource=ai_db

# RabbitMQ — consume transaction.created
spring.rabbitmq.host=${RABBITMQ_HOST:localhost}
spring.rabbitmq.username=${RABBITMQ_USER:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}

# Eureka
eureka.client.service-url.defaultZone=http://${EUREKA_HOST:localhost}:8761/eureka

# Tool calling sobre transaction-service y resolución interna de API keys
ai.transaction-service-base-url=http://${TRANSACTION_HOST:localhost}:8082
ai.auth-service-base-url=http://${AUTH_HOST:localhost}:8081
# SIN default: si falta, el servicio no arranca
ai.internal-api-secret=${INTERNAL_API_SECRET}

# Observabilidad del agente — Langfuse (opcional, no-op sin claves)
ai.langfuse-public-key=${LANGFUSE_PUBLIC_KEY:}
ai.langfuse-secret-key=${LANGFUSE_SECRET_KEY:}

# Con DEBUG se loguean prompts/respuestas COMPLETOS (datos sensibles — solo demo/debug)
logging.level.com.pesito.ai.service.AiProviderService=${AI_LLM_LOG_LEVEL:INFO}

# RAG — pgvector (PostgreSQL), schema "ai"
spring.datasource.url=jdbc:postgresql://${POSTGRES_HOST:localhost}:5432/${POSTGRES_DB:pesito}?currentSchema=ai,public
spring.datasource.username=${AI_DB_USER:ai_db_user}
spring.datasource.password=${AI_DB_PASSWORD}
spring.flyway.schemas=ai

# Actuator
management.endpoints.web.exposure.include=health,info,prometheus
```

> Los valores de desarrollo (passwords `admin`, secreto interno dev) viven en
> `application-local.properties`, activado con `mvn spring-boot:run "-Dspring-boot.run.profiles=local"`.

---

## Endpoints REST

| Método | Path | Descripción |
|--------|------|-------------|
| `POST` | `/api/ai/parse` | Parsear texto/imagen/PDF → transacción(es) JSON |
| `POST` | `/api/ai/chat` | Mensaje conversacional → agente con tools y memoria |
| `POST` | `/api/ai/detect-intent` | Detectar intención: `update`, `delete`, `recurring` o `csv` |
| `POST` | `/api/ai/csv-mapping` | Identificar columnas de un CSV bancario |
| `POST` | `/api/ai/transcribe` | Transcribir audio (OpenAI Whisper) |
| `POST` | `/api/ai/embeddings/migrate` | Re-embeber KB + memorias con el proveedor nuevo (202, background) |
| `POST` | `/api/ai/embeddings/pause` | Pausar la búsqueda semántica de documentos ("solo chatear") |

**Todos los endpoints exigen el header `X-User-Id`** (lo inyecta el Gateway desde el
JWT y pisa cualquier valor del cliente; el `userId` del body se ignora siempre).
Los DTOs de entrada se validan con Bean Validation (`@Size` en mensajes y adjuntos,
límite de 100 KB en `financialContext`); los errores devuelven 400 con `{"error": "..."}`.

---

## Resolución de API keys por usuario

```
POST /api/ai/chat (X-User-Id: <uuid>)
      ↓
UserApiKeysClient → GET http://auth-service:8081/internal/users/{userId}/api-keys
                    (header X-Internal-Secret = INTERNAL_API_SECRET)
      ↓
auth-service descifra las keys (AES-256-GCM) y las devuelve
      ↓
ai-service cachea el resultado 60s (Caffeine) y usa la key del proveedor activo
```

Si el usuario no configuró key para el proveedor elegido, el endpoint responde
`400 {"error": "No configuraste tu clave de API para <provider>. Andá a Ajustes → Cuenta."}`.

---

## Agente conversacional (POST /api/ai/chat)

El chat es un **agente con tool calling**: el LLM decide qué tools invocar en un loop
hasta producir la respuesta final. Tools registradas (`ToolRegistry`):

| Tool | Qué hace |
|---|---|
| `get_transactions` | Lista transacciones del usuario (devuelve ids para update/delete) |
| `get_monthly_summary` | Resumen del mes (ingresos, gastos, por categoría) |
| `get_account_balances` | Balance por cuenta / medio de pago |
| `get_exchange_rate` | Cotización del dólar vía transaction-service (DolarAPI) |
| `create_transaction` | Crea una transacción |
| `update_transaction` | Modifica una transacción existente |
| `delete_transaction` | Elimina — **exige `confirmed=true`**: el chequeo está en código, no solo en el prompt |
| `search_financial_knowledge` | Búsqueda semántica en la knowledge base RAG |
| `search_conversation_history` | Búsqueda semántica en la memoria de largo plazo |

El system prompt incluye el contexto financiero enviado por el frontend, el
**perfil histórico** del usuario (`agent_profiles`) y reglas anti prompt-injection.
El frontend ofrece dos modos: **Asistente** (detección de intents + registro rápido)
y **Asesor** (directo al agente conversacional).

---

## Memoria semántica de largo plazo

Cada mensaje relevante del chat (≥25 caracteres, no trivial) se embebe con el proveedor
activo y se guarda en `chat_memories` (máx. 1000 por usuario, guardado asíncrono best-effort).
La tool `search_conversation_history` recupera los top-5 por similitud de coseno
(calculada en Java, solo entre vectores del mismo proveedor).

El **perfil financiero** (`agent_profiles`) lo genera el LLM resumiendo los datos del
usuario; se regenera cada 30 días y se inyecta al system prompt en cada sesión nueva.

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
   `ai.knowledge_sources.content_hash` (por proveedor).
3. Si cambió (o es nuevo): borra los chunks anteriores, lo divide en chunks
   de ~500 palabras con solapamiento de ~50 (`TextChunker`), genera los
   embeddings y los inserta en `ai.knowledge_chunks` tagueados con el proveedor.
4. Si no cambió: no hace nada.

Luego embebe la query y busca los 5 chunks más similares por cosine
similarity (`embedding <=> query_vector`), filtrando por proveedor.

### Embeddings por proveedor (patrón Strategy)

Los embeddings se generan **con la API key del propio usuario** según su proveedor activo
(`EmbeddingStrategyResolver`):

| Proveedor | Modelo de embeddings | Dimensiones |
|---|---|---|
| OpenAI | `text-embedding-3-small` | 1536 |
| Gemini | `gemini-embedding-001` | 1536 |
| Claude | *(no soporta embeddings)* → degrada a búsqueda por keywords, sin tokens |

Los vectores de OpenAI y Gemini son **incompatibles entre sí** — nunca se comparan
vectores de proveedores distintos. Al cambiar entre OpenAI y Gemini, el frontend ofrece:

- `POST /api/ai/embeddings/migrate` — re-indexa la KB y re-embebe memorias/perfil con el
  proveedor nuevo (202, corre en background, consume tokens de la cuenta nueva).
- `POST /api/ai/embeddings/pause` — flag `documentsPaused`: el chat sigue funcionando
  pero sin búsqueda semántica de documentos (cero tokens).

### Esquema (Flyway, schema `ai`)

```sql
ai.knowledge_sources (source, provider, content_hash, indexed_at)   -- V3: columna provider
ai.knowledge_chunks  (id, source, provider, chunk_index, content, embedding vector(1536))
```

El usuario `ai_db_user` solo tiene permisos sobre el schema `ai` (no accede a
`auth`/`txn`). La extensión `vector` se compila desde fuente en la imagen
custom de `infrastructure/postgres/Dockerfile` (pgvector v0.7.4 sobre
`postgres:16-alpine`).

---

## Protección contra Prompt Injection

`PromptService.sanitizeUserInput()` corre antes de cada llamada al LLM:
- Strip de HTML tags
- Detección de instrucciones del sistema embebidas en el texto del usuario (regex multi-idioma)
- El system prompt refuerza no revelar instrucciones ni ejecutar pedidos meta

> La sanitización por regex es una primera línea de defensa, evadible con unicode/leetspeak.
> La defensa real es que las tools destructivas
> exigen confirmación validada en código.

---

## Persistencia en MongoDB

```
chat_sessions   → sesión por usuario con historial embebido (rolling window de 40 turnos);
                  un scheduler limpia sesiones inactivas
chat_memories   → memoria semántica de largo plazo (embedding + provider + texto)
agent_profiles  → perfil financiero generado por LLM (summary, topCategory,
                  documentsPaused, regenerado cada 30 días)
```

---

## Observabilidad del agente

- **Logs SLF4J**: cada llamada al LLM (`[AGENT]`), cada tool (`[TOOL] name=...`) y los
  tokens por turno y totales (`[USAGE]`). Con `AI_LLM_LOG_LEVEL=DEBUG` se loguean los
  prompts y respuestas completos (datos sensibles — solo demo/debug).
- **Langfuse** (opcional): con `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` configuradas,
  cada conversación genera un trace con spans por LLM call y tool, incluyendo usage.
  Sin claves es un no-op.

---

## Eventos consumidos de RabbitMQ

```
transaction.created → invalida caches dependientes de las transacciones del usuario
```

---

## Origen en el proyecto actual

La lógica que migra a este servicio viene de:
- `lib/ai.ts` → funciones: `callAI()`, `callAIChat()`, `callAIUpdateDetect()`, `callAIDeleteDetect()`, `callAIRecurringDetect()`, `callTextAI()`, `sanitizeUserInput()`, `validateKeyFormat()`
- `hooks/use-chat-handler.ts` → `buildFinancialContext()`, routing de intenciones (DELETE_WORDS, MODIFY_WORDS, RECURRING_WORDS), `findTransactionByMatch()`
- `components/analytics-page.tsx` → cálculos de tendencias anuales, proyecciones, breakdown por categoría
- Modelo: `ChatMessage` interface en `components/dashboard/shared.tsx`

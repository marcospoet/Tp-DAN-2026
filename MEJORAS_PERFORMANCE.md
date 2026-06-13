# ⚡ Mejoras de Performance — Pesito App

> Auditoría: junio 2026 · Estado actual: **6/10**
> Lo que más limita hoy: hilos bloqueados en llamadas a IA y WebClients sin timeout.

---

## 🔴 ALTOS

### PERF-01 · Llamadas a Claude/OpenAI/Gemini bloqueantes (`.block()`)

**Archivo:** `ai-service/.../service/AiProviderService.java:251-260, 316-323, 383-389`

Cada request de chat/parse bloquea un hilo del pool de Tomcat hasta 30 segundos. Con ~100 usuarios concurrentes el servicio se queda sin hilos y deja de responder.

**Fix (de menor a mayor esfuerzo):**

1. **Corto plazo:** aumentar el pool y aislar con thread pool dedicado:
   `@Async("aiExecutor")` + `CompletableFuture` para las llamadas a proveedores.
2. **Largo plazo:** endpoints reactivos (devolver `Mono<ResponseEntity>` sin `.block()`) o virtual threads de Java 21:
   `spring.threads.virtual.enabled=true` (fix de 1 línea, Java 21 ya está).

- [ ] Activar virtual threads (`spring.threads.virtual.enabled=true`) en ai-service
- [ ] Medir con carga (Gatling/k6) antes y después

---

### PERF-02 · WebClients sin timeout → el servicio se cuelga en cascada

**Archivos:**
- `ai-service/.../rag/EmbeddingService.java:32-56` — llamada a OpenAI sin timeout
- `ai-service/.../service/UserApiKeysClient.java:45-50` — llamada a auth-service sin timeout
- `ai-service/.../config/WebClientConfig.java:11` — el WebClient default no configura nada

**Riesgo:** si OpenAI o auth-service se cuelgan, el ai-service se cuelga con ellos (el `.block()` espera indefinidamente).

**Fix:**

```java
HttpClient httpClient = HttpClient.create()
    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 3000)
    .responseTimeout(Duration.ofSeconds(10));
return WebClient.builder()
    .clientConnector(new ReactorClientHttpConnector(httpClient))
    .build();
```

- [ ] Timeout 10s en el WebClient de embeddings
- [ ] Timeout 5s en el WebClient hacia auth-service + fallback al cache de keys
- [ ] Circuit breaker Resilience4j en ambas llamadas

---

### PERF-03 · `FinancialToolsService` trae TODAS las transacciones del usuario

**Archivo:** `ai-service/.../service/FinancialToolsService.java:65`

Cada tool call del chat (balances, resúmenes) descarga la lista completa de transacciones por HTTP. Escala O(n) con el historial del usuario.

**Fix:**
- [ ] Crear endpoint de agregación en transaction-service:
  `GET /api/transactions/summary?from=&to=` → `SUM(amount) GROUP BY account, category`
  (Postgres lo resuelve con el índice `(user_id, date)` que ya existe)
- [ ] Que `getAccountBalances()` consuma ese endpoint en vez de la lista completa

---

### PERF-04 · ai-service con 512Mi de límite en K8s → OOMKill

**Archivo:** `k8s/microservices/ai-service.yaml:70-76`

Maneja embeddings, render de PDFs (PDFBox a 150 DPI) y knowledge base en memoria. 512Mi de límite con `-Xms192m` + `MaxRAMPercentage 75%` es insuficiente bajo carga.

**Fix:**

```yaml
resources:
  requests: { memory: "512Mi", cpu: "250m" }
  limits:   { memory: "1Gi",   cpu: "1000m" }
```

- [ ] Subir límites del ai-service
- [ ] Revisar también transaction-service si se agregan agregaciones

---

### PERF-05 · Transcripción de audio y parsing de PDF síncronos

**Archivos:**
- `ai-service/.../controller/AiController.java:229-249` — `/transcribe` bloquea 5-30s
- `ai-service/.../service/AiProviderService.java:721-731` — render PDF CPU-intensivo

**Fix:**
- [ ] Convertir a job asíncrono: el endpoint devuelve `202 Accepted + jobId`, el trabajo se procesa vía RabbitMQ (ya está en el stack) y el frontend hace polling o recibe el resultado por WebSocket
- [ ] Mientras tanto: límite de tamaño de PDF (ej. 5 MB) y de duración de audio

---

## 🟠 MEDIOS

### PERF-06 · Sin índice vectorial en pgvector (búsqueda RAG O(n))

**Archivo:** `ai-service/.../rag/KnowledgeChunkRepository.java:55-63`

`ORDER BY embedding <=> ?` sin índice = escaneo secuencial de toda la tabla.

**Fix — nueva migración Flyway:**

```sql
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
ON ai.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
```

(HNSW si la versión de pgvector lo soporta; si no, IVFFLAT con `lists = 100`.)

---

### PERF-07 · Sin HPA y `replicas: 1` en todos los servicios

**Archivos:** `k8s/microservices/*.yaml`

- [ ] HPA para gateway, auth y transaction: min 2 / max 5, target CPU 70%
- [ ] Verificar que todos los servicios sean realmente stateless (lo son) ✓

---

### PERF-08 · `ChatService.enforceSessionLimit()` sin paginación

**Archivo:** `ai-service/.../service/ChatService.java:77-81`

Trae todas las sesiones del usuario a memoria solo para borrar las viejas.

- [ ] `findByUserIdOrderByUpdatedAtDesc(userId, PageRequest.of(0, MAX + 1))` y borrar solo el excedente

---

### PERF-09 · Mensajes de chat sin TTL en MongoDB

**Archivos:** `ai-service/.../model/ChatSession.java:49-56`,
`infrastructure/mongodb/init-mongo.js` (TTL solo en `chat_sessions`)

- [ ] Índice TTL en `chat_messages` (ej. 30 días):
  ```js
  db.chat_messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 })
  ```

---

### PERF-10 · Retry de DolarAPI con espera fija

**Archivos:** `transaction-service/.../config/WebClientConfig.java:26`,
`application.properties:57`

- [ ] Backoff exponencial en Resilience4j:
  ```properties
  resilience4j.retry.instances.dolar-api.wait-duration=300ms
  resilience4j.retry.instances.dolar-api.enable-exponential-backoff=true
  resilience4j.retry.instances.dolar-api.exponential-backoff-multiplier=2
  ```

---

## 🟢 BAJOS / BACKLOG

| ID | Hallazgo | Fix |
|---|---|---|
| PERF-11 | Sin cache de embeddings en `RagService.search()` | Cache Caffeine de últimos 500 queries (ahorra ~500ms y costo por búsqueda) |
| PERF-12 | HikariCP con defaults (10 conexiones × 3 servicios) | `maximum-pool-size=5`, `minimum-idle=2`, `connection-timeout=10000` |
| PERF-13 | JVM sin tuning (`-Xms192m` en todos los Dockerfiles) | `-XX:MaxGCPauseMillis=200` y ajustar Xms según límite real del pod |
| PERF-14 | `idx_transactions_date` redundante (existe `(user_id, date)`) | Eliminarlo en una migración — ahorra escrituras |
| PERF-15 | RabbitMQ subutilizado (solo eventos de usuario) | Mover transcripción/PDF/embeddings a colas (ver PERF-05) |

---

## ✅ Lo que ya está bien (no tocar)

- Cache Caffeine de cotizaciones (5 min) + circuit breaker + retry sobre DolarAPI
- Cache de API keys de usuario (60s TTL)
- Índice compuesto `(user_id, date DESC)` en transacciones
- Paginación con `Pageable` en el listado de transacciones
- Dockerfiles multi-stage con runtime alpine

---

## 📅 Orden de ejecución sugerido

- **Quick wins (1-2 días):** PERF-02 (timeouts), PERF-04 (memoria K8s), PERF-01 vía virtual threads (1 línea), PERF-06 (índice vectorial)
- **Sprint siguiente:** PERF-03 (endpoint de agregación), PERF-08, PERF-10
- **Backlog:** PERF-05 (async jobs), PERF-07 (HPA), PERF-11 a PERF-15

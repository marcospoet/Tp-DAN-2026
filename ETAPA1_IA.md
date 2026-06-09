# Entrega Etapa 1 — Pesito IA
**Materia:** Inteligencia Artificial — UTN FRSF 2026
**Fecha de entrega:** 8 de junio de 2026
**Integrantes:** Marcos Joaquin Poët y Marcos Joaquin Pividori

---

## 1. Descripción general del problema

### Contexto

La economía argentina presenta características únicas que dificultan la gestión de finanzas personales: inflación estructural, múltiples tipos de cambio (oficial, blue, tarjeta, MEP), proliferación de billeteras digitales (Mercado Pago, Ualá, Brubank, Naranja X) y una cultura financiera fragmentada donde cada persona opera con 2 o más medios de pago simultáneos.

Ante este escenario, la mayoría de las personas no mantiene un registro ordenado de sus gastos. Las planillas manuales son propensas a errores, los bancos no consolidan información entre billeteras, y no existe retroalimentación inteligente sobre hábitos de consumo. Adicionalmente, cuando surge una pregunta financiera ("¿me conviene un plazo fijo UVA?", "¿qué comisiones cobra Ualá?"), la respuesta correcta y actualizada requiere consultar múltiples fuentes.

### Problema

**¿Cómo puede un asistente inteligente ayudar a una persona a registrar, entender y mejorar sus finanzas personales en el contexto económico argentino, integrando datos propios del usuario con conocimiento actualizado del ecosistema financiero local?**

---

## 2. Definición del objetivo del agente

**Pesito IA** es un agente inteligente de asistencia financiera personal cuyo objetivo es:

> Permitir al usuario registrar transacciones financieras mediante lenguaje natural (texto, voz, imagen o PDF), responder preguntas sobre su situación financiera con datos en tiempo real, y brindar información contextualizada sobre productos y entidades financieras argentinas — actuando de forma autónoma a través de herramientas concretas sobre el sistema.

El agente debe ser capaz de:

1. **Percibir** entradas multimodales del usuario (texto, audio, imagen, PDF)
2. **Razonar** sobre la intención del usuario usando un LLM
3. **Actuar** invocando herramientas para consultar o modificar datos financieros
4. **Recuperar** conocimiento externo de una base de conocimiento de entidades financieras argentinas
5. **Mantener contexto** de la conversación entre turnos para respuestas coherentes

---

## 3. Especificación del ambiente

El agente opera en un ambiente descripto mediante el modelo **PEAS**:

| Componente | Descripción |
|-----------|-------------|
| **Performance** (medida de desempeño) | Precisión en la extracción de transacciones; relevancia y utilidad de las respuestas de chat; correcta invocación de herramientas; fidelidad de la información financiera recuperada |
| **Environment** (ambiente) | Datos financieros personales del usuario (transacciones, cuentas, presupuesto); base de conocimiento de entidades financieras argentinas; APIs externas de tipo de cambio; historial de conversación |
| **Actuators** (actuadores) | Respuestas en lenguaje natural; creación/modificación/consulta de transacciones; búsquedas en base de conocimiento; conversión de moneda |
| **Sensors** (sensores) | Texto libre del usuario; imágenes de tickets/comprobantes; archivos de audio (voz); documentos PDF; contexto financiero del usuario inyectado en cada turno |

### Características del ambiente

| Dimensión | Clasificación | Justificación |
|-----------|--------------|---------------|
| Observabilidad | **Parcialmente observable** | El agente accede a las transacciones registradas por el usuario, pero no conoce gastos no registrados, movimientos bancarios externos ni el contexto financiero completo |
| Determinismo | **Estocástico** | La misma consulta en lenguaje natural puede producir distintas respuestas; los datos de contexto varían con el tiempo |
| Episodicidad | **Secuencial con memoria** | Cada conversación mantiene historial; las respuestas de turnos anteriores condicionan los siguientes |
| Dinamismo | **Semi-dinámico** | Los datos del usuario cambian solo cuando él registra transacciones; el conocimiento financiero externo se actualiza con baja frecuencia |
| Continuidad | **Discreto** | Las interacciones son turnos de conversación discretos |
| Agentes | **Mono-agente** | Un único agente interactúa con el usuario; los microservicios son componentes de soporte, no agentes independientes |

---

## 4. Identificación de percepciones y acciones (Tools)

### Percepciones (entradas al agente)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PERCEPCIONES                             │
├──────────────────┬──────────────────────────────────────────────┤
│  Texto libre     │ Consultas, instrucciones en lenguaje natural  │
│  Imagen          │ Fotos de tickets, comprobantes, facturas      │
│  Audio           │ Mensajes de voz (transcripción via Whisper)   │
│  PDF             │ Facturas digitales, resúmenes de tarjeta      │
│  Contexto implíc.│ Últimas transacciones, saldo, presupuesto     │
│                  │ (inyectado automáticamente en cada turno)     │
└──────────────────┴──────────────────────────────────────────────┘
```

### Acciones / Herramientas (Tools)

El agente dispone de herramientas que invoca durante su razonamiento mediante **function calling** (Claude tool_use / OpenAI function_calling):

#### Tools sobre datos del usuario

| Tool | Descripción | Parámetros |
|------|-------------|-----------|
| `get_account_balances()` | Obtiene saldos de todas las cuentas del usuario | — |
| `get_transactions(filters)` | Consulta transacciones con filtros opcionales | `category`, `month`, `account_id`, `date_from`, `date_to` |
| `get_monthly_summary(month)` | Resumen mensual: ingresos, egresos, top categorías, proyección | `month` (YYYY-MM) |
| `create_transaction(data)` | Registra una nueva transacción desde el chat | `description`, `amount`, `type`, `category`, `currency`, `account_id` |
| `get_exchange_rate()` | Cotización actual del dólar (blue, oficial, tarjeta, MEP) | — |

#### Tool RAG sobre conocimiento financiero

| Tool | Descripción | Parámetros |
|------|-------------|-----------|
| `search_financial_knowledge(query)` | Búsqueda semántica en la base de conocimiento de entidades financieras argentinas (Mercado Pago, Ualá, Brubank, Naranja X, bancos, regulaciones AFIP/BCRA) | `query` (texto de la pregunta) |

### Ejemplos de uso de Tools por tipo de consulta

```
Usuario: "¿Cuánto gasté en comida este mes?"
  → Tool: get_transactions(category="food", month="2026-06")
  → LLM recibe resultado y responde con detalle

Usuario: "Registrá un gasto de $5000 en nafta con Naranja X"
  → Tool: create_transaction(description="Nafta", amount=5000,
          type="EXPENSE", category="Transporte", currency="ARS")
  → LLM confirma la operación al usuario

Usuario: "¿Cuánto cobra Ualá por transferencias?"
  → Tool: search_financial_knowledge("comisiones transferencias Ualá")
  → LLM recupera chunks relevantes de la knowledge base y responde

Usuario: "¿A cuánto está el dólar blue hoy?"
  → Tool: get_exchange_rate()
  → LLM responde con la cotización en tiempo real

Usuario: "Comparame mis gastos de mayo vs junio"
  → Tool: get_monthly_summary(month="2026-05")
  → Tool: get_monthly_summary(month="2026-06")
  → LLM recibe ambos resultados y construye la comparación

Usuario: "¿Me conviene un plazo fijo UVA con lo que tengo ahorrado?"
  → Tool: get_account_balances()
  → Tool: search_financial_knowledge("plazo fijo UVA vs tradicional diferencias")
  → LLM combina el saldo del usuario con el conocimiento financiero y responde
```

---

## 5. Arquitectura del agente

### Tipo de agente

**Agente reactivo con memoria y herramientas (Tool-augmented Memory Agent)**

El agente combina cuatro capacidades:
- **Reactividad:** responde a cada turno del usuario según el input y el contexto
- **Memoria:** mantiene historial de conversación persistido en MongoDB (hasta 40 turnos, TTL 30 días)
- **Uso de herramientas:** el LLM decide qué herramientas invocar durante su razonamiento (function calling nativo)
- **RAG:** recuperación semántica sobre base de conocimiento de entidades financieras argentinas

### Loop de razonamiento del agente

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOOP DEL AGENTE                            │
│                                                                 │
│  1. PERCEPCIÓN                                                  │
│     Input usuario (texto/imagen/audio/PDF)                      │
│          ↓                                                      │
│  2. CONSTRUCCIÓN DE CONTEXTO                                    │
│     System prompt + historial MongoDB + datos financieros       │
│          ↓                                                      │
│  3. RAZONAMIENTO (LLM)                                          │
│     Claude / OpenAI / Gemini con tool definitions               │
│          ↓                                                      │
│  4. ¿Tool call requerida?                                       │
│     NO → Respuesta directa al usuario                           │
│     SÍ  → Ejecutar tool → resultado → volver a paso 3           │
│          ↓                                                      │
│  5. RESPUESTA                                                   │
│     Texto natural al usuario                                    │
│          ↓                                                      │
│  6. MEMORIA                                                     │
│     Persistir turno (user + assistant) en MongoDB               │
└─────────────────────────────────────────────────────────────────┘
```

### Diagrama de arquitectura de módulos

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 16)                            │
│   MagicBar (texto/imagen/audio/PDF)    ChatPanel (conversación)          │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ HTTPS (proxy interno)
┌─────────────────────────────────────▼────────────────────────────────────┐
│                          API GATEWAY (Spring Cloud)                      │
│              JWT validation · Routing · Circuit Breaker                  │
└──────┬────────────────────────────────┬────────────────────────┬─────────┘
       │                                │                        │
┌──────▼──────┐               ┌─────────▼──────────┐   ┌────────▼─────────┐
│auth-service │               │ transaction-service │   │    ai-service    │
│ PostgreSQL  │               │    PostgreSQL       │   │    (AGENTE)      │
│ JWT / OAuth │               │    MinIO            │   │    MongoDB       │
└─────────────┘               └──────────┬──────────┘   └────────┬─────────┘
                                         ▲                        │
                              ┌──────────┘         ┌─────────────┴──────────┐
                              │                    │    ai-service módulos  │
                              │                    ├────────────────────────┤
                              │                    │  PromptService         │
                              │                    │  ChatHistoryService    │
                              ├────────────────────│  ToolExecutorService   │
                              │                    │  RagService            │
                              │                    │  KnowledgeBaseLoader   │
                              │                    │  WebScraperService (v2)│
                              │                    │  AiProviderService     │
                              │                    └────────────┬───────────┘
                              │                                 │
                              │                    ┌────────────▼───────────┐
                              │                    │  pgvector (PostgreSQL) │
                              │                    │  Vector Store          │
                              │                    │  knowledge_chunks      │
                              │                    └────────────────────────┘
```

### Módulos del agente (ai-service)

| Módulo | Responsabilidad |
|--------|----------------|
| **PromptService** | Construye el system prompt dinámico: nombre del usuario, presupuesto, moneda, cotización actual y definición de tools disponibles |
| **ChatHistoryService** | Lee y persiste el historial en MongoDB. Ventana deslizante de 40 turnos, TTL 30 días |
| **ToolExecutorService** | Loop de function calling: detecta tool calls en la respuesta del LLM, las ejecuta y devuelve resultados para continuar el razonamiento |
| **RagService** | Recibe la query, la embebe, busca los chunks más similares en pgvector por cosine similarity, devuelve los fragmentos al ToolExecutorService |
| **KnowledgeBaseLoader** | Indexa la knowledge base al startup: lee archivos Markdown y PDFs, los chunkea, los embebe y los inserta en pgvector. Detecta cambios via hash MD5 para no re-indexar innecesariamente |
| **WebScraperService** *(v2)* | Descarga y parsea páginas web configuradas (Jsoup). Ejecutado por scheduler cada 2 días. Re-indexa solo si el contenido cambió |
| **AiProviderService** | Abstracción sobre Claude, OpenAI y Gemini. Gestiona formato de mensajes, envío de tool definitions e interpretación de tool calls en cada formato propietario |

---

## 6. Base de conocimiento RAG — Estrategia en dos fases

La base de conocimiento se implementa en **dos fases evolutivas**: una inicial con datos estáticos (confiable, sin dependencias externas) y una segunda con scraping web (más dinámica y automatizada).

---

### Fase 1 — Datos estáticos: Markdown y PDF (implementación inicial)

La primera implementación utiliza exclusivamente **archivos curados manualmente** almacenados en el repositorio. Estos archivos se indexan en pgvector al arranque del ai-service.

#### Pipeline de indexado estático

```
Al iniciar ai-service
        ↓
KnowledgeBaseLoader escanea /knowledge-base/
        ↓
Por cada archivo:
  ┌─────────────────────────────────────────────────────┐
  │  ¿Es .md?  → leer texto directamente                │
  │  ¿Es .pdf? → extraer texto con Apache PDFBox        │
  └─────────────────────────────────────────────────────┘
        ↓
  Calcular MD5 del contenido
        ↓
  ¿Hash igual al guardado en BD?
    SÍ  → saltar (ya indexado y sin cambios)
    NO  → borrar chunks anteriores de pgvector
           rechunkear (~500 tokens, solapamiento 50 tokens)
           embeber cada chunk (OpenAI text-embedding-3-small)
           insertar en pgvector con metadata (fuente, fecha)
           guardar nuevo hash
        ↓
KnowledgeBaseLoader finaliza → ai-service listo
```

#### Estructura de archivos en el proyecto

```
ai-service/src/main/resources/knowledge-base/
│
├── markdown/
│   ├── FAQ_MERCADOPAGO.md          ← comisiones, límites, cuentas, tarjetas
│   ├── FAQ_UALÁ.md                 ← tarifario, beneficios, requisitos
│   ├── FAQ_BRUBANK.md              ← productos, tasas, atención
│   ├── FAQ_NARANJAX.md             ← cuotas, cashback, financiación
│   ├── FAQ_GALICIA.md              ← cuentas, préstamos, inversiones
│   ├── FAQ_NACION.md               ← cuentas gratuitas, ANSES, jubilados
│   ├── FAQ_BBVA.md                 ← banca digital, tasas
│   ├── FAQ_SANTANDER.md            ← productos, beneficios
│   ├── EDUCACION_FINANCIERA.md     ← plazo fijo, FCI, CEDEARs, cauciones
│   └── DERECHOS_CONSUMIDOR.md      ← Ley 24.240, devoluciones, garantías
│
└── pdf/
    ├── afip_monotributo_2026.pdf   ← tabla oficial de categorías y cuotas
    ├── bcra_tasas_referencia.pdf   ← tasas de política monetaria y depósitos
    └── cnv_guia_inversor.pdf       ← guía educativa para inversores minoristas
```

#### Formato recomendado para los Markdown

La calidad del RAG depende de cómo están escritos los archivos. Cada sección debe ser autocontenida para que el chunk tenga sentido por sí solo:

```markdown
# Mercado Pago Argentina — Información de productos y tarifas

## Transferencias
- Entre cuentas Mercado Pago: sin costo, acreditación inmediata
- Hacia CBU/CVU externos: sin costo hasta 5 transferencias mensuales,
  luego $X por transferencia
- Límite diario: $500.000 ARS para usuarios verificados

## Extracción de efectivo
- En cajeros Red Link y Banelco: $X por extracción
- Gratuitas: 0 extracciones sin costo por mes
- Para acceder a extracciones sin costo: requerir nivel de cuenta Plus

## Cuenta remunerada
- Rinde X% TNA sobre el saldo disponible
- Acreditación de intereses: diaria
- Sin monto mínimo ni plazo de permanencia
```

> Las secciones delimitadas por `##` funcionan como unidades semánticas naturales para el chunking.

#### Cuándo usar PDF vs Markdown

| Tipo de fuente | Formato | Razón |
|---------------|---------|-------|
| Documentos oficiales (AFIP, BCRA, CNV) | **PDF** | Existen como documentos oficiales, mayor autoridad |
| Términos y condiciones bancarios extensos | **PDF** | Publicados por los bancos en formato PDF |
| Tarifas y FAQs de billeteras digitales | **Markdown** | Información más dinámica, mejor controlada manualmente |
| Guías educativas propias | **Markdown** | Control total sobre estructura y contenido |
| PDFs con tablas complejas o columnas múltiples | **Markdown** (transcripción) | PDFBox puede desordenar el texto en layouts complejos |
| PDFs escaneados (imagen) | **Markdown** (transcripción) | Sin capa de texto, PDFBox no puede extraer nada útil |

---

### Fase 2 — Datos dinámicos: scraping web con enfoque mixto

Una vez validada la Fase 1, se migran gradualmente las fuentes que cambian con mayor frecuencia hacia un sistema de scraping periódico automatizado.

#### Pipeline de scraping y re-indexado

```
Scheduler Spring (@Scheduled, cada 2 días)
        ↓
WebScraperService itera sobre lista de WebSource configuradas
        ↓
Por cada fuente:
  HTTP GET a la URL configurada (WebClient)
        ↓
  Jsoup parsea el HTML:
    - Elimina: nav, footer, header, scripts, estilos, breadcrumbs
    - Extrae: selector CSS configurado por fuente (ej: "article", "main", ".help-content")
        ↓
  Calcular MD5 del texto extraído
        ↓
  ¿Hash igual al guardado en BD?
    SÍ  → registrar en log "sin cambios", saltar
    NO  → borrar chunks anteriores de pgvector para esta URL
           rechunkear el texto nuevo
           embeber con OpenAI text-embedding-3-small
           insertar en pgvector (metadata: url, fecha_indexado)
           actualizar hash en BD
        ↓
Scheduler finaliza → knowledge base actualizada
```

#### Fuentes y enfoque por entidad

| Fuente | URL objetivo | Tipo de página | Enfoque Fase 2 |
|--------|-------------|---------------|----------------|
| BCRA tasas | `bcra.gob.ar/estadisticas` | HTML estático | Scraping con Jsoup |
| AFIP monotributo | `afip.gob.ar/monotributo` | HTML estático | Scraping con Jsoup |
| Mercado Pago ayuda | `mercadopago.com.ar/ayuda` | **SPA (React)** | Mantener Markdown (SPA no compatible con Jsoup) |
| Ualá tarifario | `uala.com.ar/tarifario` | **SPA (React)** | Mantener Markdown |
| Brubank ayuda | `brubank.com.ar/ayuda` | Evaluar | Evaluar en Fase 2 |
| Naranja X beneficios | `naranjax.com/beneficios` | **SPA** | Mantener Markdown |

> **Nota sobre SPAs:** páginas construidas con React/Vue renderizan el contenido via JavaScript. Jsoup solo ve el HTML inicial (sin contenido). La forma de detectarlo es abrir la URL y ver el código fuente (`Ctrl+U`): si el contenido relevante no aparece ahí, la página es una SPA y Jsoup no es suficiente. Para estas fuentes se mantiene el Markdown curado de la Fase 1.

#### Distribución final del enfoque mixto

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE BASE — ENFOQUE MIXTO                   │
├──────────────────────────┬──────────────────────────────────────────┤
│  ESTÁTICO (Fase 1)        │  DINÁMICO — Scraping (Fase 2)           │
│  Markdown + PDF curados  │  Scraping con Jsoup cada 2 días         │
├──────────────────────────┼──────────────────────────────────────────┤
│  Mercado Pago (SPA)      │  BCRA: tasas de referencia              │
│  Ualá (SPA)              │  AFIP: actualizaciones de monotributo   │
│  Brubank (SPA)           │  Páginas de ayuda con HTML estático     │
│  Naranja X (SPA)         │                                          │
│  PDFs AFIP/BCRA/CNV      │                                          │
│  Guías educativas        │                                          │
└──────────────────────────┴──────────────────────────────────────────┘
```

#### Tecnologías adicionales para la Fase 2

| Componente | Tecnología | Uso |
|-----------|-----------|-----|
| HTML parser | **Jsoup 1.17** | Extracción de texto de páginas HTML estáticas |
| Scheduler | **Spring `@Scheduled`** | Cron job cada 2 días (`0 0 0 */2 * *`) |
| Hash de cambios | **Apache Commons Codec (MD5)** | Detectar si el contenido cambió antes de re-indexar |
| HTTP client | **Spring WebClient** | Ya presente en el proyecto, reutilizado para fetching |

> **Playwright / Selenium (futuro):** si en el futuro se necesita scrapear SPAs (Mercado Pago, Ualá), se podría incorporar Playwright for Java. Esto queda fuera del alcance de la Fase 2 por la complejidad que agrega al despliegue (requiere instancia de Chromium).

---

### RAG en tiempo de query (igual en ambas fases)

Independientemente del origen del contenido (Markdown, PDF o scraping), el proceso de búsqueda en tiempo de consulta es siempre el mismo:

```
Usuario pregunta algo (via Tool search_financial_knowledge)
        ↓
RagService recibe la query
        ↓
Embeber la query → vector de 1536 dimensiones (text-embedding-3-small)
        ↓
pgvector: SELECT ... ORDER BY embedding <=> query_vector LIMIT 5
(búsqueda por cosine similarity, threshold mínimo configurable)
        ↓
Devolver los 5 chunks más relevantes con su fuente y fecha de indexado
        ↓
ToolExecutorService inyecta los chunks en el prompt del LLM
        ↓
LLM razona y responde citando la fuente
```

---

## 7. Tecnologías por componente

| Componente | Tecnología |
|-----------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend agente | Java 21, Spring Boot 3.2.5, Spring Data MongoDB |
| LLM providers | Claude 3.5 Sonnet/Haiku (Anthropic), GPT-4o-mini (OpenAI), Gemini 2.0 Flash (Google) |
| Memoria conversacional | MongoDB 7 — colección `chat_sessions`, TTL index 30 días |
| Vector store (RAG) | **pgvector** — extensión de PostgreSQL 16 ya existente en el proyecto |
| Embeddings (RAG) | OpenAI `text-embedding-3-small` (1536 dims, ~$0.02/1M tokens) |
| Extracción PDF | **Apache PDFBox** — ya presente en el proyecto como dependencia |
| HTML parsing (Fase 2) | **Jsoup 1.17** — liviano, sin dependencias adicionales |
| Scheduler (Fase 2) | Spring `@Scheduled` — integrado en Spring Boot, sin infraestructura extra |
| Transcripción de audio | OpenAI Whisper / Gemini multimodal |
| Observabilidad | Prometheus + Grafana (métricas), Loki + Promtail (logs), Tempo (trazas) |
| Despliegue | Docker Compose (desarrollo), Kubernetes (producción) |

---

## 8. Resumen conceptual

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PESITO IA — RESUMEN DEL AGENTE                    │
├──────────────────────┬───────────────────────────────────────────────┤
│ Tipo de agente       │ Reactivo con memoria y herramientas           │
│ Caso de uso          │ Asistente financiero personal — economía AR   │
│ LLMs integrados      │ Claude 3.5, GPT-4o-mini, Gemini 2.0 Flash    │
│ Tools (6)            │ get_transactions, get_monthly_summary,        │
│                      │ create_transaction, get_exchange_rate,        │
│                      │ get_account_balances,                         │
│                      │ search_financial_knowledge (RAG)              │
│ Memoria              │ MongoDB chat sessions (40 turnos, TTL 30d)    │
├──────────────────────┼───────────────────────────────────────────────┤
│ RAG Fase 1           │ Markdown + PDF curados, indexados en pgvector │
│ (implementación      │ Fuentes: billeteras AR, bancos, AFIP, BCRA,   │
│  inicial)            │ educación financiera, Ley del Consumidor      │
├──────────────────────┼───────────────────────────────────────────────┤
│ RAG Fase 2           │ Enfoque mixto: scraping con Jsoup cada 2 días │
│ (evolución)          │ para fuentes HTML estáticas (BCRA, AFIP) +    │
│                      │ Markdown curado para SPAs (MP, Ualá, etc.)    │
├──────────────────────┼───────────────────────────────────────────────┤
│ Interfaz             │ Next.js 16 — web app con chat y magic bar     │
│ Observabilidad       │ Prometheus, Grafana, Loki, Tempo              │
└──────────────────────┴───────────────────────────────────────────────┘
```

---

*Fin de la Entrega Etapa 1 — IA*

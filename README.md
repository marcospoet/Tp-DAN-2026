# Pesito — TP DAN 2026

Asistente financiero personal con IA para la economía argentina, construido con arquitectura de microservicios.
Trabajo Práctico — Desarrollo de Aplicaciones en la Nube — UTN FRSF.

---

## Qué es Pesito

Pesito te permite registrar gastos e ingresos hablándole en lenguaje natural, por texto, foto, audio o PDF de factura.
La IA interpreta el mensaje, extrae monto, categoría, moneda y medio de pago, y crea la transacción automáticamente.

**Ejemplos de uso:**
- `"Pesito gasté 3500 en el super con Galicia"` → gasto · Supermercado · $3.500 · cuenta: Banco Galicia
- `"Pesito cobré mi sueldo de 200000"` → ingreso · Trabajo · $200.000
- `"gasté 50 dólares blue en ropa"` → gasto · General · USD 50 · tipo Blue
- `"almorcé 1200 y tomé café 400"` → dos transacciones en un envío
- Foto de ticket / PDF de factura → extrae el total automáticamente

---

## Arquitectura

```
          ┌──────────────┐     ┌───────────────────┐
          │    Browser   │     │   Bruno / Client   │
          └──────┬───────┘     └─────────┬──────────┘
                 │ :3001 (Docker)        │ :8080 (Docker)
                 │ :30300 (K8s)          │ :30080 (K8s)
      ┌──────────▼──────────┐  ┌────────▼─────────┐
      │  frontend-service   │  │   API Gateway    │  ← único punto de entrada de la API
      │   Next.js :3000     │  └────────┬─────────┘
      └─────────────────────┘           │ Eureka lb://
                                        │
               ┌──────────────────────┬─┴──────────────────┐
               │                      │                     │
      ┌────────▼───────┐  ┌───────────▼──────┐  ┌──────────▼───┐
      │  auth-service  │  │transaction-      │  │  ai-service  │
      │    :8081       │  │  service :8082   │  │    :8083     │
      └────────┬───────┘  └──────────┬───────┘  └──────┬───────┘
               │                     │                  │
         ┌─────▼──────┐  ┌───────────▼─────┐  ┌────────▼───┐
         │ PostgreSQL  │  │   PostgreSQL    │  │  MongoDB   │
         │ schema:auth │  │   schema:txn   │  │   ai_db    │
         └─────────────┘  └─────────────────┘  └────────────┘
                    \              /
                  ┌──▼────────────▼──┐     ┌──────────┐
                  │    RabbitMQ      │     │  MinIO   │
                  │ (eventos async)  │     │(receipts)│
                  └──────────────────┘     └──────────┘
```

**Service Discovery:** Eureka Server en `:8761`

---

## Requisitos

- Docker Desktop (con Docker Compose v2)
- Git

Para desarrollo local sin Docker:
- Java 21
- Maven 3.9+
- Node.js 20+
- PostgreSQL 16, MongoDB 7, RabbitMQ 3.13

---

## Inicio rápido

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd tp-dan-2026
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` y reemplazar todos los valores `cambiar_en_produccion`.
Generar `JWT_SECRET`, `APP_ENCRYPTION_SECRET` e `INTERNAL_API_SECRET` con:

```powershell
# PowerShell
$bytes = New-Object byte[] 64; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [System.BitConverter]::ToString($bytes).Replace('-','').ToLower()
```

```bash
# Linux / Mac / WSL
openssl rand -hex 64
```

> **Fail-fast de secretos:** los servicios validan los secretos al arrancar (`SecretsValidator`).
> Si un secreto falta, tiene menos de 32 caracteres o conserva un valor de ejemplo
> (`cambiar...`, `reemplazar...`), el servicio **se niega a arrancar** con un mensaje claro.
> Los valores de desarrollo viven solo en el perfil `local` de cada servicio.

### 3. Levantar todos los servicios

```bash
docker compose up --build
```

El primer build tarda varios minutos (descarga dependencias Maven y npm).
Los servicios arrancan en orden gracias a `depends_on` + healthchecks.

### 4. Verificar que todo esté sano

```bash
docker compose ps
```

Todos los servicios deben estar en estado `healthy` o `running`.
Verificar el health del gateway:

```bash
curl http://localhost:8080/actuator/health
```

---

## Servicios y puertos

| Servicio | Puerto (host) | URL |
|---|---|---|
| Frontend (Pesito UI) | `3001` | http://localhost:3001 |
| API Gateway | `8080` | http://localhost:8080 |
| auth-service | `8081` | http://localhost:8081 |
| transaction-service | `8082` | http://localhost:8082 |
| ai-service | `8083` | http://localhost:8083 |
| Eureka Dashboard | `8761` | http://localhost:8761 |
| RabbitMQ Management | `15672` | http://localhost:15672 |
| MinIO Console | `9001` | http://localhost:9001 |
| MinIO API | `9000` | http://localhost:9000 |
| Grafana | `3000` | http://localhost:3000 |
| Prometheus | `9090` | http://localhost:9090 |
| Loki | `3100` | http://localhost:3100 |
| Tempo | `3200` | http://localhost:3200 |
| PostgreSQL | `5432` | localhost:5432 |
| MongoDB | `27017` | localhost:27017 |

> En producción, solo el API Gateway y el Frontend deberían estar expuestos públicamente.

---

## Probar la API con Bruno

El repositorio incluye una colección [Bruno](https://www.usebruno.com/) lista para usar.

### Setup

1. Instalar Bruno (gratuito, open source)
2. Abrir Bruno → **Open Collection** → seleccionar la carpeta `bruno/`
3. En la barra superior, seleccionar el environment **`local`**

### Orden de ejecución

```
1. auth-service / register   → crea usuario, guarda {{token}} y {{userId}}
2. auth-service / login      → refresca {{token}} y {{userId}}
3. auth-service / getProfile → usa {{token}}
4. transaction-service / *   → usa {{token}} y {{userId}}
```

### Variables de entorno (bruno/environments/local.bru)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `userEmail` | `test@pesito.com` | Email para register/login |
| `userPassword` | `Password123` | Password para register/login (mín. 8 caracteres, una mayúscula, una minúscula y un número) |
| `token` | *(se setea automático)* | JWT devuelto por register/login |
| `userId` | *(se setea automático)* | UUID del usuario autenticado |

---

## Endpoints principales

### auth-service (`/api/auth`)

| Método | Path | Auth | Descripción |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | — | Registro con email/password (valida: mín. 8 chars, mayúscula, minúscula y número) |
| `POST` | `/api/auth/login` | — | Login, devuelve JWT |
| `GET` | `/api/auth/validate` | — | Validar token (usado por el Gateway) |
| `GET` | `/api/auth/verify-email` | — | Verificación de email (link del mail) |
| `POST` | `/api/auth/resend-verification` | — | Reenviar mail de verificación |
| `GET` | `/api/auth/profile` | JWT | Perfil del usuario autenticado (API keys enmascaradas) |
| `PUT` | `/api/auth/profile` | JWT | Actualizar perfil (nombre, presupuesto, proveedor de IA, API keys) |
| `POST` | `/api/auth/change-password` | JWT | Cambiar contraseña |
| `DELETE` | `/api/auth/profile` | JWT | Eliminar cuenta (publica `user.deleted`) |

### transaction-service (`/api/transactions`)

Todos los endpoints requieren `Authorization: Bearer <token>` y el header `X-User-Id: <uuid>`.

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/transactions` | Listar (paginado, filtro por fechas) |
| `POST` | `/api/transactions` | Crear transacción (body validado con Bean Validation) |
| `GET` | `/api/transactions/{id}` | Obtener por ID |
| `PUT` | `/api/transactions/{id}` | Actualizar (parcial) |
| `DELETE` | `/api/transactions/{id}` | Eliminar |
| `GET/POST/DELETE` | `/api/transactions/{id}/receipt` | Ver / subir / borrar comprobante (MinIO) |
| `GET` | `/api/transactions/{id}/receipt/url` | URL presignada del comprobante |
| `GET` | `/api/rates` | Cotizaciones ARS/USD (proxy DolarAPI con cache) |
| `GET` | `/api/rates/{type}` | Cotización puntual (`blue`, `oficial`, `tarjeta`, `mep`) |

### ai-service (`/api/ai`)

Todos los endpoints **exigen** el header `X-User-Id` (lo inyecta el Gateway desde el JWT;
los valores enviados por el cliente se descartan).

| Método | Path | Descripción |
|---|---|---|
| `POST` | `/api/ai/parse` | Texto / imagen / audio / PDF → transacción(es) JSON |
| `POST` | `/api/ai/chat` | Mensaje conversacional → agente con tools y memoria |
| `POST` | `/api/ai/detect-intent` | Detectar intención: `update`, `delete`, `recurring` o `csv` |
| `POST` | `/api/ai/csv-mapping` | Identificar columnas de un CSV bancario |
| `POST` | `/api/ai/transcribe` | Transcribir audio (OpenAI Whisper) |
| `POST` | `/api/ai/embeddings/migrate` | Re-embeber documentos al cambiar de proveedor (202, corre en background) |
| `POST` | `/api/ai/embeddings/pause` | Pausar la búsqueda semántica de documentos ("solo chatear") |

### Swagger UI

Cada microservicio Java expone su documentación interactiva:

- auth-service: http://localhost:8081/swagger-ui.html
- transaction-service: http://localhost:8082/swagger-ui.html

---

## Proveedores de IA

Las API keys son **100% por usuario** — el servidor no tiene claves propias.
Cada usuario carga su key (Claude, OpenAI o Gemini) en **Ajustes → Cuenta**:

1. La key viaja una sola vez al `auth-service`, que la guarda **cifrada con AES-256-GCM** en PostgreSQL.
2. Cuando el usuario chatea, `ai-service` resuelve la key llamando al endpoint interno
   `GET /internal/users/{userId}/api-keys` de auth-service (protegido por `INTERNAL_API_SECRET`)
   y la cachea 60 segundos.
3. El frontend nunca vuelve a ver la key: el perfil la devuelve **enmascarada** (`sk-p...****abcd`).

El proveedor se cambia desde Ajustes sin reiniciar nada. Al cambiar entre OpenAI y Gemini
(espacios vectoriales incompatibles para RAG), la UI ofrece **migrar los documentos**
(re-embeber con el proveedor nuevo) o **pausarlos** ("solo chatear").

### Soporte de PDFs

Cuando el usuario adjunta una factura en PDF desde la Magic Bar:

- **Claude** → usa `claude-3-5-sonnet-20241022` con bloque `"type":"document"` (lectura nativa del PDF)
- **OpenAI** → convierte la primera página a imagen PNG con Apache PDFBox y la envía via visión (`gpt-4o-mini`)
- **Gemini** → envía el PDF como `inline_data` (soporte nativo de gemini-2.0-flash)

---

## Base de datos

PostgreSQL usa tres schemas separados con usuarios dedicados (cada usuario solo accede a su schema):

| Schema | Usuario | Servicio propietario | Contenido |
|---|---|---|---|
| `auth` | `auth_user` | auth-service | Usuarios, perfiles, API keys cifradas |
| `txn` | `txn_user` | transaction-service | Transacciones, comprobantes |
| `ai` | `ai_db_user` | ai-service | Knowledge base RAG (pgvector, embeddings por proveedor) |

Las migraciones las gestiona **Flyway** automáticamente al arrancar cada servicio.
Los scripts están en `src/main/resources/db/migration/` de cada microservicio.

MongoDB lo usa exclusivamente el **ai-service**:

| Colección | Contenido |
|---|---|
| `chat_sessions` | Sesiones de conversación por usuario (con historial embebido) |
| `chat_memories` | Memoria semántica de largo plazo (mensajes embebidos, por proveedor) |
| `agent_profiles` | Perfil financiero del usuario generado por LLM (se regenera cada 30 días) |

### Resetear la base de datos

Para borrar todos los datos y volver al estado inicial:

```bash
docker compose down -v
docker compose up --build
```

Para borrar solo un usuario específico (sin perder el resto):

```bash
docker exec -it bb-postgres psql -U postgres -d pesito \
  -c "DELETE FROM auth.users WHERE email = 'test@pesito.com';"
```

---

## Almacenamiento de comprobantes (MinIO)

Las imágenes de tickets y recibos se almacenan en **MinIO** (S3-compatible):

- Bucket: `receipts`
- Subida via `POST /api/transactions/{id}/receipt` (multipart/form-data)
- La URL del comprobante se guarda en el campo `receipt_url` de la transacción

Acceder a la consola de MinIO: http://localhost:9001
Credenciales: las definidas en `.env` (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`)

---

## Mensajería asincrónica (RabbitMQ)

| Evento | Publicado por | Consumido por |
|---|---|---|
| `user.registered` | auth-service | *(log / futuras notificaciones)* |
| `user.deleted` | auth-service | transaction-service (limpia transacciones del usuario) |
| `transaction.created` | transaction-service | ai-service (invalida cache de analytics) |

---

## Observabilidad

| Herramienta | URL | Descripción |
|---|---|---|
| Grafana | http://localhost:3000 | Dashboards (user: `admin`) |
| Prometheus | http://localhost:9090 | Métricas en tiempo real |
| Loki | http://localhost:3100 | Logs centralizados |
| Tempo | http://localhost:3200 | Distributed tracing |

Cada microservicio expone métricas en `/actuator/prometheus`.

**Observabilidad del agente IA** (opcional): configurando `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`
en `.env`, cada conversación genera traces con spans por llamada al LLM y por tool en
[Langfuse](https://cloud.langfuse.com). Sin claves, el tracing es un no-op. El logging SLF4J
de llamadas y tokens funciona siempre; con `AI_LLM_LOG_LEVEL=DEBUG` se loguean los prompts completos.

---

## Seguridad

Resumen de las medidas implementadas:

- **JWT** validado en el API Gateway; `X-User-Id` se inyecta desde el claim del token y pisa cualquier valor del cliente.
- **Secretos sin defaults** en la configuración base + `SecretsValidator` fail-fast (rechaza secretos cortos o de ejemplo). Valores dev solo en el perfil `local`.
- **API keys de usuario cifradas** (AES-256-GCM) en reposo; el endpoint interno que las descifra usa comparación constant-time y un secreto compartido.
- **Bean Validation** (`@Valid`) en todos los DTOs de entrada de los 3 servicios.
- **CORS** con whitelist explícita de headers y origins configurables (`CORS_ALLOWED_ORIGINS`).
- **Passwords** con BCrypt y política de complejidad en el registro.
- Schemas de Postgres separados con usuarios dedicados por servicio.

---

## Desarrollo local (sin Docker)

Para correr un microservicio de forma aislada, levantá la infraestructura con Docker y corré el servicio con Maven:

```bash
# Desde la raíz del repo — levanta solo la infraestructura
docker compose up postgres mongodb rabbitmq minio eureka-server -d
```

```bash
# Desde microservices/ — corre el servicio
cd microservices
mvn -pl auth-service spring-boot:run "-Dspring-boot.run.profiles=local"
```

El perfil `local` es **obligatorio** para correr sin Docker: la configuración base no
tiene defaults para secretos ni passwords, así que sin el perfil el servicio
falla con `Could not resolve placeholder`. Los cuatro servicios con secretos
(auth, gateway, transaction, ai) tienen su `application-local.properties` commiteado
con credenciales de desarrollo.

Para el frontend:

```bash
cd microservices/frontend-service
npm install
# Crear .env.local con BACKEND_URL=http://localhost:8080
npm run dev   # http://localhost:3000
```

---

## Estructura del repositorio

```
tp-dan-2026/
├── microservices/
│   ├── pom.xml                  ← parent POM (gestiona versiones)
│   ├── eureka-server/           ← Service Discovery (Spring Cloud Netflix Eureka)
│   ├── api-gateway/             ← Spring Cloud Gateway + filtro JWT
│   ├── auth-service/            ← Autenticación, perfiles, JWT
│   ├── transaction-service/     ← CRUD de transacciones, exchange rates, MinIO
│   ├── ai-service/              ← Pesito IA (Claude/OpenAI/Gemini), chat, parseo de PDF
│   └── frontend-service/        ← Next.js App Router (UI de Pesito)
├── infrastructure/
│   ├── postgres/                ← init.sh (crea schemas auth/txn y usuarios)
│   ├── mongodb/                 ← init-mongo.js (crea ai_db y ai_user)
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   ├── tempo/
│   └── promtail/
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-secrets.yaml
│   ├── 02-configmaps.yaml
│   ├── infrastructure/          ← postgres, mongodb, rabbitmq, minio
│   │   └── observability/       ← prometheus, grafana, loki, tempo, promtail
│   └── microservices/           ← eureka, api-gateway, auth, transaction, ai, frontend
├── bruno/                       ← Colección de requests para testing manual
│   ├── environments/
│   │   └── local.bru
│   ├── auth-service/
│   ├── transaction-service/
│   └── receipts/
├── docs/
│   └── test-cases.md            ← Casos de prueba del agente IA (coloquio)
├── docker-compose.yml
├── .env.example                 ← Plantilla de variables de entorno
└── README.md
```

---

## Kubernetes

Los manifiestos en `k8s/` están listos para cualquier cluster K8s (k3d, k3s, EKS, GKE, AKS).

### Arquitectura de red en K8s

| Servicio | Tipo | Acceso externo |
|---|---|---|
| api-gateway | `NodePort 30080` | `localhost:30080` |
| frontend-service | `NodePort 30300` | `localhost:30300` |
| El resto (infraestructura, observabilidad) | `ClusterIP` | port-forward |

---

### Probar en local con k3d

**Requisitos:** [k3d](https://k3d.io/#installation) y kubectl instalados.

```powershell
winget install k3d
```

---

#### Paso 1 — Crear el cluster k3d con los NodePorts mapeados

```powershell
k3d cluster create local-test `
    --port "30080:30080@server:0" `
    --port "30300:30300@server:0"
```

> k3d crea el cluster dentro de Docker y configura el contexto de kubectl automáticamente.
> Verificar:
>
> ```powershell
> kubectl config current-context
> # Debe decir "k3d-local-test"
> ```

---

#### Paso 2 — Buildear las imágenes e importarlas al cluster

A diferencia de Minikube, k3d no comparte el daemon de Docker. Hay que buildear normalmente y luego importar las imágenes al cluster.

```powershell
# Buildear
docker build -f microservices/eureka-server/Dockerfile       -t pesito/eureka-server:latest       ./microservices
docker build -f microservices/api-gateway/Dockerfile         -t pesito/api-gateway:latest         ./microservices
docker build -f microservices/auth-service/Dockerfile        -t pesito/auth-service:latest        ./microservices
docker build -f microservices/transaction-service/Dockerfile -t pesito/transaction-service:latest ./microservices
docker build -f microservices/ai-service/Dockerfile          -t pesito/ai-service:latest          ./microservices
docker build -f microservices/frontend-service/Dockerfile    -t pesito/frontend-service:latest    ./microservices/frontend-service

# Importar al cluster
k3d image import `
    pesito/eureka-server:latest `
    pesito/api-gateway:latest `
    pesito/auth-service:latest `
    pesito/transaction-service:latest `
    pesito/ai-service:latest `
    pesito/frontend-service:latest `
    -c local-test
```

> El import es necesario cada vez que rebuildeás una imagen. El script `dev-k8s.ps1` automatiza ambos pasos.

---

#### Paso 3 — Buildear todas las imágenes dentro de Minikube

Los microservicios Spring Boot usan la raíz de `microservices/` como contexto de build.
El frontend usa su propia carpeta como contexto.

```bash
# Microservicios Spring Boot (contexto: ./microservices)
docker build -f microservices/eureka-server/Dockerfile       -t pesito/eureka-server:latest       ./microservices
docker build -f microservices/api-gateway/Dockerfile         -t pesito/api-gateway:latest         ./microservices
docker build -f microservices/auth-service/Dockerfile        -t pesito/auth-service:latest        ./microservices
docker build -f microservices/transaction-service/Dockerfile -t pesito/transaction-service:latest ./microservices
docker build -f microservices/ai-service/Dockerfile          -t pesito/ai-service:latest          ./microservices

# Frontend (contexto: ./microservices/frontend-service)
docker build -f microservices/frontend-service/Dockerfile    -t pesito/frontend-service:latest    ./microservices/frontend-service
```

---

#### Paso 4 — Crear y configurar `k8s/01-secrets.yaml`

El archivo de secrets no está commiteado (está en `.gitignore`). Copiarlo desde el ejemplo:

```powershell
# PowerShell
Copy-Item k8s\01-secrets.example.yaml k8s\01-secrets.yaml
```

```bash
# Linux/Mac/WSL
cp k8s/01-secrets.example.yaml k8s/01-secrets.yaml
```

Editar `k8s/01-secrets.yaml` y reemplazar **todos** los valores `CHANGE_ME`:

| Campo | Descripción |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña del superusuario de PostgreSQL |
| `AUTH_DB_PASSWORD` | Contraseña del usuario `auth_user` |
| `TXN_DB_PASSWORD` | Contraseña del usuario `txn_user` |
| `MONGO_ROOT_PASSWORD` | Contraseña root de MongoDB |
| `MONGO_APP_PASSWORD` | Contraseña del usuario `ai_user` |
| `RABBITMQ_PASSWORD` | Contraseña del usuario `admin` de RabbitMQ |
| `MINIO_SECRET_KEY` | Secret key de MinIO (mínimo 8 caracteres) |
| `JWT_SECRET` | Secret para firmar JWTs (mínimo 64 caracteres hex) |
| `APP_ENCRYPTION_SECRET` | Cifrado AES-256-GCM de las API keys de usuario (mínimo 32 caracteres) |
| `INTERNAL_API_SECRET` | Secreto compartido auth-service ↔ ai-service (mínimo 32 caracteres) |
| `AI_DB_PASSWORD` | Contraseña del usuario `ai_db_user` (RAG/pgvector) |
| `GRAFANA_PASSWORD` | Contraseña del usuario `admin` de Grafana |

> Las API keys de IA (Claude/OpenAI/Gemini) **no van en secrets**: cada usuario carga la suya desde la app.

---

#### Paso 5 — Aplicar los manifiestos en orden

```bash
# 1. Namespace (debe existir antes que cualquier otro recurso)
kubectl apply -f k8s/00-namespace.yaml

# 2. Secrets y ConfigMaps
kubectl apply -f k8s/01-secrets.yaml
kubectl apply -f k8s/02-configmaps.yaml

# 3. Infraestructura (postgres, mongodb, rabbitmq, minio)
kubectl apply -f k8s/infrastructure/

# 4. Observabilidad (prometheus, grafana, loki, tempo, promtail)
kubectl apply -f k8s/infrastructure/observability/
```

Esperar a que la infraestructura core esté lista:

```bash
kubectl wait --for=condition=ready pod -l app=postgres  -n pesito --timeout=180s
kubectl wait --for=condition=ready pod -l app=rabbitmq  -n pesito --timeout=180s
kubectl wait --for=condition=ready pod -l app=mongodb   -n pesito --timeout=180s
kubectl wait --for=condition=ready pod -l app=minio     -n pesito --timeout=180s
```

```bash
# 5. Microservicios (eureka, api-gateway, auth, transaction, ai, frontend)
kubectl apply -f k8s/microservices/
```

---

#### Paso 6 — Verificar el estado

```bash
kubectl get pods -n pesito
kubectl get svc  -n pesito
```

Si algún pod queda en `CrashLoopBackOff` o `Pending`:

```bash
kubectl logs -n pesito deployment/<nombre-del-servicio>
kubectl describe pod -n pesito -l app=<nombre-del-servicio>
```

---

#### Paso 7 — Acceder a los servicios

Los NodePorts están mapeados a `localhost` gracias al `--port` del cluster create:

- API Gateway → `http://localhost:30080`
- Frontend → `http://localhost:30300`

**Herramientas internas (port-forward):**

```bash
kubectl port-forward -n pesito svc/grafana      3000:3000
kubectl port-forward -n pesito svc/eureka-server 8761:8761
kubectl port-forward -n pesito svc/rabbitmq     15672:15672
kubectl port-forward -n pesito svc/prometheus    9090:9090
kubectl port-forward -n pesito svc/minio         9001:9001
```

---

#### Paso 8 — Destruir el entorno

```bash
kubectl delete namespace pesito
```

---

### Referencia de puertos en K8s

| Servicio | Puerto interno | Acceso desde el host |
|---|---|---|
| API Gateway | `8080` | `localhost:30080` (NodePort) |
| Frontend | `3000` | `localhost:30300` (NodePort) |
| Eureka Dashboard | `8761` | port-forward → `localhost:8761` |
| RabbitMQ Management | `15672` | port-forward → `localhost:15672` |
| Grafana | `3000` | port-forward → `localhost:3000` |
| Prometheus | `9090` | port-forward → `localhost:9090` |
| MinIO Console | `9001` | port-forward → `localhost:9001` |
| Loki | `3100` | solo interno al cluster |
| Tempo | `3200` | solo interno al cluster |
| PostgreSQL | `5432` | solo interno al cluster |
| MongoDB | `27017` | solo interno al cluster |

---

### Desplegar en producción

**1. Buildear y publicar las imágenes en un registry**

```bash
docker build -f microservices/eureka-server/Dockerfile       -t tu-org/pesito-eureka:1.0.0       ./microservices
docker build -f microservices/api-gateway/Dockerfile         -t tu-org/pesito-gateway:1.0.0      ./microservices
docker build -f microservices/auth-service/Dockerfile        -t tu-org/pesito-auth:1.0.0         ./microservices
docker build -f microservices/transaction-service/Dockerfile -t tu-org/pesito-transaction:1.0.0  ./microservices
docker build -f microservices/ai-service/Dockerfile          -t tu-org/pesito-ai:1.0.0           ./microservices
docker build -f microservices/frontend-service/Dockerfile    -t tu-org/pesito-frontend:1.0.0     ./microservices/frontend-service

docker push tu-org/pesito-eureka:1.0.0
docker push tu-org/pesito-gateway:1.0.0
docker push tu-org/pesito-auth:1.0.0
docker push tu-org/pesito-transaction:1.0.0
docker push tu-org/pesito-ai:1.0.0
docker push tu-org/pesito-frontend:1.0.0
```

**2. Actualizar los nombres de imagen en los yamls**

En cada archivo de `k8s/microservices/` cambiar el campo `image:`:

```yaml
# Antes (local k3d)
image: pesito/auth-service:latest

# Después (producción)
image: tu-org/pesito-auth:1.0.0
```

**3. En producción, reemplazar NodePort por LoadBalancer o Ingress**

```yaml
# k8s/microservices/api-gateway.yaml
spec:
  type: LoadBalancer
```

---

## Troubleshooting

**Los pods se crearon pero el cluster está vacío**

kubectl apuntaba a otro contexto (ej: docker-desktop) cuando se aplicaron los manifiestos.

```powershell
kubectl config use-context k3d-local-test
kubectl get all -n pesito
# Si está vacío, volver al Paso 5 y aplicar los manifiestos de nuevo
```

---

**Los servicios no levantan / quedan en `starting`**

Los microservicios esperan que Eureka, PostgreSQL y RabbitMQ estén `healthy` antes de arrancar.

```bash
docker compose logs eureka-server --tail=30
docker compose logs postgres --tail=30
```

---

**403 en register o login**

```bash
docker compose up --build auth-service
```

---

**400 en endpoints de transacciones**

- El header `X-User-Id` requiere un UUID válido
- Ejecutar register/login primero para que `{{userId}}` quede seteado en Bruno

---

**Email ya registrado al hacer register**

```bash
docker compose down -v && docker compose up --build
```

---

**`auth-service` falla con `password authentication failed for user "auth_user"`**

El volumen `postgres_data` ya existía de un run anterior y el `init.sh` solo corre la primera vez.

Opción A — sin perder datos (crear los roles manualmente):

```bash
docker exec bb-postgres psql -U postgres -d pesito -c "
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS txn;
CREATE ROLE auth_user WITH LOGIN PASSWORD '<AUTH_DB_PASSWORD del .env>';
CREATE ROLE txn_user WITH LOGIN PASSWORD '<TXN_DB_PASSWORD del .env>';
GRANT USAGE, CREATE ON SCHEMA auth TO auth_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO auth_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO auth_user;
GRANT USAGE, CREATE ON SCHEMA txn TO txn_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA txn TO txn_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA txn TO txn_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON TABLES TO txn_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON SEQUENCES TO txn_user;
"
docker compose restart auth-service transaction-service
```

Opción B — resetear todo:

```bash
docker compose down -v && docker compose up --build
```

---

**La IA dice "No configuraste tu clave de API"**

- La key se carga **por usuario** en la app: Ajustes → Cuenta → seleccionar proveedor → pegar key → Guardar
- La key debe empezar con el prefijo correcto (`sk-ant-` Claude, `sk-` OpenAI, `AIza` Gemini)
- ai-service cachea las keys 60 segundos: tras guardarla, esperar un minuto antes de chatear

---

**La IA no responde / timeout**

- Revisar logs del ai-service: `docker compose logs ai-service -f`
- El parse tiene un timeout de 30 segundos; si el proveedor está sobrecargado, reintentar

---

**Un servicio no arranca con `IllegalStateException: ... no esta configurado` o `Could not resolve placeholder`**

Es el fail-fast de secretos. Falta una variable en `.env` (docker) o el secreto
tiene un valor de ejemplo/corto. Generar uno real con `openssl rand -hex 32` y completar `.env`.
Para correr sin Docker, usar el perfil `local`.

---

**Ver logs de un servicio específico**

```bash
docker compose logs ai-service          -f
docker compose logs auth-service        -f
docker compose logs transaction-service -f
docker compose logs frontend-service    -f
```

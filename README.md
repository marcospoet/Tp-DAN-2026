# BudgetBuddy — TP DAN 2026

Aplicación de gestión de finanzas personales construida con arquitectura de microservicios.
Trabajo Práctico — Desarrollo de Aplicaciones en la Nube — UTN FRSF.

---

## Arquitectura

```
          ┌──────────────┐     ┌───────────────────┐
          │    Browser   │     │   Bruno / Client   │
          └──────┬───────┘     └─────────┬──────────┘
                 │ :30300 (K8s)          │ :8080 (Docker)
                 │ :3000  (Docker)       │ :30080 (K8s)
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
Generar el JWT secret con:

```powershell
# PowerShell
$bytes = New-Object byte[] 64; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [System.BitConverter]::ToString($bytes).Replace('-','').ToLower()
```

```bash
# Linux / Mac / WSL
openssl rand -hex 64
```

### 3. Levantar todos los servicios

```bash
docker compose up --build
```

El primer build tarda varios minutos (descarga dependencias Maven).  
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

| Servicio | Puerto | URL (Docker Compose) |
|---|---|---|
| Frontend | `3000` | http://localhost:3000 |
| API Gateway | `8080` | http://localhost:8080 |
| auth-service | `8081` | http://localhost:8081 |
| transaction-service | `8082` | http://localhost:8082 |
| ai-service | `8083` | http://localhost:8083 |
| Eureka Dashboard | `8761` | http://localhost:8761 |
| RabbitMQ Management | `15672` | http://localhost:15672 |
| MinIO Console | `9001` | http://localhost:9001 |
| Grafana | `3000` | http://localhost:3000 |
| Prometheus | `9090` | http://localhost:9090 |
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

Los requests deben ejecutarse en orden porque los scripts de post-respuesta populan las variables de entorno:

```
1. auth-service / register   → crea usuario, guarda {{token}} y {{userId}}
2. auth-service / login      → refresca {{token}} y {{userId}}
3. auth-service / getProfile → usa {{token}}
4. transaction-service / *   → usa {{token}} y {{userId}}
```

### Variables de entorno (bruno/environments/local.bru)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `userEmail` | `test@budgetbuddy.com` | Email para register/login |
| `userPassword` | `password123` | Password para register/login |
| `token` | *(se setea automático)* | JWT devuelto por register/login |
| `userId` | *(se setea automático)* | UUID del usuario autenticado |

---

## Endpoints principales

### auth-service (`/api/auth`)

| Método | Path | Auth | Descripción |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | — | Registro con email/password |
| `POST` | `/api/auth/login` | — | Login, devuelve JWT |
| `GET` | `/api/auth/validate` | — | Validar token (usado por el Gateway) |
| `GET` | `/api/auth/profile` | JWT | Perfil del usuario autenticado |
| `PUT` | `/api/auth/profile` | JWT | Actualizar perfil |
| `DELETE` | `/api/auth/profile` | JWT | Eliminar cuenta |

### transaction-service (`/api/transactions`)

Todos los endpoints requieren `Authorization: Bearer <token>` y el header `X-User-Id: <uuid>`.

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/transactions` | Listar (paginado, filtro por fechas) |
| `POST` | `/api/transactions` | Crear transacción |
| `GET` | `/api/transactions/{id}` | Obtener por ID |
| `PUT` | `/api/transactions/{id}` | Actualizar |
| `DELETE` | `/api/transactions/{id}` | Eliminar |
| `GET` | `/api/exchange-rates` | Cotizaciones ARS/USD actuales |

### Swagger UI

Cada microservicio expone su documentación interactiva:

- auth-service: http://localhost:8081/swagger-ui.html
- transaction-service: http://localhost:8082/swagger-ui.html

---

## Base de datos

PostgreSQL usa dos schemas separados con usuarios dedicados:

| Schema | Usuario | Servicio propietario |
|---|---|---|
| `auth` | `auth_user` | auth-service |
| `txn` | `txn_user` | transaction-service |

Las migraciones las gestiona **Flyway** automáticamente al arrancar cada servicio.  
Los scripts están en `src/main/resources/db/migration/` de cada microservicio.

### Resetear la base de datos

Para borrar todos los datos y volver al estado inicial:

```bash
docker compose down -v
docker compose up --build
```

Para borrar solo un usuario específico (sin perder el resto):

```bash
docker exec -it bb-postgres psql -U postgres -d budgetbuddy \
  -c "DELETE FROM auth.users WHERE email = 'test@budgetbuddy.com';"
```

---

## Mensajería asincrónica (RabbitMQ)

| Evento | Publicado por | Consumido por |
|---|---|---|
| `user.registered` | auth-service | *(ai-service, futuro)* |
| `user.deleted` | auth-service | transaction-service |
| `transaction.created` | transaction-service | *(ai-service, futuro)* |

---

## Observabilidad

| Herramienta | URL | Descripción |
|---|---|---|
| Grafana | http://localhost:3000 | Dashboards (user: `admin`) |
| Prometheus | http://localhost:9090 | Métricas en tiempo real |
| Loki | http://localhost:3100 | Logs centralizados |
| Tempo | http://localhost:3200 | Distributed tracing |

Cada microservicio expone métricas en `/actuator/prometheus`.

---

## Desarrollo local (sin Docker)

Para correr un microservicio de forma aislada, levantá la infraestructura con Docker y corré el servicio con Maven:

```bash
# Desde la raíz del repo — levanta solo la infraestructura
docker compose up postgres rabbitmq eureka-server -d
```

```bash
# Desde microservices/ — corre el servicio
cd microservices
mvn -pl auth-service spring-boot:run "-Dspring-boot.run.profiles=local"
```

El perfil `local` usa las credenciales definidas en `application-local.properties`.

---

## Estructura del repositorio

```
tp-dan-2026/
├── microservices/
│   ├── pom.xml                  ← parent POM (gestiona versiones)
│   ├── eureka-server/           ← Service Discovery
│   ├── api-gateway/             ← Spring Cloud Gateway
│   ├── auth-service/            ← Autenticación y perfiles
│   ├── transaction-service/     ← Transacciones financieras
│   ├── ai-service/              ← Asistente IA (en desarrollo)
│   └── frontend-service/        ← Next.js (UI web)
├── infrastructure/
│   ├── postgres/                ← init.sh (crea schemas y usuarios)
│   ├── mongodb/                 ← init-mongo.js
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
│   └── transaction-service/
├── docker-compose.yml
├── .env.example                 ← Plantilla de variables de entorno
└── README.md
```

---

## Kubernetes

Los manifiestos en `k8s/` están listos para cualquier cluster K8s (Minikube, EKS, GKE, AKS).

### Arquitectura de red en K8s

| Servicio | Tipo | Acceso externo |
|---|---|---|
| api-gateway | `NodePort 30080` | `<minikube-ip>:30080` |
| frontend-service | `NodePort 30300` | `<minikube-ip>:30300` |
| El resto (infraestructura, observabilidad) | `ClusterIP` | port-forward |

---

### Probar en local con Minikube

**Requisitos:** [Minikube](https://minikube.sigs.k8s.io/docs/start/) y kubectl instalados.

---

#### Paso 1 — Arrancar Minikube con recursos suficientes

```powershell
minikube start --memory=6144 --cpus=4
minikube status
```

> **Importante:** `minikube start` debería cambiar el contexto de kubectl automáticamente, pero si tenés Docker Desktop instalado puede quedar apuntando al cluster equivocado. Verificar y corregir:
>
> ```powershell
> # Verificar contexto actual
> kubectl config current-context
> # Debe decir "minikube". Si dice "docker-desktop", cambiar:
> kubectl config use-context minikube
> ```

---

#### Paso 2 — Apuntar Docker al daemon interno de Minikube

Este paso hace que las imágenes buildeadas queden dentro del cluster en vez de en tu Docker local.

```powershell
# PowerShell
minikube docker-env | Invoke-Expression

# Verificar que apunta al daemon correcto (debe mostrar "minikube")
docker info | Select-String "Name"
```

```bash
# Linux/Mac/WSL
eval $(minikube docker-env)
docker info | grep Name
```

> Este paso es **por sesión de terminal**. Si abrís una terminal nueva, repetilo antes de buildear.

---

#### Paso 3 — Buildear todas las imágenes dentro de Minikube

Los microservicios Spring Boot usan la raíz de `microservices/` como contexto de build.  
El frontend usa su propia carpeta como contexto.

```bash
# Microservicios Spring Boot (contexto: ./microservices)
docker build -f microservices/eureka-server/Dockerfile       -t budgetbuddy/eureka-server:latest       ./microservices
docker build -f microservices/api-gateway/Dockerfile         -t budgetbuddy/api-gateway:latest         ./microservices
docker build -f microservices/auth-service/Dockerfile        -t budgetbuddy/auth-service:latest        ./microservices
docker build -f microservices/transaction-service/Dockerfile -t budgetbuddy/transaction-service:latest ./microservices
docker build -f microservices/ai-service/Dockerfile          -t budgetbuddy/ai-service:latest          ./microservices

# Frontend (contexto: ./microservices/frontend-service)
docker build -f microservices/frontend-service/Dockerfile    -t budgetbuddy/frontend-service:latest    ./microservices/frontend-service

# Verificar que todas quedaron disponibles (Linux/Mac/WSL)
docker images | grep budgetbuddy
```

```powershell
# Verificar que todas quedaron disponibles (PowerShell)
docker images | Select-String "budgetbuddy"
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

Generar un JWT_SECRET seguro de al menos 64 caracteres:

```powershell
# PowerShell (Windows)
$bytes = New-Object byte[] 64; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [System.BitConverter]::ToString($bytes).Replace('-','').ToLower()
```

```bash
# Linux / Mac / WSL
openssl rand -hex 64
```

Editar `k8s/01-secrets.yaml` y reemplazar **todos** los valores `CHANGE_ME` con credenciales reales.  
Los campos disponibles son:

| Campo | Descripción |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña del superusuario de PostgreSQL |
| `AUTH_DB_PASSWORD` | Contraseña del usuario `auth_user` |
| `TXN_DB_PASSWORD` | Contraseña del usuario `txn_user` |
| `MONGO_ROOT_PASSWORD` | Contraseña root de MongoDB |
| `MONGO_APP_PASSWORD` | Contraseña del usuario `ai_user` |
| `RABBITMQ_PASSWORD` | Contraseña del usuario `admin` de RabbitMQ |
| `MINIO_SECRET_KEY` | Secret key de MinIO (mínimo 8 caracteres) |
| `JWT_SECRET` | Secret para firmar JWTs (mínimo 64 caracteres) |
| `GRAFANA_PASSWORD` | Contraseña del usuario `admin` de Grafana |

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

Esperar a que la infraestructura core esté lista antes de levantar los microservicios:

```bash
kubectl wait --for=condition=ready pod -l app=postgres  -n budgetbuddy --timeout=180s
kubectl wait --for=condition=ready pod -l app=rabbitmq  -n budgetbuddy --timeout=180s
kubectl wait --for=condition=ready pod -l app=mongodb   -n budgetbuddy --timeout=180s
kubectl wait --for=condition=ready pod -l app=minio     -n budgetbuddy --timeout=180s
```

```bash
# 5. Microservicios (eureka, api-gateway, auth, transaction, ai, frontend)
kubectl apply -f k8s/microservices/
```

---

#### Paso 6 — Verificar el estado

```bash
# Ver todos los pods del namespace
kubectl get pods -n budgetbuddy

# Ver todos los servicios y sus puertos
kubectl get svc -n budgetbuddy
```

Todos los pods deben llegar a estado `Running`. Si alguno queda en `CrashLoopBackOff` o `Pending`:

```bash
# Ver logs del contenedor
kubectl logs -n budgetbuddy deployment/<nombre-del-servicio>

# Ver eventos del pod (útil para errores de scheduling o imagen no encontrada)
kubectl describe pod -n budgetbuddy -l app=<nombre-del-servicio>
```

Ejemplo para auth-service:

```bash
kubectl logs -n budgetbuddy deployment/auth-service --tail=50
kubectl describe pod -n budgetbuddy -l app=auth-service
```

---

#### Paso 7 — Acceder a los servicios

**API Gateway y Frontend (NodePort — acceso directo sin port-forward)**

```bash
# Obtener la IP de Minikube
minikube ip

# Abrir directamente en el browser
minikube service api-gateway      -n budgetbuddy
minikube service frontend-service -n budgetbuddy
```

Los NodePorts fijos son:
- API Gateway → `http://<minikube-ip>:30080`
- Frontend → `http://<minikube-ip>:30300`

Con el API Gateway en `<minikube-ip>:30080`, actualizar el environment de Bruno para que la variable `baseUrl` apunte a esa dirección.

**Herramientas internas (ClusterIP — requieren port-forward)**

Abrir cada uno en una terminal separada (o en background con `&` en bash):

```bash
# Grafana — dashboards
kubectl port-forward -n budgetbuddy svc/grafana 3000:3000

# Eureka Dashboard
kubectl port-forward -n budgetbuddy svc/eureka-server 8761:8761

# RabbitMQ Management
kubectl port-forward -n budgetbuddy svc/rabbitmq 15672:15672

# Prometheus
kubectl port-forward -n budgetbuddy svc/prometheus 9090:9090

# MinIO Console
kubectl port-forward -n budgetbuddy svc/minio 9001:9001
```

```powershell
# PowerShell: ejecutar varios port-forwards en background
Start-Job { kubectl port-forward -n budgetbuddy svc/grafana 3000:3000 }
Start-Job { kubectl port-forward -n budgetbuddy svc/eureka-server 8761:8761 }
Start-Job { kubectl port-forward -n budgetbuddy svc/rabbitmq 15672:15672 }
```

---

#### Paso 8 — Destruir el entorno

```bash
# Elimina todos los recursos del namespace (pods, services, PVCs, etc.)
kubectl delete namespace budgetbuddy
```

---

### Referencia de puertos en K8s

| Servicio | Puerto interno | Acceso desde el host |
|---|---|---|
| API Gateway | `8080` | `<minikube-ip>:30080` (NodePort) |
| Frontend | `3000` | `<minikube-ip>:30300` (NodePort) |
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
# Reemplazar "tu-org" con tu usuario/organización de Docker Hub
docker build -f microservices/eureka-server/Dockerfile       -t tu-org/budgetbuddy-eureka:1.0.0       ./microservices
docker build -f microservices/api-gateway/Dockerfile         -t tu-org/budgetbuddy-gateway:1.0.0      ./microservices
docker build -f microservices/auth-service/Dockerfile        -t tu-org/budgetbuddy-auth:1.0.0         ./microservices
docker build -f microservices/transaction-service/Dockerfile -t tu-org/budgetbuddy-transaction:1.0.0  ./microservices
docker build -f microservices/ai-service/Dockerfile          -t tu-org/budgetbuddy-ai:1.0.0           ./microservices
docker build -f microservices/frontend-service/Dockerfile    -t tu-org/budgetbuddy-frontend:1.0.0     ./microservices/frontend-service

docker push tu-org/budgetbuddy-eureka:1.0.0
docker push tu-org/budgetbuddy-gateway:1.0.0
docker push tu-org/budgetbuddy-auth:1.0.0
docker push tu-org/budgetbuddy-transaction:1.0.0
docker push tu-org/budgetbuddy-ai:1.0.0
docker push tu-org/budgetbuddy-frontend:1.0.0
```

**2. Actualizar los nombres de imagen en los yamls**

En cada archivo de `k8s/microservices/` cambiar el campo `image:` para que apunte al registry:

```yaml
# Antes (local Minikube)
image: budgetbuddy/auth-service:latest

# Después (producción)
image: tu-org/budgetbuddy-auth:1.0.0
```

Los archivos a editar son los 6 de `k8s/microservices/`.

**3. Aplicar los manifiestos**

El orden es el mismo que en local (Pasos 5 en adelante).  
El cluster baja las imágenes del registry automáticamente (`imagePullPolicy: IfNotPresent`).

**4. Exponer el API Gateway**

En producción, reemplazar el `NodePort` del api-gateway y del frontend por `LoadBalancer` o agregar un `Ingress`:

```yaml
# k8s/microservices/api-gateway.yaml — cambiar el tipo del Service
spec:
  type: LoadBalancer   # en vez de NodePort
```

---

## Troubleshooting

**Los pods se crearon pero en Minikube no aparece nada / `minikube service` da SVC_NOT_FOUND**

kubectl apuntaba a Docker Desktop en vez de Minikube cuando se aplicaron los manifiestos. Todo se deployó en el cluster equivocado.

```powershell
# 1. Cambiar al contexto correcto
kubectl config use-context minikube

# 2. Verificar que el namespace budgetbuddy está vacío
kubectl get all -n budgetbuddy

# 3. Si está vacío, volver al Paso 5 y aplicar los manifiestos de nuevo
```

---

**Los servicios no levantan / quedan en `starting`**

Los microservicios esperan que Eureka, PostgreSQL y RabbitMQ estén `healthy` antes de arrancar.
Si hay un problema, revisar los logs:

```bash
docker compose logs eureka-server --tail=30
docker compose logs postgres --tail=30
```

**403 en register o login**

- Verificar que el servicio esté corrido con el código actualizado: `docker compose up --build auth-service`
- Verificar que el environment `local` esté seleccionado en Bruno

**400 en endpoints de transacciones**

- El header `X-User-Id` requiere un UUID válido
- Ejecutar register/login primero para que `{{userId}}` quede seteado en el environment de Bruno

**Email ya registrado al hacer register**

```bash
docker compose down -v && docker compose up --build
```

**`auth-service` falla con `password authentication failed for user "auth_user"`**

El volumen `postgres_data` ya existía de un run anterior y el `init.sh` solo corre la primera vez. Los roles `auth_user`/`txn_user` nunca fueron creados (o quedaron con otra contraseña).

Opción A — sin perder datos (crear los roles manualmente):

```bash
docker exec bb-postgres psql -U postgres -d budgetbuddy -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS txn;"
docker exec bb-postgres psql -U postgres -d budgetbuddy -c "CREATE ROLE auth_user WITH LOGIN PASSWORD '<AUTH_DB_PASSWORD del .env>';"
docker exec bb-postgres psql -U postgres -d budgetbuddy -c "CREATE ROLE txn_user WITH LOGIN PASSWORD '<TXN_DB_PASSWORD del .env>';"
docker exec bb-postgres psql -U postgres -d budgetbuddy -c "
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

Opción B — resetear todo (borra los datos):

```bash
docker compose down -v && docker compose up --build
```

---

**Ver logs de un servicio específico**

```bash
docker compose logs auth-service -f
docker compose logs transaction-service -f
```

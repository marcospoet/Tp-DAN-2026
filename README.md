# BudgetBuddy — TP DAN 2026

Aplicación de gestión de finanzas personales construida con arquitectura de microservicios.
Trabajo Práctico — Desarrollo de Aplicaciones en la Nube — UTN FRSF.

---

## Arquitectura

```
                        ┌──────────────────┐
                        │   Bruno / Client  │
                        └────────┬─────────┘
                                 │ :8080
                        ┌────────▼─────────┐
                        │   API Gateway    │  ← único punto de entrada público
                        └────────┬─────────┘
                                 │ Eureka lb://
               ┌─────────────────┼─────────────────┐
               │                 │                 │
      ┌────────▼───────┐ ┌───────▼──────┐ ┌───────▼──────┐
      │  auth-service  │ │transaction-  │ │  ai-service  │
      │    :8081       │ │  service     │ │    :8083     │
      │                │ │   :8082      │ └──────┬───────┘
      └────────┬───────┘ └──────┬───────┘        │
               │                │                │
         ┌─────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
         │ PostgreSQL  │  │ PostgreSQL  │  │  MongoDB   │
         │ schema:auth │  │ schema:txn  │  │   ai_db    │
         └─────────────┘  └─────────────┘  └────────────┘
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

```bash
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

| Servicio | Puerto | URL |
|---|---|---|
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

> En producción, solo el puerto `8080` (API Gateway) debería estar expuesto públicamente.

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
# Levantar solo la infraestructura
docker compose up postgres rabbitmq eureka-server -d

# Correr auth-service con perfil local
cd microservices
mvn -pl auth-service spring-boot:run -Dspring-boot.run.profiles=local
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
│   └── ai-service/              ← Asistente IA (en desarrollo)
├── infrastructure/
│   ├── postgres/                ← init.sh (crea schemas y usuarios)
│   ├── mongodb/                 ← init-mongo.js
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   ├── tempo/
│   └── promtail/
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

## Troubleshooting

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

**Ver logs de un servicio específico**

```bash
docker compose logs auth-service -f
docker compose logs transaction-service -f
```

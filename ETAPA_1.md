# Entrega Etapa 1 — BudgetBuddy
**Materia:** Desarrollo de Aplicaciones en la Nube — UTN FRSF 2026  
**Fecha de entrega:** 27 de mayo de 2026  
**Integrante:** Marcos Joaquin Poët y Marcos Joaquin Pividori

---

## 1. Propuesta del problema

### Idea general de la aplicación

**BudgetBuddy** es una aplicación web de gestión de finanzas personales. Permite a los usuarios registrar, categorizar y analizar sus ingresos y egresos diarios, con soporte para múltiples monedas (ARS/USD), almacenamiento de comprobantes digitales y un asistente de inteligencia artificial que responde preguntas sobre el estado financiero del usuario.

**Problema que resuelve:**  
La mayoría de las personas no lleva un registro ordenado de sus gastos. Las planillas manuales son propensas a errores, los bancos no consolidan información entre billeteras y aplicaciones, y no existe retroalimentación inteligente sobre los hábitos de consumo. BudgetBuddy centraliza el registro financiero y agrega valor a través de la categorización automática, la conversión de moneda en tiempo real y el análisis por IA.

---

### Microservicios necesarios y delimitación del alcance

La aplicación podría abarcar funcionalidades como presupuestos por categoría, metas de ahorro, integración directa con homebanking, notificaciones push, reportes exportables en PDF/Excel y gastos compartidos entre usuarios. Para el TP se delimita el alcance a lo siguiente:

**Dentro del alcance (TP):**
- Registro y autenticación de usuarios con JWT
- Gestión de cuentas (billeteras/bancos): cada usuario puede crear múltiples cuentas (ej: Mercado Pago, Banco Galicia, efectivo) y designar una como cuenta por defecto
- CRUD de transacciones (ingresos y egresos) con categorización, asociadas a una cuenta específica
- Balance total y balance desagregado por cuenta
- Conversión de moneda ARS ↔ USD (tipo de cambio vía API externa)
- Subida y visualización de comprobantes digitales (fotos de tickets)
- Chat con asistente IA sobre las finanzas del usuario, con conciencia de cuentas
- Observabilidad: logs centralizados, métricas y trazas distribuidas

**Fuera del alcance:**
- Transferencias entre cuentas propias
- Presupuestos mensuales por categoría
- Metas de ahorro
- Integración directa con homebanking/APIs bancarias
- Notificaciones push
- Exportación de reportes (PDF/Excel)
- Gastos compartidos (split de gastos entre usuarios)
- Dashboard administrativo con gestión de usuarios

---

## 2. Microservicios: responsabilidades y tecnologías

### Diagrama de arquitectura

```
                        ┌─────────────────────────────────────────┐
                        │            CLIENTE (Browser)             │
                        └────────────────────┬────────────────────┘
                                             │ HTTPS :8080
                        ┌────────────────────▼────────────────────┐
                        │              API GATEWAY                 │
                        │   Spring Cloud Gateway + Resilience4J    │
                        │   JWT Filter │ Routing │ Circuit Breaker  │
                        └───────┬──────────┬──────────────┬────────┘
                                │          │              │
               ┌────────────────▼──┐  ┌────▼───────────┐ ┌▼──────────────┐
               │   auth-service    │  │transaction-svc │ │  ai-service   │
               │  :8081 PostgreSQL │  │ :8082 PostgreSQL│ │ :8083 MongoDB │
               │  schema "auth"    │  │  schema "txn"  │ │               │
               └────────┬──────────┘  └────┬───────────┘ └───────────────┘
                        │                  │
                        └─────────┬────────┘
                                  │ RabbitMQ (user.created events)
                        ┌─────────▼────────┐
                        │   eureka-server  │
                        │ Service Discovery│
                        │      :8761       │
                        └──────────────────┘

  Infraestructura transversal:
  MinIO (comprobantes) │ Prometheus + Grafana (métricas) │ Loki + Promtail (logs) │ Tempo (trazas)
```

---

### 2.1 eureka-server

| | |
|---|---|
| **Puerto** | 8761 |
| **Responsabilidades** | Registro y descubrimiento de instancias de microservicios. Todos los servicios se registran en el arranque y consultan a Eureka para resolver las direcciones de sus pares. Permite escalar horizontalmente sin hardcodear IPs. |
| **Tecnologías** | Spring Boot 3.2.5, Spring Cloud Netflix Eureka Server, Java 21 |

---

### 2.2 api-gateway

| | |
|---|---|
| **Puerto** | 8080 (único punto de entrada público) |
| **Responsabilidades** | Enrutamiento de requests hacia los microservicios según el path (`/api/auth/**`, `/api/transactions/**`, `/api/ai/**`). Validación de JWT: extrae el `userId` del token y lo propaga al servicio destino como header `X-User-Id`. Aplica Circuit Breaker (Resilience4J) para tolerancia a fallos. Expone métricas para Prometheus. |
| **Tecnologías** | Spring Cloud Gateway, Resilience4J (Circuit Breaker), Spring Boot 3.2.5, Java 21, Micrometer |

---

### 2.3 auth-service

| | |
|---|---|
| **Puerto** | 8081 |
| **Responsabilidades** | Registro de usuarios con contraseña hasheada (BCrypt). Login con emisión de JWT (access token). Validación de tokens para uso interno del gateway. Gestión de perfil de usuario (nombre, presupuesto mensual, preferencia de tipo de cambio, proveedor de IA y API keys). Publica eventos `user.created` en RabbitMQ para que otros servicios sincronicen datos de usuario. |
| **Tecnologías** | Spring Security, JJWT 0.12.5, Spring Data JPA, PostgreSQL (schema `auth`), RabbitMQ (Spring AMQP), Spring Boot 3.2.5, Java 21, OpenAPI/Swagger |

**Entidades:**
- `users`: id, email, password_hash, provider, provider_id, timestamps
- `profiles`: id (FK users), user_name, monthly_budget, profile_mode, exchange_rate_mode, usd_rate, ai_provider, api_key_claude/openai/gemini

---

### 2.4 transaction-service

| | |
|---|---|
| **Puerto** | 8082 |
| **Responsabilidades** | Gestión de cuentas del usuario (billeteras, bancos, efectivo): CRUD de cuentas, cálculo de balance por cuenta y balance total. CRUD completo de transacciones financieras asociadas a una cuenta; si no se especifica cuenta al crear la transacción se usa la cuenta marcada como `is_default`. Cada transacción tiene tipo (INCOME/EXPENSE), categoría, importe, moneda (ARS/USD), tasa de cambio aplicada y referencia a comprobante. Consume cotizaciones en tiempo real de una API externa de tipos de cambio. Almacena comprobantes digitales en MinIO. Consume eventos `user.created` de RabbitMQ (crea cuenta por defecto "Efectivo" automáticamente al registrarse el usuario). Publica eventos `transaction.created`. Soporta paginación y filtrado por cuenta, rango de fechas y categoría. |
| **Tecnologías** | Spring Data JPA, PostgreSQL (schema `txn`), MinIO (SDK Java), WebClient (API de tipo de cambio), RabbitMQ (Spring AMQP), Spring Boot 3.2.5, Java 21, OpenAPI/Swagger |

**Entidades:**
- `accounts`: id, user_id, name, type (CASH/BANK/DIGITAL_WALLET), currency, icon, color, is_default, created_at, updated_at
- `transactions`: id, user_id, **account_id** (FK accounts, nullable → usa cuenta default), description, amount, type, icon, category, date, observation, currency, amount_usd, tx_rate, exchange_rate_type, receipt_url, is_recurring, timestamps
- `receipts`: referencia al objeto almacenado en MinIO

> El balance por cuenta se calcula dinámicamente como `SUM(INCOME) - SUM(EXPENSE)` sobre las transacciones de esa cuenta. No se almacena un saldo corriente para evitar inconsistencias.

---

### 2.5 ai-service

| | |
|---|---|
| **Puerto** | 8083 |
| **Responsabilidades** | Provee un endpoint de chat donde el usuario puede hacer preguntas en lenguaje natural sobre sus finanzas ("¿Cuánto gasté en comida este mes?", "¿Cuánto tengo en Mercado Pago?", "Dame un resumen por cuenta"). Antes de llamar al LLM, consulta al transaction-service para obtener el resumen de cuentas (nombre, balance, moneda) y las transacciones recientes, construyendo un contexto enriquecido. Si la pregunta refiere a una cuenta específica, filtra el contexto por esa cuenta; si no puede determinar la cuenta, usa la cuenta por defecto del usuario. Soporta múltiples proveedores de IA configurables por perfil: Claude (Anthropic), OpenAI, Gemini. Persiste el historial de conversaciones en MongoDB. |
| **Tecnologías** | Spring Boot 3.2.5, Java 21, Spring Data MongoDB, MongoDB, WebClient (llamadas a APIs de LLM y a transaction-service), Spring AMQP (RabbitMQ) |

---

## 3. Mockups de pantallas principales

### Pantalla 1 — Login / Registro

```
┌─────────────────────────────────────────────┐
│                                             │
│              💰 BudgetBuddy                 │
│        Tu control financiero personal       │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  [Iniciar sesión]  [Registrarse]    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Email                              │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ usuario@email.com             │  │   │
│  │  └───────────────────────────────┘  │   │
│  │                                     │   │
│  │  Contraseña                         │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ ••••••••                      │  │   │
│  │  └───────────────────────────────┘  │   │
│  │                                     │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │      Iniciar sesión           │  │   │
│  │  └───────────────────────────────┘  │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Pantalla 2 — Dashboard principal

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 BudgetBuddy        Hola, Marcos          [⚙ Perfil] [Salir] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  BALANCE TOTAL  │  │   INGRESOS      │  │    EGRESOS      │  │
│  │                 │  │   mayo 2026     │  │   mayo 2026     │  │
│  │  $ 47.350,00    │  │  $ 185.000,00   │  │  $ 137.650,00   │  │
│  │      ARS        │  │  ▲ +12% vs mes  │  │  ▼ -5% vs mes  │  │
│  │  USD 31,57      │  │    anterior     │  │    anterior     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  Mis cuentas                                    [+ Nueva cuenta] │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🏦 Banco Galicia      $ 25.000,00 ARS   ████████░░  53%  │  │
│  │  📱 Mercado Pago       $ 18.350,00 ARS   ██████░░░░  39%  │  │
│  │  💵 Efectivo           $  4.000,00 ARS   █░░░░░░░░░   8%  │  │
│  │                                                            │  │
│  │                   TOTAL  $ 47.350,00 ARS                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Gastos por categoría (mayo)        Últimas transacciones        │
│  ┌──────────────────────────┐       ┌───────────────────────────┐│
│  │ Comida       ████░  42%  │       │ 26/05 🛒 Supermercado    ││
│  │ Transporte   ███░░  28%  │       │  -$4.500 · Mercado Pago  ││
│  │ Servicios    ██░░░  18%  │       ├───────────────────────────┤│
│  │ Ocio         █░░░░  12%  │       │ 25/05 💰 Sueldo          ││
│  └──────────────────────────┘       │  +$185.000 · B. Galicia  ││
│                                     ├───────────────────────────┤│
│  [+ Nueva transacción]              │ 24/05 🚌 SUBE            ││
│  [💬 Chatear con IA]                │  -$850 · Mercado Pago    ││
│                                     └───────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

### Pantalla 3 — Historial de transacciones

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 BudgetBuddy                                  [+ Nueva]       │
├──────────────────────────────────────────────────────────────────┤
│  Transacciones                                                   │
│                                                                  │
│  Filtros:  Desde [01/05/2026]  Hasta [31/05/2026]               │
│            Tipo: [Todos ▼]  Categoría: [Todas ▼]                │
│            Cuenta: [Todas ▼]                    [Aplicar]       │
│                                                                  │
│  ┌────┬────────────┬──────────────────┬────────────┬──────────┐  │
│  │Icn │   Fecha    │   Descripción    │  Cuenta    │ Importe  │  │
│  ├────┼────────────┼──────────────────┼────────────┼──────────┤  │
│  │ 💰 │ 25/05/2026 │ Sueldo           │🏦 Galicia  │+185.000 ││
│  │    │            │ INCOME · Salario │            │   ARS    │  │
│  ├────┼────────────┼──────────────────┼────────────┼──────────┤  │
│  │ 🛒 │ 26/05/2026 │ Supermercado Día │📱 M. Pago  │  -4.500 ││
│  │    │            │ EXPENSE · Comida │         📎 │   ARS    │  │
│  ├────┼────────────┼──────────────────┼────────────┼──────────┤  │
│  │ 🚌 │ 24/05/2026 │ Carga SUBE       │📱 M. Pago  │    -850 ││
│  │    │            │ EXPENSE · Transp.│            │   ARS    │  │
│  ├────┼────────────┼──────────────────┼────────────┼──────────┤  │
│  │ 🌐 │ 23/05/2026 │ Netflix          │📱 M. Pago  │   -6,99 ││
│  │    │            │ EXPENSE · Serv.  │            │   USD    │  │
│  └────┴────────────┴──────────────────┴────────────┴──────────┘  │
│                                                                  │
│  Página 1 de 3          [← Anterior]  [Siguiente →]             │
└──────────────────────────────────────────────────────────────────┘
```

---

### Pantalla 4 — Nueva / Editar transacción

```
┌────────────────────────────────────────────────┐
│  Nueva transacción                      [✕]    │
├────────────────────────────────────────────────┤
│                                                │
│  Tipo:   (●) EGRESO   ( ) INGRESO             │
│                                                │
│  Descripción                                   │
│  ┌────────────────────────────────────────┐   │
│  │ Ej: Supermercado, Sueldo, Alquiler... │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  Importe              Moneda                   │
│  ┌──────────────────┐  ┌──────────────┐       │
│  │ 4500.00          │  │  ARS      ▼ │       │
│  └──────────────────┘  └──────────────┘       │
│  Tipo de cambio: 1 USD = $1.497,50 ARS         │
│                                                │
│  Cuenta                                        │
│  ┌────────────────────────────────────────┐   │
│  │ 📱 Mercado Pago (por defecto)       ▼ │   │
│  └────────────────────────────────────────┘   │
│  ⓘ Si no seleccionás cuenta se usa la         │
│    cuenta por defecto de tu perfil.            │
│                                                │
│  Categoría                  Fecha              │
│  ┌──────────────────────┐  ┌──────────────┐   │
│  │ Comida            ▼ │  │ 27/05/2026  │   │
│  └──────────────────────┘  └──────────────┘   │
│                                                │
│  Observación (opcional)                        │
│  ┌────────────────────────────────────────┐   │
│  │                                        │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  Comprobante (opcional)                        │
│  ┌────────────────────────────────────────┐   │
│  │  [📎 Adjuntar imagen de ticket]        │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  ┌───────────────┐  ┌───────────────────────┐ │
│  │    Cancelar   │  │     Guardar            │ │
│  └───────────────┘  └───────────────────────┘ │
└────────────────────────────────────────────────┘
```

---

### Pantalla 5 — Chat con asistente IA

```
┌──────────────────────────────────────────────────────────────────┐
│  💬 Asistente financiero IA                      [Limpiar chat] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │   🤖  Hola Marcos! Soy tu asistente financiero.           │  │
│  │       Tenés 3 cuentas: Banco Galicia ($25.000),           │  │
│  │       Mercado Pago ($18.350) y Efectivo ($4.000).         │  │
│  │       Balance total: $47.350 ARS. ¿En qué te ayudo?      │  │
│  │                                                            │  │
│  │             ┌──────────────────────────────────────────┐  │  │
│  │             │ ¿Cuánto tengo en Mercado Pago?           │ 👤│  │
│  │             └──────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │   🤖  En Mercado Pago tenés $18.350 ARS.                  │  │
│  │       Este mes ingresaron $0 y salieron $19.650           │  │
│  │       en 8 transacciones (comida, transporte, Netflix).   │  │
│  │                                                            │  │
│  │             ┌──────────────────────────────────────────┐  │  │
│  │             │ ¿Y cuánto gasté en comida este mes?      │ 👤│  │
│  │             └──────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │   🤖  Gastaste $57.800 ARS en comida durante mayo:        │  │
│  │       • $41.200 desde Mercado Pago (pago con QR)         │  │
│  │       • $16.600 desde Banco Galicia (débito)             │  │
│  │       Los 3 gastos más altos: Carrefour $12.300,         │  │
│  │       El Rancho $8.900, Supermercado Día $4.500.         │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐  [▶]   │
│  │  Escribí tu pregunta...                            │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                  │
│  Sugerencias: [Balance por cuenta] [¿Puedo ahorrar más?]       │
│               [Comparar cuentas] [Resumen del mes]              │
└──────────────────────────────────────────────────────────────────┘
```

---

### Pantalla 6 — Gestión de cuentas

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 BudgetBuddy  >  Mis cuentas                   [+ Nueva]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🏦  Banco Galicia                              [✏] [🗑]  │  │
│  │      Tipo: BANK · ARS                                      │  │
│  │      Balance: $ 25.000,00 ARS   ★ Cuenta por defecto       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  📱  Mercado Pago                               [✏] [🗑]  │  │
│  │      Tipo: DIGITAL_WALLET · ARS                            │  │
│  │      Balance: $ 18.350,00 ARS                              │  │
│  │      [Establecer como predeterminada]                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💵  Efectivo                                   [✏] [🗑]  │  │
│  │      Tipo: CASH · ARS                                      │  │
│  │      Balance: $  4.000,00 ARS                              │  │
│  │      [Establecer como predeterminada]                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ────────────────────────────────────────────────────────────    │
│  BALANCE TOTAL: $ 47.350,00 ARS  (equiv. USD 31,57)             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Modal — Nueva / Editar cuenta

```
┌──────────────────────────────────────────┐
│  Nueva cuenta                     [✕]   │
├──────────────────────────────────────────┤
│                                          │
│  Nombre                                  │
│  ┌────────────────────────────────────┐  │
│  │ Ej: Mercado Pago, Galicia...       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Tipo                                    │
│  ┌────────────────────────────────────┐  │
│  │  Billetera digital             ▼  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Moneda          Ícono                   │
│  ┌────────────┐  ┌──────────────────┐   │
│  │  ARS    ▼ │  │  📱           ▼ │   │
│  └────────────┘  └──────────────────┘   │
│                                          │
│  [ ] Establecer como cuenta por defecto  │
│                                          │
│  ┌─────────────┐  ┌───────────────────┐ │
│  │   Cancelar  │  │      Guardar      │ │
│  └─────────────┘  └───────────────────┘ │
└──────────────────────────────────────────┘
```

---

### Pantalla 7 — Configuración / Perfil

```
┌───────────────────────────────────────────────────────┐
│  Perfil y configuración                               │
├───────────────────────────────────────────────────────┤
│                                                       │
│  DATOS PERSONALES                                     │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Nombre de usuario                              │ │
│  │  ┌─────────────────────────────────────────┐   │ │
│  │  │ Marcos                                  │   │ │
│  │  └─────────────────────────────────────────┘   │ │
│  │                                                 │ │
│  │  Email (solo lectura)                           │ │
│  │  ┌─────────────────────────────────────────┐   │ │
│  │  │ marcos@email.com                        │   │ │
│  │  └─────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  TIPO DE CAMBIO                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Modo:  (●) Automático (API)  ( ) Manual        │ │
│  │  USD manual: ┌───────────────┐                  │ │
│  │              │ 1497.50       │ $/USD             │ │
│  │              └───────────────┘                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ASISTENTE IA                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Proveedor:  [Claude (Anthropic) ▼]             │ │
│  │                                                 │ │
│  │  API Key                                        │ │
│  │  ┌─────────────────────────────────────────┐   │ │
│  │  │ sk-ant-•••••••••••••••••••••••••••••••  │   │ │
│  │  └─────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │               Guardar cambios                   │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## 4. Roles de usuarios y funcionalidades

### Roles definidos

| Rol | Descripción |
|-----|-------------|
| **USER** | Usuario registrado. Accede a todas las funcionalidades de gestión de sus propias finanzas. |
| **ADMIN** | Administrador del sistema. Fuera del alcance del TP (no se implementa en esta entrega). |

> El sistema implementa un modelo de **tenancy por usuario**: cada usuario solo puede ver, crear, modificar y eliminar sus propias transacciones. El `userId` se extrae del JWT en el API Gateway y se propaga como header interno, evitando que un usuario pueda acceder a datos de otro.

---

### Funcionalidades por rol

#### Rol USER

**Autenticación y perfil**
- Registrarse con email y contraseña
- Iniciar sesión y obtener JWT
- Actualizar nombre de usuario y presupuesto mensual
- Configurar el tipo de cambio (automático vía API o manual)
- Configurar el proveedor de IA y su API Key personal

**Gestión de cuentas**
- Crear una cuenta con nombre, tipo (banco / billetera digital / efectivo), moneda e ícono
- Ver el balance individual de cada cuenta (calculado de sus transacciones)
- Designar una cuenta como predeterminada (se usa cuando no se especifica cuenta al crear una transacción)
- Editar el nombre, tipo e ícono de una cuenta
- Eliminar una cuenta (solo si no tiene transacciones asociadas)
- Al registrarse, se crea automáticamente una cuenta "Efectivo" como predeterminada

**Gestión de transacciones**
- Crear una transacción (ingreso o egreso) con descripción, importe, categoría, moneda, fecha y cuenta
- Si no se selecciona cuenta, la transacción se asigna automáticamente a la cuenta predeterminada del usuario
- Adjuntar un comprobante digital (imagen) a una transacción
- Listar transacciones paginadas con filtro por cuenta, rango de fechas y categoría
- Ver el detalle de una transacción individual
- Editar una transacción existente (incluyendo reasignación de cuenta)
- Eliminar una transacción

**Dashboard y análisis**
- Ver balance total consolidado (suma de todas las cuentas)
- Ver balance desagregado por cuenta con barra proporcional
- Ver distribución de egresos por categoría
- Ver las últimas transacciones con indicación de la cuenta
- Consultar la cotización actual del dólar

**Asistente IA**
- Abrir una conversación con el asistente financiero
- Realizar preguntas en lenguaje natural sobre sus finanzas, incluyendo por cuenta ("¿cuánto tengo en Mercado Pago?", "¿cuánto gasté con el Galicia este mes?")
- Si la pregunta no menciona una cuenta, el asistente usa la cuenta predeterminada como referencia o responde con datos globales
- Ver respuestas contextualizadas con datos de transacciones y balances por cuenta
- Usar preguntas sugeridas rápidas

---

### Flujo de datos simplificado

```
[Browser] ──POST /api/auth/register──▶ [API Gateway] ──▶ [auth-service]
                                                               │
                                                     JWT emitido + RabbitMQ
                                                     event "user.created"
                                                               │
                                                               ▼
                                                    [transaction-service]
                                                    crea cuenta "Efectivo"
                                                    como default del usuario

[Browser] ──POST /api/accounts──▶ [API Gateway] ──▶ [transaction-service]
           (Bearer JWT)            JWT validated       CRUD de cuentas
                                   X-User-Id added     GET /accounts → balances

[Browser] ──POST /api/transactions──▶ [API Gateway] ──▶ [transaction-service]
           (Bearer JWT)                JWT validated       account_id en body
                                       X-User-Id added     (null → usa default)
                                                           consulta tipo cambio
                                                           guarda en PostgreSQL
                                                           sube comprobante MinIO

[Browser] ──POST /api/ai/chat──▶ [API Gateway] ──▶ [ai-service]
                                                    GET /api/accounts (balances)
                                                    GET /api/transactions (ctx)
                                                    detecta cuenta mencionada
                                                    o usa cuenta default
                                                    llama LLM con contexto
                                                    guarda historial MongoDB
```

---

*Fin de la Entrega Etapa 1*

# frontend-service — Pesito

Interfaz web de Pesito, el rastreador de gastos con IA para la economía argentina.
Registrá movimientos por texto, foto, audio o PDF y dejá que la IA los interprete.

> **Base:** Este frontend fue construido sobre el proyecto [Pesito](https://github.com/MarcosPiv/Pesito)
> de [Marcos Pividori](https://github.com/MarcosPiv), adaptado y extendido para correr como microservicio
> dentro del stack del TP DAN 2026. Se reemplazó el despliegue de Vercel por Docker/Kubernetes
> y se agregaron funcionalidades nuevas (soporte PDF, comprobantes en MinIO, proxy pattern,
> JWT auth contra `auth-service`, etc.).

---

## Diferencias respecto al proyecto original

| Aspecto | Implementación |
|---|---|
| Auth | JWT contra `auth-service` vía API Gateway |
| Base de datos | `transaction-service` (PostgreSQL) vía API Gateway |
| Storage de imágenes | MinIO vía `transaction-service` |
| Llamadas de IA | `ai-service` vía API Gateway (keys server-side) |
| Deploy | Docker multi-stage + Kubernetes |
| Variables de entorno | `BACKEND_URL` (server-side only) |
| Offline queue | localStorage + sync via REST al `api-gateway` |
| PDF de facturas | Soportado — se envía a `ai-service` para parseo |

---

## Funcionalidades

### Magic Bar
- **Multimodal** — texto libre, foto de ticket (galería o cámara en vivo), audio, fecha personalizada, PDF de factura
- **Multi-transacción** — "almorcé 1200 y tomé café 400" genera dos movimientos en un solo envío
- **Detección de cuotas** — "notebook en 6 cuotas de 50000" genera 6 transacciones con notas "Cuota 1/6", etc.
- **Tipo de cambio inline** — chips con cotizaciones en vivo (Blue, Oficial, Tarjeta, MEP); modo Manual con input personalizado
- **Grabación de audio** — patrón WhatsApp/Telegram; autoenvío al soltar, cancelar deslizando
- **PDF de facturas** — adjuntá un PDF; la IA extrae monto total, proveedor y categoría automáticamente

### Pesito IA (asistente de chat)
- **Registrar movimientos** desde el chat — "gasté 3500 en almuerzo"
- **Modificar y eliminar** — "al taxi de ayer cambiá el monto a 2800"; "borrá el super de ayer"
- **Marcar recurrentes** — "marcá el alquiler como recurrente"
- **Consultar y analizar** — "¿cuánto gasté esta semana?", "¿en qué categoría gasto más?"
- **Contexto financiero completo** — últimos 60 movimientos, resumen anual/mensual, proyección, cotización USD activa
- **Soporte de voz** — grabación en el chat con transcripción automática

### Gestión de transacciones
- **Swipe en mobile** — deslizá derecha para editar, izquierda para eliminar
- **Long-press** — hold 500ms para mostrar acciones
- **Búsqueda y filtros temporales** — semana, mes, año, rango personalizado con calendario y presets rápidos
- **Gastos fijos** — marcá movimientos como recurrentes; sección dedicada en Analítica
- **Comprobantes** — subí foto del ticket; se guarda en MinIO y se muestra en la tarjeta de transacción

### Cuentas y medios de pago
- **"¿Dónde está mi dinero?"** — panel de distribución de balance por cuenta/billetera
- **Catálogo de 50+ medios de pago argentinos** — Mercado Pago, Ualá, BBVA, Galicia, Santander, Brubank, Efectivo y más
- **Drill-down por cuenta** — tocá una cuenta para ver movimientos del período con balance detallado
- **Detección automática** — la IA detecta el medio de pago desde el texto

### Importar CSV
- Importación masiva de transacciones desde archivos CSV
- Mapeo de columnas interactivo con previsualización antes de confirmar

### Multi-moneda ARS / USD
- Cotización en vivo vía DolarAPI (Blue, Oficial, Tarjeta, MEP) — a través del API Gateway
- `txRate` se bloquea al momento de cargar cada movimiento — el historial no cambia si el dólar se mueve
- Actualización automática cada 5 minutos

### Analítica y exportación
- **Gráfico de tendencia** — LineChart anual con ingresos vs gastos por mes
- **Donut de categorías** — PieChart con breakdown por categoría
- **Heatmap de gastos** — mapa de calor por día del mes
- **Exportar CSV y PDF** — BOM-prefixed UTF-8, compatible con Excel
- **Resumen compartible** — imagen/tarjeta de resumen exportable

### PWA
- Instalable en Android e iOS
- Service worker con cache de app shell + assets estáticos
- Soporte para notch / Dynamic Island

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Animaciones | Framer Motion |
| Gráficos | Recharts |
| Temas | next-themes |
| Notificaciones | Sonner |
| Deploy | Docker multi-stage + Kubernetes |

---

## Arquitectura — Proxy Pattern

Todas las llamadas del browser van a rutas relativas `/api/*`, que son interceptadas por el Route Handler `app/api/[...proxy]/route.ts` y reenviadas server-side al API Gateway.

```
Browser → /api/auth/login
  → Next.js proxy (server-side)
  → http://api-gateway:8080/api/auth/login

Browser → /api/ai/parse
  → Next.js proxy
  → http://api-gateway:8080/api/ai/parse
  → ai-service (Claude / OpenAI / Gemini)

Browser → /api/transactions
  → Next.js proxy
  → http://api-gateway:8080/api/transactions
  → transaction-service (PostgreSQL)
```

**Beneficios:** Las API keys y URLs de backend nunca llegan al browser. CORS no es un problema. La CSP del browser solo necesita `connect-src 'self'`.

---

## Estructura del proyecto

```
app/
  api/
    [...proxy]/route.ts     # Proxy universal — reenvía todas las requests al API Gateway
    health/route.ts         # GET /api/health → { status: "UP", service: "frontend-service" }
  reset-password/page.tsx   # Ruta standalone para recuperación de contraseña
  globals.css               # Variables CSS y estilos globales (oklch, dark mode)
  layout.tsx                # ThemeProvider, PWA meta, Toaster
  page.tsx                  # SPA router — renderiza la vista activa según currentView

components/
  dashboard-page.tsx        # Orquestador del dashboard (estado + handlers principales)
  landing-page.tsx          # Landing + instalación PWA
  auth-page.tsx             # Login, registro, recuperación de contraseña
  settings-page.tsx         # Tema, IA, tipo de cambio, cuenta predeterminada
  analytics-page.tsx        # Gráficos de tendencia y categoría; gastos fijos; exportar
  profile-page.tsx          # Cambio de nombre y contraseña
  accounts-page.tsx         # Vista detallada de cuentas y balances
  onboarding-wizard.tsx     # Wizard de configuración inicial
  biometric-lock.tsx        # Bloqueo biométrico / PIN
  pwa-register.tsx          # Registro del service worker

  dashboard/
    shared.tsx              # Constantes (iconMap, VALID_CATEGORIES, PAYMENT_ACCOUNTS),
                            # tipos (Transaction, ChatMessage, Attachment, PaymentAccount)
                            # y utilidades (fileToBase64)
    magic-bar.tsx           # Barra multimodal (texto, foto, audio, PDF)
    chat-panel.tsx          # Sidebar del asistente Pesito IA
    filter-bar.tsx          # Chips de filtro temporal + calendario inline
    summary-cards.tsx       # Tarjetas de resumen (presupuesto / ingresos+gastos)
    category-chart.tsx      # Breakdown de gastos por categoría
    transaction-list.tsx    # Lista swipeable con búsqueda y paginación
    swipe-card.tsx          # Wrapper de gesto swipe (editar / eliminar)
    edit-dialog.tsx         # Formulario de edición de transacción
    delete-dialog.tsx       # Confirmación de eliminación
    camera-modal.tsx        # Cámara en vivo para capturar tickets
    accounts-modal.tsx      # "¿Dónde está mi dinero?" — balance por cuenta + drill-down
    import-csv-modal.tsx    # Importación masiva desde CSV
    onboarding-overlay.tsx  # Overlay de bienvenida para usuario nuevo
    receipt-image.tsx       # Imagen de comprobante servida desde MinIO
    exchange-type-badge.tsx # Badge de tipo de cambio (Blue / Oficial / Tarjeta / MEP)
    skeleton.tsx            # Skeletons de carga

  analytics/
    expense-heatmap.tsx     # Heatmap de gastos por día del mes
    share-summary.tsx       # Tarjeta de resumen exportable/compartible

  ui/                       # Componentes shadcn/ui (Radix UI + Tailwind)

hooks/
  use-exchange-rate.ts      # Cotizaciones en vivo desde DolarAPI (vía proxy)
  use-notifications.ts      # Permisos y envío de notificaciones push
  use-chat-handler.ts       # Lógica del chat: intents de delete/update/recurring/register

lib/
  app-context.tsx           # Estado global (React Context + offline queue + JWT)
  ai.ts                     # callAI / callAIChat / callAIUpdateDetect /
                            # callAIDeleteDetect / callAIRecurringDetect
                            # → todos van al proxy → ai-service
  api-client.ts             # Helpers REST autenticados (Authorization: Bearer <jwt>)
  utils.ts                  # Utilidades generales (cn, formatters)

public/
  sw.js                     # Service worker (cache + push notifications)
  manifest.json             # Web App Manifest (nombre, íconos, colores)

styles/                     # Estilos adicionales
```

---

## Modelo de datos principal

```typescript
interface Transaction {
  id: string
  description: string
  amount: number              // valor nominal (ARS o USD)
  type: "income" | "expense"
  icon: string                // nombre de ícono lucide-react
  category: string
  date: Date
  observation?: string
  currency: "ARS" | "USD"
  amountUsd?: number
  txRate?: number             // tasa ARS bloqueada al momento de carga — inmutable
  exchangeRateType?: "BLUE" | "TARJETA" | "OFICIAL" | "MEP" | "MANUAL" | null
  isRecurring?: boolean
  account?: string            // banco / billetera / medio de pago
  receiptUrl?: string         // URL presignada de comprobante en MinIO
}
```

---

## Variables de entorno

| Variable | Dónde | Propósito |
|---|---|---|
| `BACKEND_URL` | Server-side (Docker env / `.env.local`) | URL base del API Gateway |

No se usan variables `NEXT_PUBLIC_*`. La URL del backend nunca se expone al browser.

---

## Setup local

```bash
# Desde la raíz del monorepo
cd microservices/frontend-service
npm install
```

Crear `.env.local`:

```env
BACKEND_URL=http://localhost:8080
```

```bash
npm run dev   # http://localhost:3001
```

> **Requiere** que el API Gateway (`api-gateway`) esté corriendo en `localhost:8080`
> con `auth-service`, `transaction-service` y `ai-service` disponibles.
> Ver el `docker-compose.yml` raíz para levantar el stack completo.

---

## Docker

```bash
# Build desde la raíz del monorepo
docker build -t pesito/frontend-service ./microservices/frontend-service

# Run standalone
docker run -p 3001:3001 \
  -e BACKEND_URL=http://api-gateway:8080 \
  pesito/frontend-service
```

El `Dockerfile` usa un build multi-stage (`node:20-alpine`) con `output: "standalone"` de Next.js.

---

## Health check

```
GET /api/health
→ { "status": "UP", "service": "frontend-service" }
```

Usado por el healthcheck de Docker y las liveness probes de Kubernetes.

---

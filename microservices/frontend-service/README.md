# BudgetBuddy

Rastreador de gastos con IA para la economía argentina. Registrá movimientos por texto, foto o audio y dejá que la IA los interprete.

**Demo:** [finanzas-budget-buddy.vercel.app](https://finanzas-budget-buddy.vercel.app)

---

## Funcionalidades

### BudgetBuddy AI (asistente de chat)
- **Registrar movimientos** — "gasté 3500 en almuerzo" o "cobré 200 USD"; la IA extrae monto, categoría, ícono y moneda automáticamente
- **Detección de cuenta** — "pagué con MercadoPago" o "con Galicia" asocia el movimiento al medio de pago correcto; nunca lo usa como categoría
- **Modificar desde el chat** — "al taxi de ayer, cambiá el monto a 2800" o "al gym, agregale la nota 'pago mensual'"
- **Eliminar desde el chat** — "borrá el super de ayer"; la IA identifica la transacción y la elimina
- **Marcar como recurrente** — "marcá el alquiler como recurrente" o "el gym ya no es fijo"
- **Consultar y analizar** — "¿cuánto gasté esta semana?", "¿me alcanza el presupuesto?", "¿en qué categoría gasto más?"
- **Contexto financiero completo** — el asistente accede a los últimos 60 movimientos, resumen anual/mensual, proyección a fin de mes, cotización USD activa y montos en USD cuando corresponde
- **Soporte de voz** — grabación de audio en el chat con transcripción automática y UX estilo WhatsApp (timer, deslizar para cancelar)
- **Corrección de tipo de cambio** — "pero fue en dólar blue" actualiza el tipo de cambio del último movimiento registrado

### Magic Bar
- **Multimodal** — texto libre, foto de ticket (galería o cámara en vivo), nota adjunta, fecha personalizada
- **Multi-transacción** — "almorcé 1200 y tomé café 400" genera dos movimientos en un solo envío
- **Detección de cuotas** — "notebook en 6 cuotas de 50000" genera 6 transacciones con notas "Cuota 1/6", "Cuota 2/6", etc.
- **Tipo de cambio inline** — chips con cotizaciones en vivo (Blue, Oficial, Tarjeta, MEP); "Manual" expande un input para tasa personalizada
- **Grabación de audio** — mismo patrón WhatsApp/Telegram; autoenvío al soltar, cancelar deslizando

### Gestión de transacciones
- **Swipe en mobile** — deslizá derecha para editar, izquierda para eliminar
- **Long-press** — hold 500ms para mostrar acciones de editar/eliminar
- **Búsqueda** — filtrá por descripción, categoría u observación
- **Filtros temporales** — semana, mes, año, rango personalizado con calendario y presets rápidos (Hoy, Ayer, 7 días, 30 días, Este mes, Mes anterior)
- **Gastos fijos** — marcá movimientos como recurrentes; sección dedicada en Analítica

### Cuentas y medios de pago
- **"¿Dónde está mi dinero?"** — panel de distribución de balance por cuenta/billetera; respeta el filtro temporal activo (semana, mes, año o rango personalizado)
- **Catálogo de 50+ medios de pago argentinos** — Mercado Pago, Ualá, BBVA, Galicia, Santander, Brubank, Efectivo y más; organizados en Billetera Virtual, Banco Digital, Banco Privado, Banco Público, Cripto/Inversión y Efectivo
- **Drill-down por cuenta** — tocá una cuenta para ver el listado de movimientos de ese período con balance, ingresos y gastos detallados
- **Detección automática** — la IA detecta el medio de pago desde el texto y lo asigna al campo `account` sin confundirlo con la categoría del gasto
- **Cuenta predeterminada** — configurable en Ajustes; se usa cuando no se detecta ningún medio de pago explícito

### Importar CSV
- Importación masiva de transacciones desde archivos CSV
- Mapeo de columnas interactivo con previsualización antes de confirmar

### Multi-moneda ARS / USD
- Cotización en vivo vía [DolarAPI](https://dolarapi.com): Blue, Oficial, Tarjeta, MEP
- `txRate` se bloquea al momento de cargar cada movimiento — el historial no cambia si el dólar se mueve
- Modo manual: podés ingresar una tasa personalizada por movimiento
- Actualización automática cada 5 minutos; toggle para modo manual global en Ajustes

### Analítica y exportación
- **Gráfico de tendencia** — LineChart anual con ingresos vs gastos por mes
- **Donut de categorías** — PieChart con breakdown por categoría
- **Exportar CSV** — BOM-prefixed UTF-8, compatible con Excel; columnas: Fecha, Tipo, Descripción, Categoría, Monto, Moneda, Nota
- **Exportar PDF** — genera un documento HTML completo con tarjetas de resumen, tabla por categoría y lista de movimientos; sin dependencias externas
- **Selector de rango** — presets (mes actual, mes anterior, año) + rango personalizado con calendario

### Rendimiento — carga en dos fases
- **Phase 1 (login):** solo se cargan los últimos 6 meses de transacciones — el dashboard aparece de inmediato sin importar cuántos años de datos haya
- **Phase 2 (background):** el historial completo se carga automáticamente al abrir Analítica o al usar el filtro "Año" / rango personalizado en el Dashboard
- Índice `(user_id, date DESC)` en Supabase garantiza queries O(log n) en ambas fases

### Offline y sincronización
- Operaciones en cola local (`localStorage`) cuando no hay conexión
- Update optimista inmediato — el dashboard no espera a Supabase
- Al recuperar señal, la cola se procesa en orden y resuelve IDs temporales
- Indicador de estado en el header: badge ámbar "N en cola" o spinner "Sincronizando..."

### PWA y notificaciones
- Instalable en Android (prompt nativo) e iOS (instrucción Safari)
- Service worker con cache de app shell + assets estáticos
- Notificaciones push: recordatorio diario, alerta al 90% del presupuesto, aviso de fijos el 1° de cada mes, resumen semanal los lunes
- Soporte completo para notch / Dynamic Island: `env(safe-area-inset-top/bottom)` en todos los headers y Toaster

### Autenticación
- **Email/contraseña** — registro y login tradicional
- **OAuth** — login con Google y GitHub; el nombre y foto de perfil se toman automáticamente del proveedor
- **Recuperación de contraseña** — flujo por email con redirect a `/reset-password`

### UX / UI
- **Modo oscuro / claro** — paleta "Sage Morning" en modo claro; transición suave de 0.45s
- **Gestos nativos Android** — botón/gesto back navega entre vistas; doble-back en la raíz muestra toast "Deslizá de nuevo para salir" y cierra la PWA
- **Avatar de perfil** — foto de Google/GitHub visible en el header del dashboard y en la página de perfil
- **Picker de categoría rápido** — tap en el ícono de una transacción despliega chips de categoría sin abrir el diálogo completo; hover muestra lápiz como hint
- **Empty state contextual** — usuario nuevo ve "¡Empezá a registrar!"; período sin movimientos muestra el filtro activo ("Sin movimientos esta semana")
- **Tres proveedores de IA** — Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google); switcheable en Ajustes
- **Validación de API keys** — formato validado antes de cada llamada con mensajes de error amigables
- **Timeout de IA** — 30 segundos máximo por request; libera la barra con mensaje claro si la API no responde

---

## Modo sin conexión — caso de uso

> **Escenario:** estás en una feria con mala señal y querés registrar varios gastos.

1. El celular pierde conexión (o está en modo avión).
2. Registrás normalmente: "Compré verduras $4.500", "Café $1.200", "Transporte $800".
3. Las tres transacciones aparecen en el dashboard de inmediato — sin spinner, sin error.
4. El header muestra **"3 en cola"** en badge ámbar.
5. Al salir y recuperar señal, BudgetBuddy sincroniza en orden con Supabase.
6. El badge desaparece y los movimientos quedan persistidos con sus IDs reales.

Lo mismo aplica para editar o eliminar sin conexión.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Animaciones | Framer Motion |
| Gráficos | Recharts |
| Temas | next-themes |
| IA | Anthropic / OpenAI / Google APIs |
| Deploy | Vercel |

---

## Estructura del proyecto

```
app/
  page.tsx                  # SPA router — renderiza la vista activa
  layout.tsx                # ThemeProvider, PWA meta, Toaster
  reset-password/page.tsx   # Ruta standalone para recuperación de contraseña
components/
  dashboard-page.tsx        # Orquestador del dashboard (estado + handlers)
  dashboard/
    shared.tsx              # Constantes (iconMap, VALID_CATEGORIES, PAYMENT_ACCOUNTS),
                            # tipos (ChatMessage, Attachment, PaymentAccount) y utilidades
    filter-bar.tsx          # Chips de filtro temporal + calendario inline
    summary-cards.tsx       # Tarjetas de resumen (presupuesto / ingresos+gastos)
    category-chart.tsx      # Breakdown de gastos por categoría
    transaction-list.tsx    # Lista swipeable con búsqueda y paginación
    swipe-card.tsx          # Wrapper de gesto de swipe (editar / eliminar)
    magic-bar.tsx           # Barra multimodal de entrada (texto, foto, audio)
    chat-panel.tsx          # Sidebar del asistente IA con historial de mensajes
    edit-dialog.tsx         # Formulario de edición de transacción
    delete-dialog.tsx       # Confirmación de eliminación
    camera-modal.tsx        # Cámara en vivo para capturar tickets
    accounts-modal.tsx      # "¿Dónde está mi dinero?" — balance por cuenta + drill-down
    import-csv-modal.tsx    # Importación masiva desde CSV
    onboarding-overlay.tsx  # Overlay de bienvenida
    receipt-image.tsx       # Imagen de comprobante desde Supabase Storage
    exchange-type-badge.tsx # Badge de tipo de cambio (Blue / Oficial / Tarjeta / MEP)
    skeleton.tsx            # Skeletons de carga
  settings-page.tsx         # Tema, notificaciones, IA, tipo de cambio, modo perfil
  analytics-page.tsx        # Gráficos de tendencia y categoría; gastos fijos; exportar
  auth-page.tsx             # Login, registro, recuperación de contraseña
  landing-page.tsx          # Landing + instalación PWA
  profile-page.tsx          # Cambio de nombre y contraseña
hooks/
  use-exchange-rate.ts      # Cotizaciones en vivo desde DolarAPI
  use-notifications.ts      # Permisos y envío de notificaciones push
  use-chat-handler.ts       # Lógica del chat: intents de delete/update/recurring/register
lib/
  app-context.tsx           # Estado global (React Context + Supabase + offline queue)
  ai.ts                     # callAI / callAIChat / callAIUpdateDetect /
                            # callAIDeleteDetect / callAIRecurringDetect — Claude, OpenAI, Gemini
  supabase.ts               # Cliente Supabase
public/
  sw.js                     # Service worker (cache + push notifications)
  manifest.json             # Web App Manifest
```

---

## Setup local

```bash
git clone https://github.com/MarcosPiv/BudgetBuddy.git
cd BudgetBuddy
npm install
```

Crear `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

```bash
npm run dev   # http://localhost:3000
```

---

## Desarrollado por

[Marcos Pividori](https://github.com/MarcosPiv)

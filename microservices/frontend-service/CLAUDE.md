# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js development server (port 3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

**BudgetBuddy** is an AI-powered expense tracker built with Next.js App Router, targeting the Argentine market (ARS/USD multi-currency). It runs as a microservice inside the TP DAN 2026 stack — no Supabase, no direct backend calls from the browser.

### Proxy Pattern

All `/api/*` requests from the browser are intercepted by `app/api/[...proxy]/route.ts` (a Next.js Route Handler) and forwarded server-side to `${BACKEND_URL}${path}`. In Docker it forwards to `http://api-gateway:8080`; in local dev it forwards to `http://localhost:8080` via `.env.local`.

```
Browser → /api/auth/login
  → Next.js proxy (server-side)
  → http://api-gateway:8080/api/auth/login
```

**Benefits:** API keys and backend URLs never reach the browser. CORS is a non-issue. The browser CSP only needs `connect-src 'self'`.

### Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `BACKEND_URL` | Server-side (Docker env / `.env.local`) | Base URL of the API Gateway |

No `NEXT_PUBLIC_*` variables are needed. The build has no baked-in backend URL.

For local dev, create `.env.local`:
```
BACKEND_URL=http://localhost:8080
```

### Auth

JWT-based authentication against `auth-service` (via API Gateway). Tokens are stored in `localStorage` under key `bb_jwt` and sent as `Authorization: Bearer <token>` by `lib/api-client.ts`. No Supabase involved.

### Navigation & State

`app/page.tsx` wraps the entire app in `AppProvider` and renders one of five views based on `currentView` state:

- `landing` → `components/landing-page.tsx`
- `auth` → `components/auth-page.tsx` (login / register / forgot password)
- `dashboard` → `components/dashboard-page.tsx` (main feature)
- `settings` → `components/settings-page.tsx`
- `profile` → `components/profile-page.tsx`
- `analytics` → `components/analytics-page.tsx` (trend chart, donut chart, recurring transactions)

All global state lives in `lib/app-context.tsx` (React Context).

### Core Data Model

```typescript
Transaction {
  id: string
  description: string
  amount: number              // face value (USD or ARS)
  type: "income" | "expense"
  icon: string                // lucide-react icon name
  category: string
  date: Date
  observation?: string
  currency: "ARS" | "USD"
  amountUsd?: number
  txRate?: number             // ARS rate locked at transaction time — immutable
  exchangeRateType?: "BLUE" | "TARJETA" | "OFICIAL" | "MEP" | "MANUAL" | null
  isRecurring?: boolean
  account?: string            // payment method / bank / wallet name
}
```

### Exchange Rate System

`hooks/use-exchange-rate.ts` fetches `/api/rates` (relative URL, captured by the proxy). The proxy forwards to `http://api-gateway:8080/api/rates` which proxies to the external DolarAPI. Auto-refresh every 5 minutes.

### AI Provider System

AI calls (`lib/ai.ts`) go through the proxy to `ai-service` via the API Gateway. The AI provider is configured server-side in `ai-service` via `AI_PROVIDER`, `CLAUDE_API_KEY`, etc. — no API keys are stored in the frontend.

### Health Check

`GET /api/health` → `{ status: "UP", service: "frontend-service" }`

Used by Docker healthcheck and Kubernetes liveness probes.

### UI Stack

- **shadcn/ui** ("new-york" style) — components in `components/ui/`
- **Tailwind CSS v4** with CSS custom properties for theming (oklch color format)
- **Radix UI** primitives underneath shadcn
- **Framer Motion** for all animations
- **Recharts** for charts
- **Lucide React** for icons
- **next-themes** for dark/light mode
- **Sonner** for toast notifications

### Key Config Notes

- `next.config.mjs` has `typescript: { ignoreBuildErrors: true }` — TypeScript errors do not fail the build
- `next.config.mjs` has `output: "standalone"` — required for the Docker multi-stage build
- Path alias `@/*` maps to the project root (configured in `tsconfig.json`)
- The UI is in **Spanish** (Argentine Spanish, ARS currency context)

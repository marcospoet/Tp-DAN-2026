"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  RefreshCw,
  Wifi,
  WifiOff,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronDown,
} from "lucide-react"
import { useExchangeRate, type DolarRate } from "@/hooks/use-exchange-rate"
import { useApp } from "@/lib/app-context"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function timeAgo(date: Date | null): string {
  if (!date) return ""
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "ahora mismo"
  if (diffMin === 1) return "hace 1 min"
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  return `hace ${diffH} h`
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated price — flashes briefly on value change
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedPrice({
  value,
  className,
}: {
  value: number | null | undefined
  className?: string
}) {
  const prevRef = useRef<number | null | undefined>(undefined)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)

  useEffect(() => {
    if (prevRef.current === undefined) {
      prevRef.current = value
      return
    }
    if (value != null && prevRef.current != null && value !== prevRef.current) {
      setFlash(value > prevRef.current ? "up" : "down")
      const t = setTimeout(() => setFlash(null), 900)
      prevRef.current = value
      return () => clearTimeout(t)
    }
    prevRef.current = value
  }, [value])

  return (
    <motion.span
      key={value}
      className={cn(
        "font-bold tabular-nums transition-colors duration-700",
        flash === "up" && "text-emerald-400",
        flash === "down" && "text-red-400",
        !flash && className
      )}
      initial={{ opacity: 0.6, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {fmt(value)}
    </motion.span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single rate card
// ─────────────────────────────────────────────────────────────────────────────

interface RateCardProps {
  label: string
  emoji: string
  rate: DolarRate | null
  highlight?: boolean
  onClick?: () => void
  selected?: boolean
}

function RateCard({ label, emoji, rate, highlight, onClick, selected }: RateCardProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-1 rounded-2xl border p-3 text-left transition-all cursor-pointer overflow-hidden",
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/60",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
    >
      {/* Subtle glow on hover for highlight card */}
      {highlight && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent rounded-2xl" />
      )}

      <div className="flex items-center justify-between gap-1">
        <span className="text-base leading-none">{emoji}</span>
        {selected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-[9px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full"
          >
            ACTIVO
          </motion.span>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5">
        {label}
      </p>

      {rate ? (
        <>
          <AnimatedPrice
            value={rate.venta}
            className={highlight ? "text-primary text-sm" : "text-foreground text-sm"}
          />
          <p className="text-[10px] text-muted-foreground leading-none">
            C: {fmt(rate.compra)}
          </p>
        </>
      ) : (
        <span className="text-sm font-bold text-muted-foreground">—</span>
      )}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main widget
// ─────────────────────────────────────────────────────────────────────────────

interface ExchangeWidgetProps {
  /** Compact mode hides the grid — only shows active rate inline */
  compact?: boolean
}

export function ExchangeWidget({ compact = false }: ExchangeWidgetProps) {
  const { usdRate, setUsdRate, exchangeRateMode } = useApp()
  const isApiMode = exchangeRateMode === "api"

  const { rates, loading, error, lastUpdated, refresh } = useExchangeRate({
    enabled: isApiMode,
  })

  // Which API rate the user selected to use as the active usdRate
  const [selectedApiKey, setSelectedApiKey] = useState<
    "blue" | "oficial" | "tarjeta" | "mep"
  >("blue")

  const [expanded, setExpanded] = useState(false)

  // When API mode + rates arrive, automatically update the global usdRate
  useEffect(() => {
    if (!isApiMode) return
    const active = rates[selectedApiKey]
    if (active?.venta) {
      setUsdRate(active.venta)
    }
  }, [isApiMode, rates, selectedApiKey, setUsdRate])

  const cards: Array<{
    key: "blue" | "oficial" | "tarjeta" | "mep"
    label: string
    emoji: string
    highlight?: boolean
  }> = [
    { key: "blue", label: "Blue", emoji: "💵", highlight: true },
    { key: "oficial", label: "Oficial", emoji: "🏦" },
    { key: "tarjeta", label: "Tarjeta", emoji: "💳" },
    { key: "mep", label: "MEP / Bolsa", emoji: "📈" },
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isApiMode ? (
          <>
            <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>
              1 USD ={" "}
              <span className="font-semibold text-foreground tabular-nums">
                {fmt(usdRate)} ARS
              </span>
            </span>
            {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 text-muted-foreground shrink-0" />
            <span>
              1 USD ={" "}
              <span className="font-semibold text-foreground tabular-nums">
                {fmt(usdRate)} ARS
              </span>
              <span className="ml-1 opacity-60">(manual)</span>
            </span>
          </>
        )}
      </div>
    )
  }

  return (
    <motion.div
      className="rounded-2xl border border-border bg-card overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header bar — div instead of button to allow nested refresh button */}
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded((p) => !p)
          }
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Cotización del Dólar
            </span>
            <div className="flex items-center gap-1.5">
              {isApiMode ? (
                <Wifi className="w-2.5 h-2.5 text-emerald-500" />
              ) : (
                <WifiOff className="w-2.5 h-2.5 text-muted-foreground" />
              )}
              <span className="text-[10px] text-muted-foreground">
                {isApiMode ? "Dolar API" : "Manual"} · 1 USD ={" "}
                <span className="font-medium text-foreground tabular-nums">
                  {fmt(usdRate)}
                </span>{" "}
                ARS
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isApiMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                refresh()
              }}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer",
                loading && "pointer-events-none"
              )}
              aria-label="Actualizar cotizaciones"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>
          )}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">
              {/* Error banner */}
              <AnimatePresence>
                {error && isApiMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-destructive font-medium">
                        Sin conexión a DolarAPI
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {error}. Se usa el valor manual guardado.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={refresh}
                      className="text-xs text-destructive hover:underline cursor-pointer shrink-0"
                    >
                      Reintentar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Rate grid */}
              {isApiMode && (
                <div className="grid grid-cols-2 gap-2">
                  {cards.map((c) => (
                    <RateCard
                      key={c.key}
                      label={c.label}
                      emoji={c.emoji}
                      rate={rates[c.key]}
                      highlight={c.highlight}
                      selected={selectedApiKey === c.key}
                      onClick={() => {
                        setSelectedApiKey(c.key)
                        const r = rates[c.key]
                        if (r?.venta) setUsdRate(r.venta)
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Footer: last updated */}
              {isApiMode && lastUpdated && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span>
                    Actualizado {timeAgo(lastUpdated)} · Toca una tarjeta para
                    usar esa cotización
                  </span>
                </div>
              )}

              {/* Manual mode note */}
              {!isApiMode && (
                <p className="text-[11px] text-muted-foreground">
                  Modo manual activo. Cambiá el tipo de cambio en{" "}
                  <span className="font-medium text-foreground">
                    Configuración
                  </span>
                  .
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

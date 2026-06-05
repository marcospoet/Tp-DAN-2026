"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarDays, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"
import type { Transaction } from "@/lib/app-context"
import { iconMap } from "@/components/dashboard/shared"

// ── Constants ─────────────────────────────────────────────────────────────────
const FULL_MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtArs(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`
  if (n >= 1_000_000_000)     return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)         return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)             return `${(n / 1_000).toFixed(0)}K`
  return Math.round(n).toLocaleString("es-AR")
}

function toArs(tx: Transaction, usdRate: number): number {
  return tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount
}

function getDayColor(total: number, max: number): string {
  if (total === 0 || max === 0) return "transparent"
  const ratio = total / max
  if (ratio < 0.33) return "rgba(34, 197, 94, 0.28)"   // emerald — bajo
  if (ratio < 0.67) return "rgba(245, 158, 11, 0.42)"   // amber — moderado
  return "rgba(239, 68, 68, 0.52)"                       // red — alto
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ExpenseHeatmapProps {
  transactions: Transaction[]
  usdRate: number
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ExpenseHeatmap({ transactions, usdRate }: ExpenseHeatmapProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  // ── Navigation ──────────────────────────────────────────────────────────────
  function goPrev() {
    setSelectedDay(null)
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function goNext() {
    if (isCurrentMonth) return
    setSelectedDay(null)
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  // ── Day data ─────────────────────────────────────────────────────────────────
  const dayData = useMemo(() => {
    const map = new Map<number, { total: number; txs: Transaction[] }>()
    for (const tx of transactions) {
      const d = new Date(tx.date)
      if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) continue
      const day = d.getDate()
      const entry = map.get(day) ?? { total: 0, txs: [] }
      if (tx.type === "expense") {
        entry.total += toArs(tx, usdRate)
      }
      entry.txs.push(tx)
      map.set(day, entry)
    }
    return map
  }, [transactions, viewYear, viewMonth, usdRate])

  const maxTotal = useMemo(() => {
    let max = 0
    for (const d of dayData.values()) {
      if (d.total > max) max = d.total
    }
    return max
  }, [dayData])

  const selectedDayTxs = useMemo(() => {
    if (selectedDay === null) return []
    const entry = dayData.get(selectedDay)
    if (!entry) return []
    return [...entry.txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [selectedDay, dayData])

  // ── Calendar geometry (Monday-first) ─────────────────────────────────────────
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const jsDay = firstDayOfMonth.getDay() // 0=Sun
  const startOffset = jsDay === 0 ? 6 : jsDay - 1 // Mon=0 ... Sun=6

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-accent shrink-0" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Mapa de gastos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[110px] text-center">
            {FULL_MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={isCurrentMonth}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Calendar grid ──────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map(h => (
            <div
              key={h}
              className="text-center text-[10px] font-medium text-muted-foreground py-1"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty offset cells */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day buttons */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const data = dayData.get(day)
            const isToday =
              isCurrentMonth && day === today.getDate()
            const isFuture =
              isCurrentMonth && day > today.getDate()
            const isSelected = selectedDay === day

            return (
              <button
                key={day}
                type="button"
                disabled={isFuture}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={[
                  "min-h-[40px] w-full rounded-lg p-1 flex flex-col items-start justify-between transition-colors",
                  "border",
                  isSelected
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border/30 hover:border-border",
                  isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
                style={{ background: getDayColor(data?.total ?? 0, maxTotal) }}
              >
                {/* Day number */}
                <span
                  className={[
                    "text-[10px] font-medium leading-none w-[18px] h-[18px] flex items-center justify-center rounded-full",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  ].join(" ")}
                >
                  {day}
                </span>

                {/* Expense amount */}
                {data && data.total > 0 && (
                  <span className="text-[8px] text-muted-foreground leading-none self-end w-full truncate text-center block">
                    ${fmtArs(data.total)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2">
        {[
          { color: "rgba(34, 197, 94, 0.28)", label: "Bajo" },
          { color: "rgba(245, 158, 11, 0.42)", label: "Moderado" },
          { color: "rgba(239, 68, 68, 0.52)", label: "Alto" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm border border-border/40 shrink-0"
              style={{ background: color }}
            />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Expanded day panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDay !== null && (
          <motion.div
            key={`day-${selectedDay}-${viewMonth}-${viewYear}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pt-3 pb-4">
              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">
                  {selectedDay} de {FULL_MONTH_NAMES[viewMonth]}
                </p>
                {dayData.get(selectedDay) && dayData.get(selectedDay)!.total > 0 && (
                  <p className="text-xs font-semibold text-destructive">
                    −${fmtArs(dayData.get(selectedDay)!.total)} ARS
                  </p>
                )}
              </div>

              {/* Transaction list */}
              {selectedDayTxs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin movimientos este día.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedDayTxs.map(tx => {
                    const IconComp = iconMap[tx.icon] ?? ShoppingCart
                    const arsAmount = toArs(tx, usdRate)
                    const isIncome = tx.type === "income"

                    return (
                      <div key={tx.id} className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <IconComp className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>

                        {/* Description + category */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {tx.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {tx.category}
                          </p>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className={[
                            "text-xs font-semibold",
                            isIncome ? "text-primary" : "text-foreground",
                          ].join(" ")}>
                            {isIncome ? "+" : "−"}${fmtArs(arsAmount)}
                          </p>
                          {tx.currency === "USD" && (
                            <p className="text-[9px] text-muted-foreground">
                              USD {tx.amount.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

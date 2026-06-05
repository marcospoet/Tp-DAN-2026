"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  BarChart2,
  Loader2,
  RefreshCw,
  Repeat,
  ShoppingCart,
  Car,
  Coffee,
  Code,
  Dumbbell,
  ArrowDownLeft,
  Check,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Minus,
  Clock,
  CalendarClock,
  Trash2,
} from "lucide-react"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"
import { useApp } from "@/lib/app-context"
import type { Transaction, TimeFilter } from "@/lib/app-context"
import { CalendarWithNav } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"
import { es } from "date-fns/locale"
import { ExpenseHeatmap } from "@/components/analytics/expense-heatmap"
import { ShareSummary } from "@/components/analytics/share-summary"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ── Icon map ─────────────────────────────────────────────────────────────────
const iconMap: Record<string, React.ElementType> = {
  ShoppingCart,
  Car,
  Coffee,
  Code,
  Dumbbell,
  ArrowDownLeft,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtArs(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(1)}T`
  if (abs >= 1_000_000_000)     return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000)         return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)             return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${Math.round(abs).toLocaleString("es-AR")}`
}

function fmtPct(n: number): string {
  const abs = Math.abs(n)
  const sign = n >= 0 ? "+" : ""
  if (abs >= 1_000_000_000) return `${sign}${(n / 1_000_000_000).toFixed(1)}B%`
  if (abs >= 1_000_000)     return `${sign}${(n / 1_000_000).toFixed(1)}M%`
  if (abs >= 1_000)         return `${sign}${(n / 1_000).toFixed(0)}K%`
  return `${sign}${Math.round(n)}%`
}

const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name === "ingresos" ? "Ingresos" : "Gastos"}:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtArs(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Daily projection tooltip ───────────────────────────────────────────────
function DailyProjectionTooltip({ active, payload }: { active?: boolean; payload?: { dataKey: string; value: number; color: string; payload: { dateLabel: string } }[] }) {
  if (!active || !payload?.length) return null
  const real = payload.find(p => p.dataKey === "real")
  const projected = payload.find(p => p.dataKey === "projected")
  const dateLabel = payload[0]?.payload?.dateLabel ?? ""
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1.5 capitalize">{dateLabel}</p>
      {real?.value != null && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: real.color }} />
          <span className="text-muted-foreground">Acumulado:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtArs(real.value)}</span>
        </div>
      )}
      {projected?.value != null && real?.value == null && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0 opacity-55" style={{ background: projected.color }} />
          <span className="text-muted-foreground">Proyectado:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtArs(projected.value)}</span>
        </div>
      )}
    </div>
  )
}

// ── Simple bar/area tooltip ────────────────────────────────────────────────────
function SimpleValueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload?: { dateLabel?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const displayLabel = label || payload[0]?.payload?.dateLabel || ""
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-0.5">{displayLabel}</p>
      <p className="text-muted-foreground">{fmtArs(payload[0].value)}</p>
    </div>
  )
}

const PIE_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#a855f7", "#10b981", "#f97316"]

// ── Pie tooltip ────────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { name: string } }[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{item.payload.name}</p>
      <p className="text-muted-foreground mt-0.5">{fmtArs(item.value)}</p>
    </div>
  )
}

type ExportMode = "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "custom"

// ── Component ─────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { setView, transactions, addTransaction, updateTransaction, deleteTransaction, usdRate, isLoadingHistory, hasMoreTransactions, loadMoreTransactions, timeFilter, setTimeFilter, customRange } = useApp()
  const [applyingMonth, setApplyingMonth] = useState(false)
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [recurringFreqFilter, setRecurringFreqFilter] = useState<"all" | "weekly" | "biweekly" | "monthly" | "annual">("all")
  const [expandedFutureGroups, setExpandedFutureGroups] = useState<Set<string>>(new Set())
  const [deletingFutureTx, setDeletingFutureTx] = useState<Transaction | null>(null)

  // ── Export state ────────────────────────────────────────────────────────────
  const now = new Date()
  const [exportMode, setExportMode] = useState<ExportMode>("thisMonth")
  const [showExportCalendar, setShowExportCalendar] = useState(false)
  const [exportCalRange, setExportCalRange] = useState<DateRange | undefined>()
  const [exportApplied, setExportApplied] = useState<{ from: Date; to: Date } | null>(null)

  const exportRange = useMemo((): { from: Date; to: Date } | null => {
    const n = new Date()
    switch (exportMode) {
      case "thisMonth": {
        const to = new Date(n); to.setHours(23, 59, 59, 999)
        return { from: new Date(n.getFullYear(), n.getMonth(), 1), to }
      }
      case "lastMonth": {
        const from = new Date(n.getFullYear(), n.getMonth() - 1, 1)
        const to = new Date(n.getFullYear(), n.getMonth(), 0); to.setHours(23, 59, 59, 999)
        return { from, to }
      }
      case "thisYear": {
        const to = new Date(n); to.setHours(23, 59, 59, 999)
        return { from: new Date(n.getFullYear(), 0, 1), to }
      }
      case "lastYear": {
        const from = new Date(n.getFullYear() - 1, 0, 1)
        const to = new Date(n.getFullYear() - 1, 11, 31); to.setHours(23, 59, 59, 999)
        return { from, to }
      }
      case "custom":
        return exportApplied
      default:
        return null
    }
  }, [exportMode, exportApplied])

  const exportRangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    switch (exportMode) {
      case "thisMonth": return now.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
      case "lastMonth": return new Date(now.getFullYear(), now.getMonth() - 1, 1)
          .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
      case "thisYear": return `Año ${now.getFullYear()}`
      case "lastYear": return `Año ${now.getFullYear() - 1}`
      case "custom": return exportApplied
          ? `${fmt(exportApplied.from)} — ${fmt(exportApplied.to)}`
          : "Rango personalizado"
      default: return ""
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportMode, exportApplied])

  const exportTxs = useMemo(() => {
    if (!exportRange) return []
    return transactions.filter(tx => {
      const d = new Date(tx.date)
      return d >= exportRange.from && d <= exportRange.to
    })
  }, [exportRange, transactions])

  const applyExportRange = useCallback(() => {
    if (!exportCalRange?.from) return
    const to = exportCalRange.to ?? exportCalRange.from
    const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999)
    setExportApplied({ from: exportCalRange.from, to: toEnd })
    setShowExportCalendar(false)
  }, [exportCalRange])

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = "Fecha,Tipo,Descripción,Categoría,Monto,Moneda,Nota"
    const rows = exportTxs.map(tx => {
      const date = new Date(tx.date).toLocaleDateString("es-AR")
      const type = tx.type === "expense" ? "Gasto" : "Ingreso"
      const desc = `"${tx.description.replace(/"/g, '""')}"`
      const obs = tx.observation ? `"${tx.observation.replace(/"/g, '""')}"` : ""
      return [date, type, desc, tx.category, tx.amount, tx.currency, obs].join(",")
    })
    const csv = [header, ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `BudgetBuddy-${exportRangeLabel.replace(/[\s/]/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const totalExp = exportTxs
      .filter(t => t.type === "expense")
      .reduce((a, t) => a + toArs(t), 0)
    const totalInc = exportTxs
      .filter(t => t.type === "income")
      .reduce((a, t) => a + toArs(t), 0)
    const balance = totalInc - totalExp

    // Category breakdown
    const catMap: Record<string, number> = {}
    exportTxs.filter(t => t.type === "expense").forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + toArs(t)
    })
    const catRows = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${cat}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#ef4444;font-weight:600">
            −${fmtArs(val)} ARS
          </td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280">
            ${catMap ? Math.round((val / totalExp) * 100) : 0}%
          </td>
        </tr>`).join("")

    // Transaction rows (latest first)
    const txRows = [...exportTxs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50)
      .map(tx => {
        const isExp = tx.type === "expense"
        const dateStr = new Date(tx.date).toLocaleDateString("es-AR")
        const amtStr = `${isExp ? "−" : "+"}${tx.amount.toLocaleString("es-AR")} ${tx.currency}`
        return `
          <tr>
            <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">${dateStr}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">${tx.description}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${tx.category}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;text-align:right;font-weight:600;color:${isExp ? "#ef4444" : "#10b981"}">${amtStr}</td>
          </tr>`
      }).join("")

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>BudgetBuddy — ${exportRangeLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;background:#fff;padding:32px;max-width:800px;margin:0 auto}
    @media print{body{padding:16px}}
    h1{font-size:22px;font-weight:700;color:#111827}
    h2{font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin:24px 0 10px}
    .logo{display:flex;align-items:center;gap:10px;margin-bottom:4px}
    .logo-dot{width:32px;height:32px;background:#10b981;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
    .subtitle{font-size:13px;color:#6b7280;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #f3f4f6}
    .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
    .card{background:#f9fafb;border-radius:12px;padding:16px;border:1px solid #e5e7eb}
    .card-label{font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:500}
    .card-value{font-size:20px;font-weight:700}
    .card-value.inc{color:#10b981}
    .card-value.exp{color:#ef4444}
    .card-value.bal{color:${balance >= 0 ? "#10b981" : "#ef4444"}}
    table{width:100%;border-collapse:collapse}
    thead th{background:#f9fafb;padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb}
    .footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center}
  </style>
</head>
<body>
  <div class="logo">
    <div class="logo-dot">BB</div>
    <h1>BudgetBuddy</h1>
  </div>
  <p class="subtitle">Resumen de ${exportRangeLabel} · Generado el ${new Date().toLocaleDateString("es-AR")}</p>

  <div class="cards">
    <div class="card">
      <div class="card-label">Ingresos</div>
      <div class="card-value inc">+${fmtArs(totalInc)}</div>
    </div>
    <div class="card">
      <div class="card-label">Gastos</div>
      <div class="card-value exp">−${fmtArs(totalExp)}</div>
    </div>
    <div class="card">
      <div class="card-label">Balance</div>
      <div class="card-value bal">${balance >= 0 ? "+" : ""}${fmtArs(balance)}</div>
    </div>
  </div>

  ${catRows ? `
  <h2>Gastos por categoría</h2>
  <table>
    <thead><tr><th>Categoría</th><th style="text-align:right">Monto</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>` : ""}

  <h2>Movimientos (${exportTxs.length}${exportTxs.length > 50 ? ", mostrando los 50 más recientes" : ""})</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead>
    <tbody>${txRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af">Sin movimientos</td></tr>'}</tbody>
  </table>

  <p class="footer">BudgetBuddy · finanzas-budget-buddy.vercel.app</p>
</body>
</html>`

    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  // Resolve CSS custom property colors for Recharts SVG strokes
  const [chartColors, setChartColors] = useState({ income: "#22c994", expense: "#e0633a" })
  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const primary = style.getPropertyValue("--primary").trim()
    const destructive = style.getPropertyValue("--destructive").trim()
    if (primary) setChartColors(c => ({ ...c, income: primary }))
    if (destructive) setChartColors(c => ({ ...c, expense: destructive }))
  }, [])

  // Phase 2: auto-load older transactions on mount
  useEffect(() => {
    if (hasMoreTransactions) loadMoreTransactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toArs = (tx: Transaction) =>
    tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount

  // ── Recurring templates (deduplicated — latest transaction per description+category)
  const recurringTemplates = useMemo(() => {
    const map = new Map<string, Transaction>()
    transactions
      .filter(tx => tx.isRecurring)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(tx => {
        const key = `${tx.description.toLowerCase()}::${tx.category}`
        if (!map.has(key)) map.set(key, tx)
      })
    return Array.from(map.values())
  }, [transactions])

  // ── Apply recurring: create this month's missing transactions
  const handleApplyMonth = () => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    const alreadyThisMonth = new Set(
      transactions
        .filter(tx => {
          const d = new Date(tx.date)
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear
        })
        .map(tx => `${tx.description.toLowerCase()}::${tx.category}`)
    )

    const toCreate = recurringTemplates.filter(
      tpl => !alreadyThisMonth.has(`${tpl.description.toLowerCase()}::${tpl.category}`)
    )

    setApplyingMonth(true)
    toCreate.forEach(tpl => {
      addTransaction({
        description: tpl.description,
        amount: tpl.amount,
        type: tpl.type,
        icon: tpl.icon,
        category: tpl.category,
        date: now,
        observation: tpl.observation,
        currency: tpl.currency,
        amountUsd: tpl.amountUsd,
        txRate: tpl.txRate,
        exchangeRateType: tpl.exchangeRateType,
        isRecurring: true,
        recurringFrequency: tpl.recurringFrequency ?? "monthly",
      })
    })
    setApplyingMonth(false)
    setAppliedCount(toCreate.length)
    setTimeout(() => setAppliedCount(null), 4000)
  }

  // ── Monthly trend — last 12 calendar months (always uses all transactions)
  const trendData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const month = d.getMonth()
      const year = d.getFullYear()
      const monthTxs = transactions.filter(tx => {
        const td = new Date(tx.date)
        return td.getMonth() === month && td.getFullYear() === year
      })
      const gastos = monthTxs
        .filter(tx => tx.type === "expense")
        .reduce((a, tx) => a + toArs(tx), 0)
      const ingresos = monthTxs
        .filter(tx => tx.type === "income")
        .reduce((a, tx) => a + toArs(tx), 0)
      return {
        label: MONTH_LABELS[month],
        gastos: Math.round(gastos),
        ingresos: Math.round(ingresos),
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, usdRate])

  const hasData = trendData.some(d => d.gastos > 0 || d.ingresos > 0)

  // ── Filtered transactions by active time period (future-dated excluded) ──────
  const filteredTransactions = useMemo(() => {
    const n = new Date()
    const todayEnd = new Date(n); todayEnd.setHours(23, 59, 59, 999)
    return transactions.filter(tx => {
      const d = new Date(tx.date)
      if (d > todayEnd) return false  // future-dated never in active period
      if (timeFilter === "week") {
        const weekAgo = new Date(n)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return d >= weekAgo
      }
      if (timeFilter === "month") {
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
      }
      if (timeFilter === "year") {
        return d.getFullYear() === n.getFullYear()
      }
      return d >= customRange.from && d <= customRange.to
    })
  }, [transactions, timeFilter, customRange])

  // ── Future-dated scheduled transactions ───────────────────────────────────
  const futureTransactions = useMemo(() => {
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1)
    return transactions
      .filter(tx => new Date(tx.date) >= tomorrow)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [transactions])

  // ── Future transactions grouped by month ──────────────────────────────────
  const futureGroups = useMemo(() => {
    const map = new Map<string, { label: string; txs: typeof futureTransactions; expenses: number; income: number }>()
    futureTransactions.forEach(tx => {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map.has(key)) map.set(key, {
        label: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
        txs: [],
        expenses: 0,
        income: 0,
      })
      const g = map.get(key)!
      g.txs.push(tx)
      if (tx.type === "expense") g.expenses += toArs(tx)
      else g.income += toArs(tx)
    })
    return map
  }, [futureTransactions, usdRate])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    switch (timeFilter) {
      case "week": return "Última semana"
      case "month": return "Este mes"
      case "year": return `Año ${now.getFullYear()}`
      case "custom": {
        const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
        return `${fmt(customRange.from)} – ${fmt(customRange.to)}`
      }
    }
  }, [timeFilter, customRange])

  // ── Expense chart title ───────────────────────────────────────────────────
  const expenseChartTitle = useMemo(() => {
    switch (timeFilter) {
      case "week": return "Gastos de la semana"
      case "month": return `Gastos del mes · ${MONTH_LABELS[now.getMonth()]}`
      case "year": return `Gastos del año · ${now.getFullYear()}`
      case "custom": return "Gastos del período"
    }
  }, [timeFilter])

  // ── Category breakdown ────────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    filteredTransactions
      .filter(tx => tx.type === "expense")
      .forEach(tx => {
        const cat = tx.category || "Sin categoría"
        map.set(cat, (map.get(cat) ?? 0) + toArs(tx))
      })
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
    if (sorted.length <= 7) return sorted
    const top = sorted.slice(0, 6)
    const othersVal = sorted.slice(6).reduce((a, c) => a + c.value, 0)
    return [...top, { name: "Otros", value: Math.round(othersVal) }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions, usdRate])

  // ── Adaptive chart data for non-month filters ────────────────────────────
  const timeRangeChartData = useMemo(() => {
    const n = new Date()
    if (timeFilter === "week") {
      const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(n)
        d.setDate(d.getDate() - (6 - i))
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
        const total = transactions
          .filter(tx => {
            const td = new Date(tx.date)
            return tx.type === "expense" && td >= dayStart && td <= dayEnd
          })
          .reduce((a, tx) => a + toArs(tx), 0)
        return { label: `${DAY_NAMES[d.getDay()]} ${d.getDate()}`, value: Math.round(total) }
      })
    }
    if (timeFilter === "year") {
      return Array.from({ length: n.getMonth() + 1 }, (_, i) => {
        const monthStart = new Date(n.getFullYear(), i, 1)
        const monthEnd = new Date(n.getFullYear(), i + 1, 0, 23, 59, 59, 999)
        const total = transactions
          .filter(tx => {
            const td = new Date(tx.date)
            return tx.type === "expense" && td >= monthStart && td <= monthEnd
          })
          .reduce((a, tx) => a + toArs(tx), 0)
        return { label: MONTH_LABELS[i], value: Math.round(total) }
      })
    }
    if (timeFilter === "custom") {
      const { from, to } = customRange
      const diffDays = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1
      if (diffDays <= 62) {
        return Array.from({ length: diffDays }, (_, i) => {
          const d = new Date(from)
          d.setDate(d.getDate() + i)
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
          const total = transactions
            .filter(tx => {
              const td = new Date(tx.date)
              return tx.type === "expense" && td >= dayStart && td <= dayEnd
            })
            .reduce((a, tx) => a + toArs(tx), 0)
          const showLabel = i === 0 || (i + 1) % 7 === 0 || i === diffDays - 1
          const fullLabel = `${d.getDate()}/${d.getMonth() + 1}`
          return { label: showLabel ? fullLabel : "", dateLabel: fullLabel, value: Math.round(total) }
        })
      } else {
        const months: { label: string; value: number }[] = []
        const cur = new Date(from.getFullYear(), from.getMonth(), 1)
        const last = new Date(to.getFullYear(), to.getMonth(), 1)
        while (cur <= last) {
          const monthStart = new Date(cur)
          const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999)
          const total = transactions
            .filter(tx => {
              const td = new Date(tx.date)
              return tx.type === "expense" && td >= monthStart && td <= monthEnd
            })
            .reduce((a, tx) => a + toArs(tx), 0)
          months.push({ label: MONTH_LABELS[cur.getMonth()], value: Math.round(total) })
          cur.setMonth(cur.getMonth() + 1)
        }
        return months
      }
    }
    return null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, usdRate, timeFilter, customRange])

  // ── Projection toggle ─────────────────────────────────────────────────────
  const [showProjection, setShowProjection] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("bb_show_projection") === "true"
  )
  const toggleProjection = () => setShowProjection(v => {
    const next = !v
    localStorage.setItem("bb_show_projection", String(next))
    return next
  })

  // ── Spending projection (history-weighted + known future) ────────────────
  const projectionData = useMemo(() => {
    const n = new Date()
    const curMonth = n.getMonth()
    const curYear = n.getFullYear()
    const daysElapsed = n.getDate()
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate()
    const remainingDays = daysInMonth - daysElapsed

    // Only past/today expenses for this month
    const currentMonthExp = transactions
      .filter(tx => {
        const d = new Date(tx.date)
        return tx.type === "expense" && d.getMonth() === curMonth && d.getFullYear() === curYear && d <= n
      })
      .reduce((a, tx) => a + toArs(tx), 0)

    if (daysElapsed < 1 || currentMonthExp === 0) return null

    const currentDailyRate = currentMonthExp / daysElapsed

    // Last 3 months: weight [3, 2, 1] (most recent = 3)
    const historical = [1, 2, 3].map((offset, idx) => {
      const d = new Date(curYear, curMonth - offset, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const daysInM = new Date(y, m + 1, 0).getDate()
      const total = transactions
        .filter(tx => {
          const td = new Date(tx.date)
          return tx.type === "expense" && td.getMonth() === m && td.getFullYear() === y
        })
        .reduce((a, tx) => a + toArs(tx), 0)
      return {
        label: MONTH_LABELS[m],
        total: Math.round(total),
        dailyRate: daysInM > 0 ? total / daysInM : 0,
        weight: 3 - idx,
        hasData: total > 0,
      }
    })

    const monthsWithData = historical.filter(m => m.hasData)
    let weightedHistRate = 0
    if (monthsWithData.length > 0) {
      const totalW = monthsWithData.reduce((a, m) => a + m.weight, 0)
      weightedHistRate = monthsWithData.reduce((a, m) => a + m.dailyRate * m.weight, 0) / totalW
    }

    const histWeight = monthsWithData.length >= 3 ? 0.4 : monthsWithData.length === 2 ? 0.3 : monthsWithData.length === 1 ? 0.2 : 0
    const blendedRate = currentDailyRate * (1 - histWeight) + weightedHistRate * histWeight

    // Known future expenses already scheduled for this month
    const futureDaysMap = new Map<number, number>()
    transactions.forEach(tx => {
      const d = new Date(tx.date)
      if (tx.type === "expense" && d.getMonth() === curMonth && d.getFullYear() === curYear && d > n) {
        const day = d.getDate()
        futureDaysMap.set(day, (futureDaysMap.get(day) ?? 0) + toArs(tx))
      }
    })
    const knownFutureExpenses = Array.from(futureDaysMap.values()).reduce((a, v) => a + v, 0)
    // Only extrapolate for days without a known scheduled transaction
    const extrapolationDays = Math.max(0, remainingDays - futureDaysMap.size)
    const projectedTotal = Math.round(currentMonthExp + knownFutureExpenses + blendedRate * extrapolationDays)

    const histMonthlyAvg = monthsWithData.length > 0
      ? monthsWithData.reduce((a, m) => a + m.total, 0) / monthsWithData.length
      : 0
    const trendPct = histMonthlyAvg > 0
      ? ((projectedTotal - histMonthlyAvg) / histMonthlyAvg) * 100
      : 0

    return {
      currentExpenses: Math.round(currentMonthExp),
      projectedTotal,
      daysElapsed,
      daysInMonth,
      remainingDays,
      currentDailyRate: Math.round(currentDailyRate),
      historicalDailyRate: Math.round(weightedHistRate),
      histMonthlyAvg: Math.round(histMonthlyAvg),
      monthsWithData: monthsWithData.length,
      trendPct,
      historical,
      knownFutureExpenses: Math.round(knownFutureExpenses),
      futureDaysMap,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, usdRate])

  // ── Daily projection chart data ───────────────────────────────────────────
  const dailyProjectionData = useMemo(() => {
    if (!projectionData) return null
    const n = new Date()
    const curMonth = n.getMonth()
    const curYear = n.getFullYear()
    const today = n.getDate()
    const { daysInMonth, currentExpenses, projectedTotal, daysElapsed, remainingDays, futureDaysMap } = projectionData

    // Build daily map for real past expenses only (exclude future-dated)
    const dailyMap = new Map<number, number>()
    transactions.forEach(tx => {
      const d = new Date(tx.date)
      if (tx.type === "expense" && d.getMonth() === curMonth && d.getFullYear() === curYear && d <= n) {
        const day = d.getDate()
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + toArs(tx))
      }
    })

    // Build step-wise projection: at each day, accumulate known futures + linear fill for unknown
    let cumulative = 0
    let projCumulative = currentExpenses  // starts at today's actual
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const isFuture = day > today
      if (!isFuture) cumulative += dailyMap.get(day) ?? 0
      const showLabel = day === 1 || day % 7 === 0 || day === today || day === daysInMonth
      let projected: number | null = null
      if (day >= today && remainingDays > 0) {
        // Step-wise: add known scheduled amount on that day, else linear interpolation
        const knownForDay = futureDaysMap?.get(day) ?? 0
        if (day > today) projCumulative += knownForDay
        const linearContrib = remainingDays > 0
          ? (projectedTotal - currentExpenses - (projectionData.knownFutureExpenses ?? 0)) / remainingDays
          : 0
        if (day > today && knownForDay === 0) projCumulative += linearContrib
        projected = Math.round(day === today ? currentExpenses : projCumulative)
      }
      const dateLabel = new Date(curYear, curMonth, day).toLocaleDateString("es-AR", { day: "numeric", month: "long" })
      const hasScheduled = isFuture && (futureDaysMap?.has(day) ?? false)
      return {
        day,
        label: showLabel ? String(day) : "",
        dateLabel,
        real: isFuture ? null : Math.round(cumulative),
        projected,
        hasScheduled,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, usdRate, projectionData])

  // ── Recurring frequency helpers ───────────────────────────────────────────
  const FREQ_LABELS: Record<string, string> = {
    weekly: "Semanal", biweekly: "Cada 15 días", monthly: "Mensual", annual: "Anual",
  }
  // Monthly equivalent multiplier per frequency
  const freqToMonthlyMultiplier = (freq?: string) => {
    if (freq === "weekly") return 4.33
    if (freq === "biweekly") return 2.17
    if (freq === "annual") return 1 / 12
    return 1 // monthly default
  }

  const filteredRecurringTemplates = useMemo(() =>
    recurringFreqFilter === "all"
      ? recurringTemplates
      : recurringTemplates.filter(t => (t.recurringFrequency ?? "monthly") === recurringFreqFilter),
    [recurringTemplates, recurringFreqFilter]
  )

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalRecurringArs = recurringTemplates
    .filter(t => t.type === "expense")
    .reduce((a, t) => a + toArs(t) * freqToMonthlyMultiplier(t.recurringFrequency), 0)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 pb-3 sm:px-6 border-b border-border bg-background" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}>
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Dashboard</span>
        </button>
        <div className="flex items-center gap-2 ml-1">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Analítica</span>
          {isLoadingHistory && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Cargando historial...
            </span>
          )}
        </div>
        <div className="ml-auto">
          <ShareSummary
            transactions={transactions}
            usdRate={usdRate}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 sm:px-6 max-w-3xl mx-auto w-full pb-16 flex flex-col gap-4">

          {/* ── Period filter chips ──────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          {([
            { id: "week" as TimeFilter, label: "Semana" },
            { id: "month" as TimeFilter, label: "Mes" },
            { id: "year" as TimeFilter, label: "Año" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTimeFilter(id)}
              className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                timeFilter === id
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          {timeFilter === "custom" && (
            <span className="flex-none px-3 py-1.5 rounded-full text-xs font-medium border border-primary bg-primary/10 text-primary">
              {periodLabel}
            </span>
          )}
        </div>

        {/* ── Monthly Trend Chart ──────────────────────────────────── */}
        <motion.div
          className="rounded-2xl border border-border bg-card p-4"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Tendencia — últimos 12 meses
          </p>

          {hasData ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtArs}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {value === "gastos" ? "Gastos" : "Ingresos"}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke={chartColors.income}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: chartColors.income }}
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  stroke={chartColors.expense}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: chartColors.expense }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[210px] flex items-center justify-center text-sm text-muted-foreground">
              Todavía no hay suficientes datos para mostrar la tendencia.
            </div>
          )}
        </motion.div>

        {/* ── Expense Chart (adaptive by period) ───────────────────── */}
        {timeFilter === "month" ? (
          dailyProjectionData && (
            <motion.div
              className="rounded-2xl border border-border bg-card p-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.01 }}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Gastos del mes · {MONTH_LABELS[now.getMonth()]}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyProjectionData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.expense} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={chartColors.expense} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtArs}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip content={<DailyProjectionTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="real"
                    stroke={chartColors.expense}
                    strokeWidth={2}
                    fill="url(#gradReal)"
                    dot={false}
                    activeDot={{ r: 4, fill: chartColors.expense }}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    stroke={chartColors.expense}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeOpacity={0.5}
                    fill="none"
                    dot={false}
                    activeDot={{ r: 4, fill: chartColors.expense }}
                    connectNulls={false}
                  />
                  <ReferenceLine
                    y={projectionData.projectedTotal}
                    stroke={chartColors.expense}
                    strokeDasharray="3 3"
                    strokeOpacity={0.35}
                    label={{
                      value: fmtArs(projectionData.projectedTotal),
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                      dy: -4,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )
        ) : (
          <motion.div
            className="rounded-2xl border border-border bg-card p-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.01 }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {expenseChartTitle}
            </p>
            {timeRangeChartData && timeRangeChartData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={timeRangeChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtArs}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip content={<SimpleValueTooltip />} />
                  <Bar
                    dataKey="value"
                    fill={chartColors.expense}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fillOpacity={0.85}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                Sin gastos en este período.
              </div>
            )}
          </motion.div>
        )}

        {/* ── Expense Heatmap Calendar ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.02 }}
        >
          <ExpenseHeatmap
            transactions={transactions}
            usdRate={usdRate}
          />
        </motion.div>

        {/* ── Spending Projection ──────────────────────────────────── */}
        <motion.div
          className="rounded-2xl border border-border bg-card overflow-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        >
          {/* Collapsible header */}
          <button
            type="button"
            onClick={toggleProjection}
            className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Proyección · {MONTH_LABELS[now.getMonth()]}
              </p>
              {projectionData && !showProjection && (
                <span className="text-sm font-bold text-foreground tabular-nums ml-1">
                  {fmtArs(projectionData.projectedTotal)}
                </span>
              )}
            </div>
            <motion.div animate={{ rotate: showProjection ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {showProjection && (
              <motion.div
                key="proj-body"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                {!projectionData ? (
                  <div className="px-4 pb-5 pt-1 text-center">
                    <TrendingUp className="w-8 h-8 text-muted-foreground/25 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Registrá gastos este mes para ver la proyección.</p>
                  </div>
                ) : (
                  <div className="px-4 pb-5 pt-1 flex flex-col gap-4 border-t border-border">

                    {/* Hero: projected total + trend */}
                    <div className="flex items-end justify-between pt-1 gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground mb-0.5">
                          Proyectado al {projectionData.daysInMonth}/{now.getMonth() + 1}
                        </p>
                        <p className="font-bold tabular-nums text-foreground truncate text-3xl">
                          {fmtArs(projectionData.projectedTotal)}
                        </p>
                      </div>
                      {projectionData.monthsWithData >= 1 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold shrink-0 max-w-[52%] overflow-hidden ${
                          Math.abs(projectionData.trendPct) < 5
                            ? "bg-secondary text-muted-foreground"
                            : projectionData.trendPct > 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary"
                        }`}>
                          <span className="shrink-0">
                            {Math.abs(projectionData.trendPct) < 5
                              ? <Minus className="w-3 h-3" />
                              : projectionData.trendPct > 0
                                ? <TrendingUp className="w-3 h-3" />
                                : <TrendingDown className="w-3 h-3" />}
                          </span>
                          <span className="truncate">
                            {Math.abs(projectionData.trendPct) < 5
                              ? `Similar a últ. ${projectionData.monthsWithData} ${projectionData.monthsWithData === 1 ? "mes" : "meses"}`
                              : `${fmtPct(projectionData.trendPct)} vs últ. ${projectionData.monthsWithData} ${projectionData.monthsWithData === 1 ? "mes" : "meses"}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar: current vs projected */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                        <span>Gastado hasta hoy · {fmtArs(projectionData.currentExpenses)}</span>
                        <span>{Math.round((projectionData.currentExpenses / projectionData.projectedTotal) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-accent"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((projectionData.currentExpenses / projectionData.projectedTotal) * 100, 100)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Quedan <span className="font-medium text-foreground">{projectionData.remainingDays} días</span> · ritmo actual {fmtArs(projectionData.currentDailyRate)}/día
                        {projectionData.monthsWithData >= 1 && (
                          <> · histórico {fmtArs(projectionData.historicalDailyRate)}/día</>
                        )}
                      </p>
                    </div>

                    {/* Historical months chips */}
                    {projectionData.monthsWithData >= 1 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-2">Últimos meses</p>
                        <div className="flex gap-2">
                          {projectionData.historical.map((m) => (
                            <div
                              key={m.label}
                              className={`flex-1 rounded-xl border px-3 py-2.5 text-center ${
                                m.hasData ? "border-border bg-secondary/30" : "border-border/40 bg-secondary/10 opacity-50"
                              }`}
                            >
                              <p className="text-[10px] text-muted-foreground capitalize mb-1">{m.label}</p>
                              <p className="text-sm font-semibold tabular-nums text-foreground">
                                {m.hasData ? fmtArs(m.total) : "—"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Data quality notice */}
                    {projectionData.monthsWithData < 2 && (
                      <p className="text-[11px] text-muted-foreground/60 border border-border/50 rounded-lg px-3 py-2 bg-secondary/20">
                        {projectionData.monthsWithData === 0
                          ? "Proyección lineal — sin historial previo. Más preciso con 2-3 meses de datos."
                          : "Proyección con 1 mes de historial. Más preciso con 2-3 meses de datos."}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Category Breakdown (Donut) ──────────────────────────── */}
        <motion.div
          className="rounded-2xl border border-border bg-card p-4"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gastos por categoría
            </p>
            <span className="text-xs text-muted-foreground/60">{periodLabel}</span>
          </div>

          {categoryData.length > 0 ? (
            <div className="flex flex-col gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {categoryData.map((item, i) => {
                  const total = categoryData.reduce((a, c) => a + c.value, 0)
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                  return (
                    <div key={item.name} className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground truncate flex-1">{item.name}</span>
                      <span className="text-xs font-medium text-foreground tabular-nums shrink-0">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Registrá gastos para ver el desglose por categoría.
            </div>
          )}
        </motion.div>

        {/* ── Export ───────────────────────────────────────────────── */}
        <motion.div
          className="rounded-2xl border border-border bg-card overflow-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
        >
          <div className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Exportar
            </p>

            {/* Preset chips */}
            <div className="flex gap-2 flex-wrap mb-3">
              {(
                [
                  { id: "thisMonth", label: "Este mes" },
                  { id: "lastMonth", label: "Mes anterior" },
                  { id: "thisYear",  label: `Año ${now.getFullYear()}` },
                  { id: "lastYear",  label: `Año ${now.getFullYear() - 1}` },
                  { id: "custom",    label: "Personalizado" },
                ] as { id: ExportMode; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setExportMode(id)
                    if (id === "custom") {
                      setShowExportCalendar(v => !v)
                    } else {
                      setShowExportCalendar(false)
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                    exportMode === id
                      ? id === "custom"
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-primary text-primary-foreground border-transparent"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Range summary */}
            <p className="text-xs text-muted-foreground mb-4">
              {exportTxs.length > 0
                ? <><span className="font-medium text-foreground">{exportTxs.length}</span> movimientos · {exportRangeLabel}</>
                : exportMode === "custom" && !exportApplied
                  ? "Seleccioná un rango en el calendario"
                  : `Sin movimientos · ${exportRangeLabel}`
              }
            </p>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportCSV}
                disabled={exportTxs.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                type="button"
                onClick={exportPDF}
                disabled={exportTxs.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-sm font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>

          {/* Inline calendar for custom range */}
          <AnimatePresence>
            {exportMode === "custom" && showExportCalendar && (
              <motion.div
                className="border-t border-border"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="p-4 pt-3">
                  {/* Range preview */}
                  <div className="flex items-center justify-between mb-2 px-1 min-h-[20px]">
                    {exportCalRange?.from ? (
                      <>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {exportCalRange.from.toLocaleDateString("es-AR")}
                          {" → "}
                          {exportCalRange.to
                            ? exportCalRange.to.toLocaleDateString("es-AR")
                            : "..."}
                        </span>
                        {exportCalRange.to && (
                          <span className="text-xs text-muted-foreground">
                            {Math.max(1, Math.round(
                              (exportCalRange.to.getTime() - exportCalRange.from.getTime()) / 86400000
                            ) + 1)} días
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">
                        Seleccioná fecha de inicio
                      </span>
                    )}
                  </div>

                  <CalendarWithNav
                    selected={exportCalRange}
                    onSelect={setExportCalRange}
                    locale={es}
                    disabled={{ after: new Date() }}
                  />

                  <button
                    type="button"
                    onClick={applyExportRange}
                    disabled={!exportCalRange?.from}
                    className="mt-3 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aplicar rango
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Scheduled Future Transactions ────────────────────────── */}
        {futureTransactions.length > 0 && (() => {
          const totalFutureExp = Array.from(futureGroups.values()).reduce((a, g) => a + g.expenses, 0)
          const totalFutureInc = Array.from(futureGroups.values()).reduce((a, g) => a + g.income, 0)
          return (
            <motion.div
              className="rounded-2xl border border-border bg-card overflow-hidden"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Programados a futuro
                    <span className="ml-1.5 text-foreground">({futureTransactions.length})</span>
                  </p>
                </div>
              </div>

              {/* Summary totals */}
              <div className="grid grid-cols-2 gap-px bg-border">
                {totalFutureInc > 0 && (
                  <div className="bg-card px-4 py-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Ingresos</span>
                    <span className="text-sm font-semibold text-primary tabular-nums truncate">+{fmtArs(totalFutureInc)}</span>
                  </div>
                )}
                {totalFutureExp > 0 && (
                  <div className="bg-card px-4 py-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Gastos</span>
                    <span className="text-sm font-semibold text-destructive tabular-nums truncate">−{fmtArs(totalFutureExp)}</span>
                  </div>
                )}
              </div>

              {/* Group list — all collapsed by default */}
              <div className="flex flex-col divide-y divide-border">
                {Array.from(futureGroups.entries()).map(([key, group]) => {
                  const isExpanded = expandedFutureGroups.has(key)
                  const groupIncome = group.income
                  const groupExpenses = group.expenses
                  return (
                    <div key={key}>
                      {/* Month row — always a clickable accordion trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedFutureGroups(prev => {
                            const next = new Set(prev)
                            if (next.has(key)) next.delete(key)
                            else next.add(key)
                            return next
                          })
                        }}
                        className="w-full flex items-center justify-between px-4 pt-3 pb-2 cursor-pointer hover:bg-secondary/20 transition-colors"
                      >
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider capitalize">
                          {group.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {groupIncome > 0 && <span className="text-[10px] font-semibold text-primary">+{fmtArs(groupIncome)}</span>}
                          {groupExpenses > 0 && <span className="text-[10px] font-semibold text-destructive">−{fmtArs(groupExpenses)}</span>}
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </button>

                      {/* Transactions — animated accordion */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            {group.txs.map(tx => {
                              const Icon = iconMap[tx.icon] || ShoppingCart
                              const d = new Date(tx.date)
                              const isIncome = tx.type === "income"
                              return (
                                <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${isIncome ? "bg-primary/10" : "bg-secondary"}`}>
                                    <Icon className={`w-4 h-4 ${isIncome ? "text-primary" : "text-muted-foreground"}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · {tx.category}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Clock className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                    <span className={`text-sm font-semibold tabular-nums truncate max-w-[90px] ${isIncome ? "text-primary" : "text-destructive"}`}>
                                      {isIncome ? "+" : "−"}{fmtArs(toArs(tx))} {tx.currency}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingFutureTx(tx)}
                                      className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )
        })()}

        {/* ── Recurring Transactions ───────────────────────────────── */}
        <motion.div
          className="rounded-2xl border border-border bg-card overflow-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Gastos fijos
                {recurringTemplates.length > 0 && (
                  <span className="ml-1.5 text-foreground">({recurringTemplates.length})</span>
                )}
              </p>
            </div>
            {recurringTemplates.length > 0 && (
              <button
                type="button"
                onClick={handleApplyMonth}
                disabled={applyingMonth}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${applyingMonth ? "animate-spin" : ""}`} />
                Aplicar este mes
              </button>
            )}
          </div>

          {/* Frequency filter chips */}
          {recurringTemplates.length > 0 && (
            <div className="flex gap-1.5 px-4 py-2.5 border-b border-border overflow-x-auto scrollbar-none">
              {(["all", "weekly", "biweekly", "monthly", "annual"] as const).map(f => {
                const label = f === "all" ? "Todos" : FREQ_LABELS[f]
                const isActive = recurringFreqFilter === f
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRecurringFreqFilter(f)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Feedback banner */}
          <AnimatePresence>
            {appliedCount !== null && (
              <motion.div
                className="flex items-center gap-2 px-4 py-2.5 text-xs border-b border-primary/20 bg-primary/10 text-primary"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                {appliedCount > 0
                  ? `Se crearon ${appliedCount} transacción${appliedCount > 1 ? "es" : ""} este mes.`
                  : "Todos los fijos ya están registrados este mes."}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary row when there are templates */}
          {recurringTemplates.length > 0 && totalRecurringArs > 0 && (
            <div className="px-4 py-2.5 bg-secondary/30 border-b border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Equivalente mensual (todos los fijos)</span>
              <span className="text-xs font-semibold text-destructive tabular-nums">
                −{fmtArs(totalRecurringArs)} ARS
              </span>
            </div>
          )}

          {/* Template list */}
          {recurringTemplates.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Repeat className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay transacciones fijas todavía.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Editá un movimiento en el Dashboard y activá &quot;Gasto fijo&quot;.
              </p>
            </div>
          ) : filteredRecurringTemplates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No hay fijos con esa frecuencia.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {filteredRecurringTemplates.map(tpl => {
                const Icon = iconMap[tpl.icon] || ShoppingCart
                const isIncome = tpl.type === "income"
                const freq = tpl.recurringFrequency ?? "monthly"
                return (
                  <div key={tpl.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
                        isIncome ? "bg-primary/10" : "bg-secondary"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isIncome ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tpl.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-secondary text-muted-foreground">
                          {tpl.category}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary">
                          {FREQ_LABELS[freq]}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isIncome ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {isIncome ? "+" : "−"}${tpl.amount.toLocaleString("es-AR")} {tpl.currency}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateTransaction(tpl.id, { isRecurring: false })}
                        className="text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors cursor-pointer"
                      >
                        Quitar fijo
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </main>

      {/* ── Delete future transaction confirmation ───────────── */}
      <AlertDialog open={!!deletingFutureTx} onOpenChange={open => { if (!open) setDeletingFutureTx(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento programado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará &ldquo;{deletingFutureTx?.description}&rdquo;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingFutureTx) return
                deleteTransaction(deletingFutureTx.id)
                setDeletingFutureTx(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

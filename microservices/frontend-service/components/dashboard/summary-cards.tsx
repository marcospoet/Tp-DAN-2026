"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"

function fmtCompact(n: number): string {
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(1)}T`
  if (abs >= 1_000_000_000)     return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  return `${sign}$${Math.round(abs).toLocaleString("es-AR")}`
}

interface SummaryCardsProps {
  totalExpenses: number
  totalIncome: number
  balance: number
  formatCurrency: (n: number) => string
  typeFilter: "income" | "expense" | null
  onTypeFilter: (t: "income" | "expense" | null) => void
}

export function SummaryCards({
  totalExpenses,
  totalIncome,
  typeFilter,
  onTypeFilter,
}: SummaryCardsProps) {
  const incomeActive = typeFilter === "income"
  const expenseActive = typeFilter === "expense"
  const anyActive = typeFilter !== null

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 mb-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {/* Ingresos */}
      <button
        type="button"
        onClick={() => onTypeFilter(incomeActive ? null : "income")}
        className={`rounded-2xl border bg-card p-4 flex flex-col items-center text-center gap-2 cursor-pointer transition-all duration-200 ${
          incomeActive
            ? "border-primary ring-1 ring-primary/40 bg-primary/5"
            : anyActive
            ? "border-border opacity-50"
            : "border-border hover:border-primary/30 hover:bg-secondary/30"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${incomeActive ? "bg-primary/20" : "bg-primary/10"}`}>
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Ingresos</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-lg font-bold text-primary tabular-nums leading-tight">
            {fmtCompact(totalIncome)}
          </p>
          <span className="text-[10px] font-medium text-muted-foreground/60 tracking-widest uppercase">ARS</span>
        </div>
      </button>

      {/* Gastos */}
      <button
        type="button"
        onClick={() => onTypeFilter(expenseActive ? null : "expense")}
        className={`rounded-2xl border bg-card p-4 flex flex-col items-center text-center gap-2 cursor-pointer transition-all duration-200 ${
          expenseActive
            ? "border-destructive ring-1 ring-destructive/40 bg-destructive/5"
            : anyActive
            ? "border-border opacity-50"
            : "border-border hover:border-destructive/30 hover:bg-secondary/30"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${expenseActive ? "bg-destructive/20" : "bg-destructive/10"}`}>
            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
          </div>
          <span className="text-xs text-muted-foreground">Gastos</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-lg font-bold text-destructive tabular-nums leading-tight">
            {fmtCompact(totalExpenses)}
          </p>
          <span className="text-[10px] font-medium text-muted-foreground/60 tracking-widest uppercase">ARS</span>
        </div>
      </button>
    </motion.div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Wallet, TrendingUp, TrendingDown, ArrowLeft, Receipt } from "lucide-react"
import type { Transaction } from "@/lib/app-context"
import { PAYMENT_ACCOUNTS } from "@/components/dashboard/shared"
import { formatDateShort } from "@/components/dashboard/shared"

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtArs(n: number): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : ""
  return `${sign}$\u00a0${Math.abs(n).toLocaleString("es-AR")}`
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    "Billetera Virtual": "bg-violet-500",
    "Cripto/Inversión":  "bg-amber-500",
    "Banco Digital":     "bg-cyan-500",
    "Banco Privado":     "bg-blue-500",
    "Banco Público":     "bg-emerald-600",
    "Efectivo":          "bg-primary",
  }
  return map[category] ?? "bg-muted-foreground"
}

// ── types ────────────────────────────────────────────────────────────────────
interface AccountRow {
  name: string
  category: string
  income: number
  expenses: number
  balance: number
}

// ── component ─────────────────────────────────────────────────────────────────
interface AccountsModalProps {
  open: boolean
  onClose: () => void
  transactions: Transaction[]
  usdRate: number
}

export function AccountsModal({ open, onClose, transactions, usdRate }: AccountsModalProps) {
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null)

  const toArs = (tx: Transaction) =>
    tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount

  const rows = useMemo((): AccountRow[] => {
    const map = new Map<string, { income: number; expenses: number; category: string }>()

    for (const tx of transactions) {
      const name = tx.account ?? "Sin asignar"
      const existing = map.get(name)
      const entry = existing ?? { income: 0, expenses: 0, category: "" }
      if (!existing) {
        const found = PAYMENT_ACCOUNTS.find(a => a.name === name)
        entry.category = found?.category ?? (name === "Sin asignar" ? "Sin asignar" : "General")
        map.set(name, entry)
      }
      if (tx.type === "income") entry.income += toArs(tx)
      else entry.expenses += toArs(tx)
    }

    return Array.from(map.entries())
      .map(([name, { income, expenses, category }]) => ({
        name,
        category,
        income,
        expenses,
        balance: income - expenses,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, usdRate])

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.balance)), 1)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelectedAccountName(null); onClose() }}
          />

          {/* sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-card border-t border-border shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">¿Dónde está mi dinero?</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Balance del período por cuenta</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedAccountName(null); onClose() }}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary transition-colors cursor-pointer text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* total */}
            <div className="px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Balance total</p>
                  <p className={`text-xl font-bold tabular-nums ${totalBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                    {totalBalance < 0 ? "-" : ""}${Math.abs(totalBalance).toLocaleString("es-AR")}
                    <span className="text-xs font-normal text-muted-foreground ml-1">ARS</span>
                  </p>
                </div>
              </div>
            </div>

            {/* accounts list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <Wallet className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sin transacciones registradas</p>
                </div>
              ) : (
                rows.map((row, i) => {
                  const pct = Math.round((Math.abs(row.balance) / maxAbs) * 100)
                  const isPos = row.balance >= 0
                  const dotColor = categoryColor(row.category)
                  const txCount = transactions.filter(t => (t.account ?? "Sin asignar") === row.name).length

                  return (
                    <motion.div
                      key={row.name}
                      className="rounded-xl border border-border bg-secondary/20 p-4 cursor-pointer hover:border-primary/30 hover:bg-secondary/40 transition-colors"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedAccountName(row.name)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                            <p className="text-[11px] text-muted-foreground">{row.category} · {txCount} mov.</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${isPos ? "text-primary" : "text-destructive"}`}>
                          {fmtArs(row.balance)}
                        </span>
                      </div>

                      {/* progress bar */}
                      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                        <motion.div
                          className={`h-full rounded-full ${isPos ? "bg-primary" : "bg-destructive"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                        />
                      </div>

                      {/* income / expense breakdown */}
                      <div className="flex items-center gap-3 mt-1">
                        {row.income > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-primary">
                            <TrendingUp className="w-3 h-3" />
                            +${row.income.toLocaleString("es-AR")}
                          </span>
                        )}
                        {row.expenses > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-destructive">
                            <TrendingDown className="w-3 h-3" />
                            -${row.expenses.toLocaleString("es-AR")}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })
              )}
              {/* safe area bottom */}
              <div className="h-4 shrink-0" />
            </div>

            {/* ── Drill-down panel ──────────────────────────────────────────── */}
            <AnimatePresence>
              {selectedAccountName && (() => {
                const acctTxs = transactions
                  .filter(t => (t.account ?? "Sin asignar") === selectedAccountName)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                const acctIncome = acctTxs.filter(t => t.type === "income").reduce((s, t) => s + toArs(t), 0)
                const acctExpenses = acctTxs.filter(t => t.type === "expense").reduce((s, t) => s + toArs(t), 0)
                const acctBalance = acctIncome - acctExpenses
                return (
                  <motion.div
                    key="drill"
                    className="absolute inset-0 rounded-t-2xl bg-card flex flex-col overflow-hidden"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 280 }}
                  >
                    {/* drill header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedAccountName(null)}
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary transition-colors cursor-pointer text-muted-foreground shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{selectedAccountName}</p>
                        <p className="text-[11px] text-muted-foreground">{acctTxs.length} movimiento{acctTxs.length !== 1 ? "s" : ""}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${acctBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {fmtArs(acctBalance)}
                      </span>
                    </div>

                    {/* summary row */}
                    <div className="flex gap-2 px-4 py-3 border-b border-border shrink-0">
                      {acctIncome > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
                          <TrendingUp className="w-3 h-3 text-primary" />
                          <span className="text-[11px] font-medium text-primary">+${acctIncome.toLocaleString("es-AR")}</span>
                        </div>
                      )}
                      {acctExpenses > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5">
                          <TrendingDown className="w-3 h-3 text-destructive" />
                          <span className="text-[11px] font-medium text-destructive">-${acctExpenses.toLocaleString("es-AR")}</span>
                        </div>
                      )}
                    </div>

                    {/* transaction list */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                      {acctTxs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                          <Receipt className="w-8 h-8 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">Sin movimientos en este período</p>
                        </div>
                      ) : (
                        acctTxs.map((tx, i) => (
                          <motion.div
                            key={tx.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                              <p className="text-[11px] text-muted-foreground">{tx.category} · {formatDateShort(new Date(tx.date))}</p>
                            </div>
                            <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === "income" ? "text-primary" : "text-destructive"}`}>
                              {tx.type === "income" ? "+" : "-"}${toArs(tx).toLocaleString("es-AR")}
                            </span>
                          </motion.div>
                        ))
                      )}
                      <div className="h-4 shrink-0" />
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

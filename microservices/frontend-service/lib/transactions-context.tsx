"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { apiRequest, getToken } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import type { ExchangeRateType } from "@/lib/settings-context"

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "annual"

export interface Transaction {
  id: string
  description: string
  amount: number
  type: "income" | "expense"
  icon: string
  category: string
  date: Date
  observation?: string
  currency: "ARS" | "USD"
  amountUsd?: number
  /** Tasa ARS bloqueada al momento del gasto — inmutable */
  txRate?: number
  exchangeRateType?: ExchangeRateType | null
  /** URL del comprobante adjunto */
  receiptUrl?: string
  /** Cuándo fue agregada al sistema (ISO string) */
  createdAt?: string
  /** Se repite automáticamente */
  isRecurring?: boolean
  /** Frecuencia de repetición del fijo */
  recurringFrequency?: RecurringFrequency
  /** Banco o billetera utilizado (ej: "Banco Galicia", "Mercado Pago") */
  account?: string
}

// ── Offline queue ─────────────────────────────────────────────────────────────
type OfflineOp =
  | { op: "add"; tempId: string; row: Record<string, unknown> }
  | { op: "update"; id: string; row: Record<string, unknown> }
  | { op: "delete"; id: string }

const QUEUE_KEY = "bb_offline_queue"

function loadQueue(): OfflineOp[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") } catch { return [] }
}

function persistQueue(q: OfflineOp[]) {
  if (typeof window !== "undefined") localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// ── Field sanitization (strips HTML, enforces length limits) ─────────────────
function sanitizeField(value: string | undefined | null, maxLen: number): string | null {
  if (value == null) return null
  const clean = String(value).replace(/<[^>]*>/g, "").trim().slice(0, maxLen)
  return clean || null
}

// ── Date → ISO "YYYY-MM-DD" ───────────────────────────────────────────────────
// Usa la fecha LOCAL, no toISOString() (UTC): en Argentina (UTC-3), después de
// las 21:00 la fecha UTC ya es el día siguiente y la transacción quedaría
// fechada a futuro.
function toIsoDate(d: Date | string): string {
  if (typeof d === "string") {
    // Ya viene como "YYYY-MM-DD" → devolver tal cual (parsearla con new Date()
    // la interpretaría como medianoche UTC y podría correrla un día)
    const m = d.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
  }
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

// ── Backend response (camelCase) → Transaction ────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransaction(row: any): Transaction {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    type: row.type,
    icon: row.icon || "ShoppingCart",
    category: row.category,
    date: new Date(row.date + "T00:00:00"),
    observation: row.observation ?? undefined,
    currency: row.currency,
    amountUsd: row.amountUsd != null ? Number(row.amountUsd) : undefined,
    txRate: row.txRate != null ? Number(row.txRate) : undefined,
    exchangeRateType: row.exchangeRateType ?? null,
    receiptUrl: row.receiptUrl ?? undefined,
    createdAt: row.createdAt ?? undefined,
    isRecurring: row.isRecurring ?? row.recurring ?? false,
    recurringFrequency: (row.recurringFrequency ?? undefined) as RecurringFrequency | undefined,
    account: row.account ?? undefined,
  }
}

interface TransactionsState {
  transactions: Transaction[]
  addTransaction: (t: Omit<Transaction, "id">, onError?: (msg: string) => void, onCreated?: (id: string) => void) => void
  patchTransactionReceiptUrl: (id: string, receiptUrl: string) => void
  deleteTransaction: (id: string, onError?: (msg: string) => void) => void
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, "id">>, onError?: (msg: string) => void) => void
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
  isOnline: boolean
  pendingOfflineCount: number
  isLoadingHistory: boolean
  hasMoreTransactions: boolean
  loadMoreTransactions: () => Promise<void>
}

const TransactionsContext = createContext<TransactionsState | null>(null)

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user, registerSignOutCleanup } = useAuth()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() => loadQueue().length)

  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const historyCutoffRef = useRef<string | null>(null)

  // ── Online/offline listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  // ── Replay offline queue when back online ────────────────────────────────────
  useEffect(() => {
    if (!isOnline || !user) return
    const queue = loadQueue()
    if (queue.length === 0) return

    ;(async () => {
      const idMap = new Map<string, string>()
      for (const op of queue) {
        try {
          if (op.op === "add") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = await apiRequest("/api/transactions", {
              method: "POST",
              body: JSON.stringify(op.row),
            })
            idMap.set(op.tempId, data.id)
            setTransactions(prev => prev.map(tx => tx.id === op.tempId ? mapTransaction(data) : tx))
          } else if (op.op === "update") {
            const realId = idMap.get(op.id) ?? op.id
            await apiRequest(`/api/transactions/${realId}`, {
              method: "PUT",
              body: JSON.stringify(op.row),
            })
          } else if (op.op === "delete") {
            const realId = idMap.get(op.id) ?? op.id
            if (idMap.has(op.id)) setTransactions(prev => prev.filter(tx => tx.id !== realId))
            await apiRequest(`/api/transactions/${realId}`, { method: "DELETE" })
          }
        } catch { /* skip failed ops; leave them in queue */ }
      }
      persistQueue([])
      setPendingOfflineCount(0)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user])

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadTransactions = async () => {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 6)
    cutoff.setHours(0, 0, 0, 0)
    const cutoffStr = toIsoDate(cutoff)
    historyCutoffRef.current = cutoffStr

    const [recent, olderCheck] = await Promise.all([
      apiRequest<{ content: unknown[]; totalElements: number }>(
        `/api/transactions?from=${cutoffStr}&size=200&sort=createdAt,desc`
      ),
      apiRequest<{ totalElements: number }>(
        `/api/transactions?to=${cutoffStr}&size=1&sort=createdAt,desc`
      ),
    ])

    if (recent.content) {
      setTransactions(recent.content.map(mapTransaction))
    }
    setHasMoreTransactions((olderCheck.totalElements ?? 0) > 0)
  }

  const loadMoreTransactions = async () => {
    const cutoff = historyCutoffRef.current
    if (!user || !hasMoreTransactions || isLoadingHistory || !cutoff) return
    setIsLoadingHistory(true)
    try {
      const data = await apiRequest<{ content: unknown[] }>(
        `/api/transactions?to=${cutoff}&size=1000&sort=createdAt,desc`
      )
      if (data.content && data.content.length > 0) {
        setTransactions(prev => {
          const ids = new Set(prev.map(t => t.id))
          return [...prev, ...data.content.map(mapTransaction).filter(t => !ids.has(t.id))]
        })
      }
      setHasMoreTransactions(false)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // ── Initial load (parallel with auth profile fetch) ──────────────────────────
  useEffect(() => {
    if (!getToken()) return
    loadTransactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset on sign-out ─────────────────────────────────────────────────────────
  useEffect(() => {
    return registerSignOutCleanup(() => {
      setTransactions([])
      setHasMoreTransactions(false)
      setIsLoadingHistory(false)
      historyCutoffRef.current = null
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Transaction actions ──────────────────────────────────────────────────────
  const addTransaction = (t: Omit<Transaction, "id">, onError?: (msg: string) => void, onCreated?: (id: string) => void) => {
    if (!user) return

    const tempId = `temp-${Date.now()}`
    setTransactions(prev => [{ ...t, id: tempId, createdAt: new Date().toISOString() }, ...prev])

    const body: Record<string, unknown> = {
      description: sanitizeField(t.description, 35) ?? "Transacción",
      amount: t.amount,
      type: t.type,
      icon: t.icon,
      category: t.category,
      date: toIsoDate(t.date),
      observation: sanitizeField(t.observation, 100),
      currency: t.currency,
      amountUsd: t.amountUsd ?? null,
      txRate: t.txRate ?? null,
      exchangeRateType: t.exchangeRateType ?? null,
      account: sanitizeField(t.account, 60) ?? "Efectivo",
      recurringFrequency: t.recurringFrequency ?? null,
      isRecurring: t.isRecurring ?? false,
    }

    if (!navigator.onLine) {
      const q = loadQueue()
      const next = [...q, { op: "add" as const, tempId, row: body }]
      persistQueue(next)
      setPendingOfflineCount(next.length)
      return
    }

    apiRequest<Record<string, unknown>>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then(data => {
        const mapped = mapTransaction(data)
        setTransactions(prev => prev.map(tx => tx.id === tempId ? mapped : tx))
        onCreated?.(mapped.id)
      })
      .catch(() => {
        setTransactions(prev => prev.filter(tx => tx.id !== tempId))
        onError?.("No se pudo guardar la transacción. Verificá tu conexión.")
      })
  }

  const patchTransactionReceiptUrl = (id: string, receiptUrl: string) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, receiptUrl } : tx))
  }

  const deleteTransaction = (id: string, onError?: (msg: string) => void) => {
    const backup = transactions.find(tx => tx.id === id)
    setTransactions(prev => prev.filter(tx => tx.id !== id))

    if (!navigator.onLine) {
      const q = loadQueue()
      const next = [...q, { op: "delete" as const, id }]
      persistQueue(next)
      setPendingOfflineCount(next.length)
      return
    }

    apiRequest<void>(`/api/transactions/${id}`, { method: "DELETE" })
      .catch(() => {
        if (backup) setTransactions(prev => [backup, ...prev])
        onError?.("No se pudo eliminar la transacción. Verificá tu conexión.")
      })
  }

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, "id">>, onError?: (msg: string) => void) => {
    const backup = transactions.find(tx => tx.id === id)
    if (!backup) return
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx))
    const merged = { ...backup, ...updates }

    const body: Record<string, unknown> = {
      description: sanitizeField(merged.description, 35) ?? "Transacción",
      amount: merged.amount,
      type: merged.type,
      icon: merged.icon,
      category: merged.category,
      date: toIsoDate(merged.date),
      observation: sanitizeField(merged.observation, 100),
      currency: merged.currency,
      exchangeRateType: merged.exchangeRateType ?? null,
      account: sanitizeField(merged.account, 60) ?? "Efectivo",
      recurringFrequency: merged.recurringFrequency ?? null,
      isRecurring: merged.isRecurring ?? false,
    }

    if (!navigator.onLine) {
      const q = loadQueue()
      const next = [...q, { op: "update" as const, id, row: body }]
      persistQueue(next)
      setPendingOfflineCount(next.length)
      return
    }

    apiRequest<void>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
      .catch(() => {
        setTransactions(prev => prev.map(tx => tx.id === id ? backup : tx))
        onError?.("No se pudo actualizar la transacción. Verificá tu conexión.")
      })
  }

  return (
    <TransactionsContext.Provider value={{
      transactions,
      addTransaction,
      patchTransactionReceiptUrl,
      deleteTransaction,
      updateTransaction,
      isProcessing,
      setIsProcessing,
      isOnline,
      pendingOfflineCount,
      isLoadingHistory,
      hasMoreTransactions,
      loadMoreTransactions,
    }}>
      {children}
    </TransactionsContext.Provider>
  )
}

export function useTransactions() {
  const ctx = useContext(TransactionsContext)
  if (!ctx) throw new Error("useTransactions must be used within TransactionsProvider")
  return ctx
}

"use client"

import { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from "react"
import { apiRequest, getToken, removeToken, TOKEN_KEY } from "@/lib/api-client"

export type View = "landing" | "auth" | "settings" | "dashboard" | "profile" | "analytics"
export type TimeFilter = "week" | "month" | "year" | "custom"
export type ExchangeRateMode = "api" | "manual"
export type ExchangeRateType = "BLUE" | "TARJETA" | "OFICIAL" | "MEP" | "MANUAL"
export type AIProvider = "claude" | "openai" | "gemini"
export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "annual"

export interface AuthUser {
  id: string
  email: string
}

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
function toIsoDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().split("T")[0]
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

interface ProfileResponse {
  userId: string
  email: string
  userName: string
  monthlyBudget?: number
  profileMode?: string
  exchangeRateMode?: string
  usdRate?: number
  aiProvider?: string
  apiKeyClaude?: string
  apiKeyOpenai?: string
  apiKeyGemini?: string
  defaultAccount?: string
}

interface AppState {
  // Auth
  user: AuthUser | null
  loadingAuth: boolean
  signOut: () => void
  isPasswordRecovery: boolean
  setIsPasswordRecovery: (v: boolean) => void
  // Navigation
  currentView: View
  setView: (view: View) => void
  navDirection: "forward" | "back"
  // Transactions
  transactions: Transaction[]
  addTransaction: (t: Omit<Transaction, "id">, onError?: (msg: string) => void, onCreated?: (id: string) => void) => void
  patchTransactionReceiptUrl: (id: string, receiptUrl: string) => void
  deleteTransaction: (id: string, onError?: (msg: string) => void) => void
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, "id">>, onError?: (msg: string) => void) => void
  // UI
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
  // Offline
  isOnline: boolean
  pendingOfflineCount: number
  // History loading
  isLoadingHistory: boolean
  hasMoreTransactions: boolean
  loadMoreTransactions: () => Promise<void>
  // AI Provider
  aiProvider: AIProvider
  setAiProvider: (p: AIProvider) => void
  apiKeyClaude: string
  setApiKeyClaude: (k: string) => void
  apiKeyOpenAI: string
  setApiKeyOpenAI: (k: string) => void
  apiKeyGemini: string
  setApiKeyGemini: (k: string) => void
  /** Always "backend-managed" — keeps existing apiKey.trim() guards passing */
  apiKey: string
  // Profile
  userName: string
  setUserName: (name: string) => void
  defaultAccount: string
  setDefaultAccount: (account: string) => void
  usdRate: number
  setUsdRate: (n: number) => void
  exchangeRateMode: ExchangeRateMode
  setExchangeRateMode: (mode: ExchangeRateMode) => void
  preferredExchangeRateType: ExchangeRateType
  setPreferredExchangeRateType: (type: ExchangeRateType) => void
  saveProfile: (overrides?: {
    userName?: string
    defaultAccount?: string
    usdRate?: number
    exchangeRateMode?: ExchangeRateMode
    aiProvider?: AIProvider
    apiKeyClaude?: string
    apiKeyOpenAI?: string
    apiKeyGemini?: string
  }) => Promise<void>
  // Filters
  timeFilter: TimeFilter
  setTimeFilter: (f: TimeFilter) => void
  customRange: { from: Date; to: Date }
  setCustomRange: (r: { from: Date; to: Date }) => void
}

const AppContext = createContext<AppState | null>(null)
const AUTHENTICATED_VIEWS: View[] = ["dashboard", "settings", "profile", "analytics"]

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [currentView, setCurrentView] = useState<View>("landing")
  const [navDirection, setNavDirection] = useState<"forward" | "back">("forward")

  const currentViewRef = useRef<View>("landing")
  const userRef = useRef<AuthUser | null>(null)
  useEffect(() => { userRef.current = user }, [user])

  const setView = (view: View, replace = false) => {
    currentViewRef.current = view
    setNavDirection("forward")
    setCurrentView(view)
    if (typeof window !== "undefined") {
      if (AUTHENTICATED_VIEWS.includes(view)) {
        sessionStorage.setItem("bb_view", view)
      } else {
        sessionStorage.removeItem("bb_view")
      }
      if (replace) {
        history.replaceState({ view }, "")
      } else {
        history.pushState({ view }, "")
      }
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    history.replaceState({ view: currentViewRef.current }, "")

    const handlePopState = (e: PopStateEvent) => {
      const target = (e.state as { view?: View } | null)?.view
      if (userRef.current && (!target || !AUTHENTICATED_VIEWS.includes(target))) {
        window.dispatchEvent(new CustomEvent("bb_exit_hint"))
        return
      }
      if (!target) return
      if (!userRef.current && AUTHENTICATED_VIEWS.includes(target)) return
      currentViewRef.current = target
      setNavDirection("back")
      setCurrentView(target)
      if (AUTHENTICATED_VIEWS.includes(target)) {
        sessionStorage.setItem("bb_view", target)
      } else {
        sessionStorage.removeItem("bb_view")
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const [isPasswordRecovery] = useState(false)
  const setIsPasswordRecovery = (_v: boolean) => { /* no-op: not supported by auth-service */ }

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() => loadQueue().length)

  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const historyCutoffRef = useRef<string | null>(null)

  const [aiProvider, setAiProvider] = useState<AIProvider>("claude")
  const [apiKeyClaude, setApiKeyClaude] = useState("")
  const [apiKeyOpenAI, setApiKeyOpenAI] = useState("")
  const [apiKeyGemini, setApiKeyGemini] = useState("")
  const apiKey = aiProvider === "openai" ? apiKeyOpenAI
               : aiProvider === "gemini" ? apiKeyGemini
               : apiKeyClaude

  const [userName, setUserName] = useState("Usuario")
  const [defaultAccount, setDefaultAccount] = useState("Efectivo")
  const [usdRate, setUsdRate] = useState(1350)
  const [exchangeRateMode, setExchangeRateMode] = useState<ExchangeRateMode>("api")
  const [preferredExchangeRateType, setPreferredExchangeRateTypeState] = useState<ExchangeRateType>(() => {
    if (typeof window === "undefined") return "OFICIAL"
    return (localStorage.getItem("bb_preferred_rate_type") as ExchangeRateType) ?? "OFICIAL"
  })
  const setPreferredExchangeRateType = (type: ExchangeRateType) => {
    setPreferredExchangeRateTypeState(type)
    if (typeof window !== "undefined") localStorage.setItem("bb_preferred_rate_type", type)
  }

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month")
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date()
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
  })

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
  const applyProfile = (profile: ProfileResponse, authUser: AuthUser) => {
    setUser(authUser)
    setUserName(profile.userName ?? "Usuario")
    setDefaultAccount(profile.defaultAccount ?? "Efectivo")
    setExchangeRateMode((profile.exchangeRateMode as ExchangeRateMode) ?? "api")
    setUsdRate(profile.usdRate ?? 1350)
    setAiProvider((profile.aiProvider as AIProvider) ?? "claude")
    setApiKeyClaude(profile.apiKeyClaude ?? "")
    setApiKeyOpenAI(profile.apiKeyOpenai ?? "")
    setApiKeyGemini(profile.apiKeyGemini ?? "")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadTransactions = async (userId: string) => {
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
    void userId // userId propagated via JWT / X-User-Id by gateway
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

  // ── Auth init on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoadingAuth(false)
      return
    }

    Promise.all([
      apiRequest<ProfileResponse>("/api/auth/profile"),
      loadTransactions(""),
    ])
      .then(([profile]) => {
        const authUser: AuthUser = { id: profile.userId, email: profile.email }
        applyProfile(profile, authUser)
        const saved = sessionStorage.getItem("bb_view") as View | null
        setView(saved && AUTHENTICATED_VIEWS.includes(saved) ? saved : "dashboard")
      })
      .catch(() => {
        removeToken()
      })
      .finally(() => setLoadingAuth(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────────
  const signOut = () => {
    sessionStorage.removeItem("bb_view")
    sessionStorage.removeItem("bb_chat_messages")
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setTransactions([])
    setUserName("Usuario")
    setApiKeyClaude("")
    setApiKeyOpenAI("")
    setApiKeyGemini("")
    setHasMoreTransactions(false)
    setIsLoadingHistory(false)
    historyCutoffRef.current = null
    setView("landing", true)
  }

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

  // ── Profile sync ─────────────────────────────────────────────────────────────
  const saveProfile = async (overrides?: {
    userName?: string
    defaultAccount?: string
    usdRate?: number
    exchangeRateMode?: ExchangeRateMode
    aiProvider?: AIProvider
    apiKeyClaude?: string
    apiKeyOpenAI?: string
    apiKeyGemini?: string
  }) => {
    if (!user) return
    await apiRequest("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        userName: overrides?.userName ?? userName,
        defaultAccount: overrides?.defaultAccount ?? defaultAccount,
        exchangeRateMode: overrides?.exchangeRateMode ?? exchangeRateMode,
        usdRate: overrides?.usdRate ?? usdRate,
        aiProvider: overrides?.aiProvider ?? aiProvider,
        apiKeyClaude: overrides?.apiKeyClaude ?? apiKeyClaude,
        apiKeyOpenai: overrides?.apiKeyOpenAI ?? apiKeyOpenAI,
        apiKeyGemini: overrides?.apiKeyGemini ?? apiKeyGemini,
      }),
    })
  }

  const contextValue = useMemo(() => ({
    user,
    loadingAuth,
    signOut,
    isPasswordRecovery,
    setIsPasswordRecovery,
    currentView,
    setView,
    navDirection,
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
    aiProvider,
    setAiProvider,
    apiKeyClaude,
    setApiKeyClaude,
    apiKeyOpenAI,
    setApiKeyOpenAI,
    apiKeyGemini,
    setApiKeyGemini,
    apiKey,
    userName,
    setUserName,
    defaultAccount,
    setDefaultAccount,
    usdRate,
    setUsdRate,
    exchangeRateMode,
    setExchangeRateMode,
    preferredExchangeRateType,
    setPreferredExchangeRateType,
    saveProfile,
    timeFilter,
    setTimeFilter,
    customRange,
    setCustomRange,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, loadingAuth, isPasswordRecovery, currentView, navDirection, transactions, isProcessing,
       isOnline, pendingOfflineCount, isLoadingHistory, hasMoreTransactions,
       aiProvider, apiKeyClaude, apiKeyOpenAI, apiKeyGemini, apiKey, userName,
       defaultAccount, usdRate, exchangeRateMode, preferredExchangeRateType, timeFilter, customRange])

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

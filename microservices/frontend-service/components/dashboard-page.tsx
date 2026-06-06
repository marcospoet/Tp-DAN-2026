"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageCircle, Settings, LogOut, Wallet, BarChart2, Loader2, WifiOff, RefreshCw, CheckCircle2, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useApp, type TimeFilter, type ExchangeRateType, type RecurringFrequency } from "@/lib/app-context"
import { callAI, transcribeAudioAttachment, type AIAttachment } from "@/lib/ai"
import { useExchangeRate } from "@/hooks/use-exchange-rate"
import { useChatHandler } from "@/hooks/use-chat-handler"
import type { DateRange } from "react-day-picker"

// Sub-components
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { SummaryCards } from "./dashboard/summary-cards"
import { CategoryChart } from "./dashboard/category-chart"
import { FilterBar } from "./dashboard/filter-bar"
import { TransactionList } from "./dashboard/transaction-list"
import { MagicBar } from "./dashboard/magic-bar"
import { ChatPanel } from "./dashboard/chat-panel"
import { EditDialog, type EditForm } from "./dashboard/edit-dialog"
import { CameraModal } from "./dashboard/camera-modal"
import { ImportCsvModal } from "./dashboard/import-csv-modal"
import { AccountsModal } from "./dashboard/accounts-modal"
import { toast } from "sonner"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Shared utilities
import {
  ONBOARDING_KEY,
  formatDateShort,
  formatCurrency,
  fileToBase64,
  compressImage,
  detectAccountFromText,
  type Attachment,
} from "./dashboard/shared"

const TX_PAGE = 6

// ── Retroactive date generator ────────────────────────────────────────────────
function addPeriod(date: Date, freq: RecurringFrequency): Date {
  const d = new Date(date)
  if (freq === "weekly")   { d.setDate(d.getDate() + 7); return d }
  if (freq === "biweekly") { d.setDate(d.getDate() + 14); return d }
  const origDay = date.getDate()
  d.setDate(1)
  if (freq === "monthly") d.setMonth(d.getMonth() + 1)
  else                    d.setFullYear(d.getFullYear() + 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(origDay, lastDay))
  return d
}

function generateRetroactiveDates(startDate: Date, freq: RecurringFrequency): Date[] {
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const dates: Date[] = []
  let cur = new Date(startDate)
  while (dates.length < 200) {
    cur = addPeriod(cur, freq)
    if (cur > todayEnd) break
    dates.push(new Date(cur))
  }
  return dates
}

export function DashboardPage() {
  const {
    user,
    transactions,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    setView,
    signOut,
    userName,
    defaultAccount,
    usdRate,
    apiKey,
    aiProvider,
    timeFilter,
    setTimeFilter,
    customRange,
    setCustomRange,
    isOnline,
    pendingOfflineCount,
    isLoadingHistory,
    hasMoreTransactions,
    loadMoreTransactions,
  } = useApp()

  // ── Magic Bar state ──────────────────────────────────────────────────────────
  const [magicInput, setMagicInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingLabel, setProcessingLabel] = useState("Analizando con IA...")
  const [observation, setObservation] = useState("")
  const [showObservation, setShowObservation] = useState(false)
  const [newCurrency, setNewCurrency] = useState<"ARS" | "USD">("ARS")
  const [newExRateType, setNewExRateType] = useState<ExchangeRateType>("OFICIAL")
  const [newManualRate, setNewManualRate] = useState("")
  const [newTxDate, setNewTxDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioHoldRef = useRef(false) // tracks if pointer is still held during getUserMedia
  const audioOptsRef = useRef<{ cancel?: boolean; autoSubmit?: boolean }>({})
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Chat panel open/closed ───────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false)

  // ── CSV import ───────────────────────────────────────────────────────────────
  const [showImportCSV, setShowImportCSV] = useState(false)

  // ── Type filter (Ingresos / Gastos cards) ────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<"income" | "expense" | null>(null)

  // ── Accounts modal ───────────────────────────────────────────────────────────
  const [showAccountsModal, setShowAccountsModal] = useState(false)

  // ── Live camera ──────────────────────────────────────────────────────────────
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Transaction UI state ─────────────────────────────────────────────────────
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<import("@/lib/app-context").Transaction | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    description: "",
    amount: "",
    type: "expense",
    category: "General",
    icon: "ShoppingCart",
    date: "",
    currency: "ARS",
    exRateType: "BLUE",
    manualRate: "",
    observation: "",
    isRecurring: false,
    recurringFrequency: "monthly",
  })
  const dragActiveRef = useRef(false)
  const lastMagicSubmitRef = useRef(0)
  const handleDeleteWithUndo = (tx: (typeof transactions)[number]) => {
    deleteTransaction(tx.id, (msg) => { setAiError(msg); setTimeout(() => setAiError(null), 5000) })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = tx
    toast("Movimiento eliminado", {
      description: tx.description,
      action: { label: "Deshacer", onClick: () => addTransaction(rest) },
      duration: 5000,
    })
  }

  // ── Manual entry (no-AI / offline fallback) ──────────────────────────────────
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [retroConfirm, setRetroConfirm] = useState<{
    template: Parameters<typeof addTransaction>[0]
    dates: Date[]
  } | null>(null)

  // ── Search / view state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [showCategoryChart, setShowCategoryChart] = useState(false)
  const [showAllTx, setShowAllTx] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // ── Onboarding ───────────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false
    return !localStorage.getItem(ONBOARDING_KEY)
  })
  const [showFirstTxTooltip, setShowFirstTxTooltip] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const prevTxCountRef = useRef(transactions.length)

  useEffect(() => {
    const prev = prevTxCountRef.current
    prevTxCountRef.current = transactions.length
    if (prev === 0 && transactions.length === 1 && !showOnboarding) {
      setShowFirstTxTooltip(false)
      setShowCelebration(true)
      localStorage.setItem("bb_first_tx_tip", "done")
      setTimeout(() => setShowCelebration(false), 2800)
    }
  }, [transactions.length, showOnboarding])

  // ── Filter / calendar ────────────────────────────────────────────────────────
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>({
    from: customRange.from,
    to: customRange.to,
  })

  // ── Live exchange rates ──────────────────────────────────────────────────────
  const { rates: liveRates, loading: ratesLoading } = useExchangeRate({ enabled: true })

  // ── Derived / computed ───────────────────────────────────────────────────────
  const suggestedPrompts = useMemo(() => {
    if (transactions.length === 0) {
      return ["¿Cómo registro un gasto?", "¿Qué puedo consultar?", "¿Cómo funciona el asistente?"]
    }
    const prompts = ["¿Cuánto gasté esta semana?", "¿Cómo está mi balance este mes?"]
    prompts.push(transactions.some(t => t.currency === "USD")
      ? "¿Cuánto gasté en dólares este mes?"
      : "¿En qué categoría gasto más?")
    return prompts
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    return transactions.filter((t) => {
      const txDate = new Date(t.date)
      if (txDate > todayEnd) return false  // future-dated transactions never affect current balance
      if (timeFilter === "week") {
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return txDate >= weekAgo
      }
      if (timeFilter === "month") {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      }
      if (timeFilter === "year") {
        return txDate.getFullYear() === now.getFullYear()
      }
      return txDate >= customRange.from && txDate <= customRange.to
    })
  }, [transactions, timeFilter, customRange])

  const toArs = (tx: { amount: number; currency: "ARS" | "USD"; txRate?: number }) =>
    tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount

  const totalExpenses = useMemo(
    () => filteredTransactions.filter((t) => t.type === "expense").reduce((a, b) => a + toArs(b), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTransactions, usdRate],
  )
  const totalIncome = useMemo(
    () => filteredTransactions.filter((t) => t.type === "income").reduce((a, b) => a + toArs(b), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTransactions, usdRate],
  )

  const balance = totalIncome - totalExpenses

  const prevPeriodExpenses = useMemo(() => {
    if (timeFilter === "custom") return null
    const now = new Date()
    let from: Date, to: Date
    if (timeFilter === "week") {
      from = new Date(now); from.setDate(now.getDate() - 14); from.setHours(0, 0, 0, 0)
      to = new Date(now); to.setDate(now.getDate() - 7); to.setHours(23, 59, 59, 999)
    } else if (timeFilter === "month") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to = new Date(now.getFullYear(), now.getMonth(), 0); to.setHours(23, 59, 59, 999)
    } else {
      from = new Date(now.getFullYear() - 1, 0, 1)
      to = new Date(now.getFullYear() - 1, 11, 31); to.setHours(23, 59, 59, 999)
    }
    return transactions
      .filter(tx => { const d = new Date(tx.date); return tx.type === "expense" && d >= from && d <= to })
      .reduce((a, tx) => a + toArs(tx), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, timeFilter, usdRate])

  const expensesChangePct = (prevPeriodExpenses !== null && prevPeriodExpenses > 0)
    ? ((totalExpenses - prevPeriodExpenses) / prevPeriodExpenses) * 100
    : null
  const periodLabel = timeFilter === "week" ? "vs sem. ant." : timeFilter === "month" ? "vs mes ant." : "vs año ant."

  const filterLabels: Record<TimeFilter, string> = useMemo(() => ({
    week: "Esta semana",
    month: "Este mes",
    year: "Este año",
    custom: `${formatDateShort(customRange.from)} — ${formatDateShort(customRange.to)}`,
  }), [customRange.from, customRange.to])

  const categoryFilteredTransactions = useMemo(() =>
    categoryFilter ? filteredTransactions.filter(tx => tx.category === categoryFilter) : filteredTransactions,
    [filteredTransactions, categoryFilter]
  )

  const futureTransactions = useMemo(() => {
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1)
    return transactions
      .filter(tx => new Date(tx.date) >= tomorrow)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [transactions])

  const displayedTransactions = useMemo(() => {
    let result = typeFilter ? categoryFilteredTransactions.filter(tx => tx.type === typeFilter) : categoryFilteredTransactions
    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase()
    return result.filter(tx =>
      tx.description.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q) ||
      (tx.observation?.toLowerCase().includes(q) ?? false),
    )
  }, [categoryFilteredTransactions, searchQuery, typeFilter])

  useEffect(() => { setShowAllTx(false) }, [filteredTransactions, searchQuery, typeFilter, categoryFilter])
  useEffect(() => { setTypeFilter(null); setCategoryFilter(null) }, [timeFilter, customRange])

  const visibleTransactions = showAllTx ? displayedTransactions : displayedTransactions.slice(0, TX_PAGE)
  const hasMoreTx = displayedTransactions.length > TX_PAGE

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTransactions
      .filter(t => t.type === "expense")
      .forEach(t => { map[t.category] = (map[t.category] || 0) + toArs(t) })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions, usdRate])

  const rateTypeOptions: Array<{
    key: ExchangeRateType
    label: string
    emoji: string
    value: number | null | undefined
  }> = [
      { key: "BLUE", label: "Blue", emoji: "💵", value: liveRates.blue?.venta },
      { key: "TARJETA", label: "Tarjeta", emoji: "💳", value: liveRates.tarjeta?.venta },
      { key: "OFICIAL", label: "Oficial", emoji: "🏦", value: liveRates.oficial?.venta },
      { key: "MEP", label: "MEP", emoji: "📈", value: liveRates.mep?.venta },
      { key: "MANUAL", label: "Manual", emoji: "✏️", value: null },
    ]

  const calendarPresets: { label: string; getRange: () => { from: Date; to: Date } }[] = [
    { label: "Hoy", getRange: () => { const d = new Date(); return { from: d, to: d } } },
    { label: "Ayer", getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { from: d, to: d } } },
    { label: "7 días", getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from, to } } },
    { label: "30 días", getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from, to } } },
    { label: "Este mes", getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: n } } },
    { label: "Mes ant.", getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 1, 1), to: new Date(n.getFullYear(), n.getMonth(), 0) } } },
  ]

  const initials = userName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U"
  const avatarUrl: string | null = null

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  // Load full history when user switches to year or custom filter
  useEffect(() => {
    if ((timeFilter === "year" || timeFilter === "custom") && hasMoreTransactions) {
      loadMoreTransactions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter])

  // ── Magic Bar handlers ───────────────────────────────────────────────────────
  const getAppliedRate = (): number => {
    if (newCurrency === "ARS") return 1
    if (newExRateType === "MANUAL") return parseFloat(newManualRate) || usdRate
    const live = liveRates[newExRateType.toLowerCase() as keyof typeof liveRates]
    return (live as { venta?: number } | null)?.venta ?? usdRate
  }

  // ── Manual entry helpers ─────────────────────────────────────────────────────
  const openManualEntry = (prefillDesc = "") => {
    setEditForm({
      description: prefillDesc,
      amount: "",
      type: "expense",
      category: "General",
      icon: "ShoppingCart",
      date: new Date().toISOString().split("T")[0],
      currency: newCurrency,
      exRateType: newExRateType,
      manualRate: newManualRate,
      observation: "",
      isRecurring: false,
      recurringFrequency: "monthly",
      account: defaultAccount,
    })
    setShowManualEntry(true)
  }

  const handleSaveNew = () => {
    const amount = parseFloat(editForm.amount)
    if (!amount || amount <= 0) return
    const startDate = editForm.date ? new Date(editForm.date + "T12:00:00") : new Date()
    const template: Parameters<typeof addTransaction>[0] = {
      description: editForm.description.trim() || "Transacción",
      amount,
      type: editForm.type,
      icon: editForm.icon,
      category: editForm.category,
      date: startDate,
      currency: editForm.currency,
      amountUsd: editForm.currency === "USD" ? amount : undefined,
      txRate: editForm.currency === "USD" ? getEditRate() : undefined,
      exchangeRateType: editForm.currency === "USD" ? editForm.exRateType : null,
      observation: editForm.observation.trim() || undefined,
      isRecurring: editForm.isRecurring,
      recurringFrequency: editForm.recurringFrequency,
      account: editForm.account || defaultAccount,
    }
    addTransaction(template, (msg) => {
      setAiError(msg)
      setTimeout(() => setAiError(null), 5000)
    })
    setShowManualEntry(false)

    // Offer retroactive generation if recurring + past start date
    if (editForm.isRecurring) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (startDate < today) {
        const dates = generateRetroactiveDates(startDate, editForm.recurringFrequency)
        if (dates.length > 0) setRetroConfirm({ template, dates })
      }
    }
  }

  const handleMagicSubmit = async (e?: React.FormEvent, directAttachments?: Attachment[]) => {
    if (e) e.preventDefault();
    const activeAttachments = directAttachments ?? attachments;
    if ((!magicInput.trim() && activeAttachments.length === 0) || isProcessing) return

    // If offline, open manual entry form pre-filled with the typed text
    if (!isOnline) {
      openManualEntry(magicInput.trim())
      setMagicInput("")
      setAttachments([])
      return
    }

    const now = Date.now()
    if (now - lastMagicSubmitRef.current < 2000) return   // 2-second throttle
    lastMagicSubmitRef.current = now

    const capturedAttachments = [...(directAttachments ?? attachments)]
    setProcessingLabel(capturedAttachments.some(a => a.type === "audio") ? "Procesando audio..." : "Analizando con IA...")
    setIsProcessing(true)
    setAiError(null)

    const textInput = magicInput.trim()
    const obs = observation.trim() || undefined
    const curr = newCurrency
    const appliedRate = getAppliedRate()
    const rateType = curr === "USD" ? newExRateType : null
    const userPickedDate = newTxDate        // null = user didn't explicitly pick a date
    const txDate = userPickedDate ?? new Date()

    setMagicInput("")
    setAttachments([])
    setObservation("")
    setShowObservation(false)
    setNewTxDate(null)

    try {
      const aiAttachments: AIAttachment[] = await Promise.all(
        capturedAttachments.map(async (a) => ({
          type: a.type,
          base64: await fileToBase64(a.file),
          mimeType: a.file.type || (a.type === "audio" ? "audio/webm" : a.type === "file" ? "application/octet-stream" : "image/jpeg"),
          file: a.file,
        })),
      )

      // Transcribe audio first — pass the text to the normal parse pipeline.
      // Audio in the magic bar should never open the chatbot.
      const audioAtt = aiAttachments.find(a => a.type === "audio")
      let finalTextInput = textInput
      if (audioAtt) {
        setProcessingLabel("Transcribiendo audio...")
        const transcription = await transcribeAudioAttachment(aiProvider, apiKey, audioAtt)
        if (!transcription) {
          setAiError("No se pudo transcribir el audio. Verificá tu API key de OpenAI en Ajustes.")
          setTimeout(() => setAiError(null), 5000)
          return
        }
        finalTextInput = transcription
        setProcessingLabel("Analizando con IA...")
      }

      const nonAudioAttachments = aiAttachments.filter(a => a.type !== "audio")

      const aiResult = await Promise.race([
        callAI(aiProvider, apiKey, finalTextInput, nonAudioAttachments.length > 0 ? nonAudioAttachments : undefined),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("La IA tardó demasiado. Revisá tu conexión e intentá de nuevo.")), 30_000)
        ),
      ])
      const results = Array.isArray(aiResult) ? aiResult : [aiResult]
      const valid = results.filter(r => r.type !== "unknown")

      if (valid.length === 0) {
        if (audioAtt) {
          // Audio was transcribed but AI couldn't detect a transaction
          setAiError("No reconocí una transacción en el audio. Intentá ser más específico.")
          setTimeout(() => setAiError(null), 5000)
          return
        }
        if (!finalTextInput.trim()) {
          // Only image/file — AI couldn't extract a transaction
          setAiError("No reconocí una transacción en la imagen. Describí el gasto con palabras.")
          setTimeout(() => setAiError(null), 5000)
          return
        }
        // Text that AI couldn't parse as transaction — redirect to chat for clarification
        setChatOpen(true)
        setTimeout(() => { submitChatMessage(finalTextInput, undefined, true) }, 100)
        return
      }

      // Receipt upload deferred to Phase E (MinIO migration)
      const receiptUrl: string | undefined = undefined

      let usdAutoDetected = false
      for (const result of valid) {
        // Date: user-picked date wins; otherwise use AI's daysAgo offset
        let txDateForResult = txDate
        if (!userPickedDate && typeof result.daysAgo === "number" && result.daysAgo > 0) {
          const d = new Date()
          d.setDate(d.getDate() - result.daysAgo)
          d.setHours(12, 0, 0, 0) // noon to avoid timezone edge cases
          txDateForResult = d
        }

        // Currency: user-set wins; otherwise use AI's detected currency
        let currForResult = curr
        let rateForResult = appliedRate
        let rateTypeForResult = rateType
        if (curr === "ARS" && result.suggestedCurrency === "USD") {
          currForResult = "USD"
          // Priority: AI-detected rate type > user's selected rate type (default OFICIAL)
          const resolvedRateType = result.suggestedExRateType ?? newExRateType
          const liveKey = resolvedRateType.toLowerCase() as keyof typeof liveRates
          rateForResult = (liveRates[liveKey] as { venta?: number } | null)?.venta ?? usdRate
          rateTypeForResult = resolvedRateType as ExchangeRateType
          if (!usdAutoDetected) {
            const rateLabels: Record<string, string> = { BLUE: "Blue", OFICIAL: "Oficial", TARJETA: "Tarjeta", MEP: "MEP" }
            toast("💵 Moneda detectada: USD", {
              description: `Tasa ${rateLabels[resolvedRateType] ?? resolvedRateType} aplicada · $${rateForResult.toLocaleString("es-AR")}`,
            })
            usdAutoDetected = true
          }
        }

        // Account: AI-detected > keyword match > default
        const detectedAccount =
          result.account ||
          detectAccountFromText(finalTextInput) ||
          defaultAccount

        addTransaction({
          description: result.description,
          amount: result.amount,
          type: result.type as "expense" | "income",
          icon: result.icon,
          category: result.category,
          date: txDateForResult,
          currency: currForResult,
          amountUsd: currForResult === "USD" ? result.amount : undefined,
          txRate: currForResult === "USD" ? rateForResult : undefined,
          exchangeRateType: rateTypeForResult,
          observation: obs ?? result.observation,
          isRecurring: result.suggestRecurring === true,
          receiptUrl: valid.length === 1 ? receiptUrl : undefined,
          account: detectedAccount,
        }, (msg) => {
          setAiError(msg)
          setTimeout(() => setAiError(null), 6000)
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar."
      setAiError(msg)
      setTimeout(() => setAiError(null), 6000)
    } finally {
      setIsProcessing(false)
    }
  }

  const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8 MB
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]
  const ALLOWED_FILE_TYPES = ["application/pdf", "text/plain", "text/csv", "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip"]

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const next: Attachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) {
        setAiError(`"${file.name}" supera el límite de 8 MB.`); setTimeout(() => setAiError(null), 4000); continue
      }
      // Accept image/* broadly (covers HEIC from iOS) but reject known non-image types
      if (!file.type.startsWith("image/") && !ALLOWED_IMAGE_TYPES.includes(file.type)) continue
      next.push({ type: "image", name: file.name, url: URL.createObjectURL(file), file })
    }
    setAttachments((prev) => [...prev, ...next])
    e.target.value = ""
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const next: Attachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) {
        setAiError(`"${file.name}" supera el límite de 8 MB.`); setTimeout(() => setAiError(null), 4000); continue
      }
      if (file.type.startsWith("image/")) {
        next.push({ type: "image", name: file.name, url: URL.createObjectURL(file), file })
      } else if (ALLOWED_FILE_TYPES.includes(file.type)) {
        next.push({ type: "file", name: file.name, url: URL.createObjectURL(file), file })
      }
      // silently skip unknown types — the input[accept] already filters the picker
    }
    setAttachments((prev) => [...prev, ...next])
    e.target.value = ""
  }

  const startRecording = async () => {
    audioHoldRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // User released before permission resolved — abort cleanly
      if (!audioHoldRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      setAudioStream(stream)
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        // Read flags synchronously before clearing — React may defer updater calls,
        // so checking opts inside setAttachments() updater is a race condition.
        const shouldAutoSubmit = !!audioOptsRef.current.autoSubmit
        const wasCancelled = !!audioOptsRef.current.cancel
        audioOptsRef.current = {}

        if (wasCancelled) return

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        if (blob.size < 500) return  // too short / empty recording, discard silently
        if (blob.size > 10 * 1024 * 1024) {  // 10 MB max
          setAiError("El audio es demasiado largo. Grabá un mensaje más corto.")
          setTimeout(() => setAiError(null), 4000)
          return
        }

        const file = new File([blob], `voz-${Date.now()}.webm`, { type: "audio/webm" })
        const newAtt: Attachment = { type: "audio", name: file.name, url: URL.createObjectURL(blob), file }

        if (shouldAutoSubmit) {
          // Send directly — skip adding to attachments state to avoid the visual flash
          handleMagicSubmit(undefined, [newAtt])
        } else {
          setAttachments((prev) => [...prev, newAtt])
        }
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      audioHoldRef.current = false
      setAiError("No se pudo acceder al micrófono. Habilitá el permiso en tu navegador.")
      setTimeout(() => setAiError(null), 5000)
    }
  }

  const stopRecording = (opts?: { cancel?: boolean; autoSubmit?: boolean }) => {
    audioHoldRef.current = false
    audioOptsRef.current = opts || {}
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    setAudioStream(null)
  }

  const removeAttachment = (i: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[i].url)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      })
      streamRef.current = stream
      setShowCamera(true)
    } catch {
      cameraInputRef.current?.click()
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `ticket-${Date.now()}.jpg`, { type: "image/jpeg" })
        setAttachments((prev) => [
          ...prev,
          { type: "image", name: file.name, url: URL.createObjectURL(blob), file },
        ])
        stopCamera()
      },
      "image/jpeg",
      0.9,
    )
  }

  // ── Chat handler hook ─────────────────────────────────────────────────────────
  const {
    chatMessages,
    chatInput,
    setChatInput,
    isChatProcessing,
    chatStatusText,
    lastModifiedTxId,
    isChatRecording,
    chatAudioStream,
    chatEndRef,
    handleChatSubmit,
    submitChatMessage,
    resetChat,
    startChatRecording,
    stopChatRecording,
  } = useChatHandler({
    transactions,
    deleteTransaction,
    updateTransaction,
    addTransaction,
    apiKey,
    aiProvider,
    usdRate,
    defaultAccount,
    liveRates,
    newExRateType,
    formatCurrency,
    chatOpen,
  })

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const openEdit = (tx: import("@/lib/app-context").Transaction) => {
    setEditingTx(tx)
    setEditForm({
      description: tx.description,
      amount: String(tx.amount),
      type: tx.type,
      category: tx.category,
      icon: tx.icon,
      date: new Date(tx.date).toISOString().split("T")[0],
      currency: tx.currency,
      exRateType: (tx.exchangeRateType as ExchangeRateType) ?? "BLUE",
      manualRate: tx.txRate ? String(tx.txRate) : "",
      observation: tx.observation ?? "",
      isRecurring: tx.isRecurring ?? false,
      recurringFrequency: tx.recurringFrequency ?? "monthly",
      account: tx.account,
    })
  }

  const getEditRate = (): number => {
    if (editForm.exRateType === "MANUAL") return parseFloat(editForm.manualRate) || usdRate
    const live = liveRates[editForm.exRateType.toLowerCase() as keyof typeof liveRates]
    return (live as { venta?: number } | null)?.venta ?? usdRate
  }

  const handleSaveEdit = () => {
    if (!editingTx) return
    const amount = parseFloat(editForm.amount)
    if (!amount || amount <= 0) return
    updateTransaction(editingTx.id, {
      description: editForm.description.trim() || "Transacción",
      amount,
      type: editForm.type,
      icon: editForm.icon,
      category: editForm.category,
      date: new Date(editForm.date + "T12:00:00"),
      currency: editForm.currency,
      amountUsd: editForm.currency === "USD" ? amount : undefined,
      txRate: editForm.currency === "USD" ? getEditRate() : undefined,
      exchangeRateType: editForm.currency === "USD" ? editForm.exRateType : null,
      observation: editForm.observation.trim() || undefined,
      isRecurring: editForm.isRecurring,
      recurringFrequency: editForm.recurringFrequency,
      account: editForm.account || undefined,
    }, (msg) => {
      setAiError(msg)
      setTimeout(() => setAiError(null), 5000)
    })
    setEditingTx(null)
  }

  // ── Calendar / filter helpers ────────────────────────────────────────────────
  const applyRange = (from: Date, to: Date) => {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    setCustomRange({ from, to: end })
    setCalendarRange({ from, to: end })
    setTimeFilter("custom")
    setShowCalendar(false)
  }

  const handleApplyCustomRange = () => {
    if (!calendarRange?.from) return
    const to = calendarRange.to ?? calendarRange.from
    applyRange(calendarRange.from, to)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">

        {/* ── Sticky header ────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="flex items-center justify-between px-4 pb-3 sm:px-6" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}>
            {/* Left: logo + balance (balance visible on sm+) */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
              <button
                type="button"
                onClick={() => setShowAccountsModal(true)}
                className="hidden sm:flex flex-col leading-none min-w-0 cursor-pointer hover:opacity-80 transition-opacity text-left"
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {"Balance"} · {filterLabels[timeFilter]}
                </span>
                <div className="flex items-baseline gap-2">
                  <motion.span
                    className={`text-lg font-bold tabular-nums truncate ${balance >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    key={balance}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {balance < 0 ? "-" : ""}
                    {formatCurrency(balance)}
                  </motion.span>
                  {expensesChangePct !== null && (
                    <span className={`text-[10px] font-medium tabular-nums shrink-0 ${expensesChangePct > 5 ? "text-destructive" :
                      expensesChangePct < -5 ? "text-primary" :
                        "text-muted-foreground"
                      }`}>
                      {expensesChangePct > 0 ? "+" : ""}{expensesChangePct.toFixed(0)}% {periodLabel}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Offline / syncing pill */}
            {(!isOnline || pendingOfflineCount > 0) && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${!isOnline
                ? "bg-amber-500/15 text-amber-500"
                : "bg-primary/10 text-primary"
                }`}>
                {!isOnline
                  ? <><WifiOff className="w-3 h-3" />{pendingOfflineCount > 0 ? `${pendingOfflineCount} en cola` : "Sin conexión"}</>
                  : <><RefreshCw className="w-3 h-3 animate-spin" />Sincronizando...</>
                }
              </div>
            )}

            {/* Right: actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setChatOpen(!chatOpen)}
                aria-label="Chat"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setView("analytics")}
                aria-label="Analítica"
              >
                <BarChart2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setView("settings")}
                aria-label="Configuracion"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={signOut}
                aria-label="Salir"
              >
                <LogOut className="w-5 h-5" />
              </Button>
              <button
                className="cursor-pointer ml-1"
                onClick={() => setView("profile")}
                aria-label="Perfil"
              >
                <Avatar className="w-8 h-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>

          {/* Mobile-only: prominent centered balance */}
          <div className="sm:hidden px-4 pb-3 flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {"Balance"} · {filterLabels[timeFilter]}
            </span>
            <button
              type="button"
              onClick={() => setShowAccountsModal(true)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <motion.span
                key={balance}
                className={`text-3xl font-bold tabular-nums block ${balance >= 0 ? "text-primary" : "text-destructive"}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {balance < 0 ? "-" : ""}{formatCurrency(balance)}
              </motion.span>
            </button>
            {expensesChangePct !== null && (
              <span className={`text-xs font-medium tabular-nums mt-0.5 ${expensesChangePct > 5 ? "text-destructive" :
                expensesChangePct < -5 ? "text-primary" :
                  "text-muted-foreground"
                }`}>
                {expensesChangePct > 0 ? "+" : ""}{expensesChangePct.toFixed(0)}% gastos {periodLabel}
              </span>
            )}
          </div>
        </header>

        {/* ── Scrollable content ──────────────────────────────── */}
        <div className={`flex-1 flex flex-col lg:flex-row transition-[padding] duration-300 ease-out ${chatOpen ? "lg:pr-80 xl:pr-96" : ""}`}>
          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 pb-56 lg:pb-52 max-w-3xl mx-auto w-full">

            {/* Greeting */}
            <motion.div
              className="mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-base font-semibold text-foreground">Hola, {userName}</h1>
              <p className="text-xs text-muted-foreground">Registra con texto, foto o audio</p>
            </motion.div>

            <FilterBar
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              filterLabels={filterLabels}
              showCalendar={showCalendar}
              setShowCalendar={setShowCalendar}
              calendarRange={calendarRange}
              setCalendarRange={setCalendarRange}
              calendarPresets={calendarPresets}
              applyRange={applyRange}
              handleApplyCustomRange={handleApplyCustomRange}
            />

            <SummaryCards
              totalExpenses={totalExpenses}
              totalIncome={totalIncome}
              balance={balance}
              formatCurrency={formatCurrency}
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
            />

            <CategoryChart
              categoryBreakdown={categoryBreakdown}
              showCategoryChart={showCategoryChart}
              setShowCategoryChart={setShowCategoryChart}
              formatCurrency={formatCurrency}
              selectedCategory={categoryFilter}
              onCategoryClick={(cat) => setCategoryFilter(c => c === cat ? null : cat)}
            />

            <TransactionList
              filteredTransactions={categoryFilteredTransactions}
              displayedTransactions={displayedTransactions}
              activeCategoryFilter={categoryFilter}
              onClearCategoryFilter={() => setCategoryFilter(null)}
              visibleTransactions={visibleTransactions}
              hasMoreTx={hasMoreTx}
              showAllTx={showAllTx}
              setShowAllTx={setShowAllTx}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              expandedTx={expandedTx}
              setExpandedTx={setExpandedTx}
              dragActiveRef={dragActiveRef}
              usdRate={usdRate}
              openEdit={openEdit}
              onDelete={handleDeleteWithUndo}
              lastModifiedTxId={lastModifiedTxId}
              timeFilter={timeFilter}
              totalTransactions={transactions.length}
              onCategoryChange={(tx, category, icon) => updateTransaction(tx.id, { category, icon })}
              onImportCSV={() => setShowImportCSV(true)}
              isLoadingHistory={isLoadingHistory}
              hasMoreTransactions={hasMoreTransactions}
              onLoadMoreHistory={loadMoreTransactions}
              futureTransactions={futureTransactions}
            />
          </main>

          <ChatPanel
            chatOpen={chatOpen}
            setChatOpen={setChatOpen}
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            isChatProcessing={isChatProcessing}
            chatStatusText={chatStatusText}
            suggestedPrompts={suggestedPrompts}
            isChatRecording={isChatRecording}
            chatAudioStream={chatAudioStream}
            chatEndRef={chatEndRef}
            handleChatSubmit={handleChatSubmit}
            onQuickPrompt={submitChatMessage}
            onResetChat={resetChat}
            startChatRecording={startChatRecording}
            stopChatRecording={stopChatRecording}
          />
        </div>

        <MagicBar
          chatOpen={chatOpen}
          magicInput={magicInput}
          setMagicInput={setMagicInput}
          isProcessing={isProcessing}
          processingLabel={processingLabel}
          attachments={attachments}
          removeAttachment={removeAttachment}
          newCurrency={newCurrency}
          setNewCurrency={setNewCurrency}
          newExRateType={newExRateType}
          setNewExRateType={setNewExRateType}
          newManualRate={newManualRate}
          setNewManualRate={setNewManualRate}
          observation={observation}
          setObservation={setObservation}
          showObservation={showObservation}
          setShowObservation={setShowObservation}
          newTxDate={newTxDate}
          setNewTxDate={setNewTxDate}
          showDatePicker={showDatePicker}
          setShowDatePicker={setShowDatePicker}
          rateTypeOptions={rateTypeOptions}
          ratesLoading={ratesLoading}
          usdRate={usdRate}
          handleMagicSubmit={handleMagicSubmit}
          galleryInputRef={galleryInputRef}
          cameraInputRef={cameraInputRef}
          fileInputRef={fileInputRef}
          handleImageSelect={handleImageSelect}
          handleFileSelect={handleFileSelect}
          startCamera={startCamera}
          isRecording={isRecording}
          audioStream={audioStream}
          startRecording={startRecording}
          stopRecording={stopRecording}
          aiError={aiError}
          onManualEntry={() => openManualEntry()}
        />


        {/* CSV Import */}
        <ImportCsvModal open={showImportCSV} onClose={() => setShowImportCSV(false)} />

        {/* Accounts distribution */}
        <AccountsModal
          open={showAccountsModal}
          onClose={() => setShowAccountsModal(false)}
          transactions={filteredTransactions}
          usdRate={usdRate}
        />

        {/* Edit existing transaction */}
        <EditDialog
          open={!!editingTx}
          onClose={() => setEditingTx(null)}
          title="Editar movimiento"
          subtitle={editingTx?.description}
          saveLabel="Guardar cambios"
          editForm={editForm}
          setEditForm={setEditForm}
          rateTypeOptions={rateTypeOptions}
          ratesLoading={ratesLoading}
          usdRate={usdRate}
          onSave={handleSaveEdit}
          getEditRate={getEditRate}
        />

        {/* Manual new transaction (no-AI / offline) */}
        <EditDialog
          open={showManualEntry}
          onClose={() => setShowManualEntry(false)}
          title="Nuevo movimiento"
          saveLabel="Agregar"
          editForm={editForm}
          setEditForm={setEditForm}
          rateTypeOptions={rateTypeOptions}
          ratesLoading={ratesLoading}
          usdRate={usdRate}
          onSave={handleSaveNew}
          getEditRate={getEditRate}
        />

        <CameraModal
          showCamera={showCamera}
          videoRef={videoRef}
          canvasRef={canvasRef}
          streamRef={streamRef}
          stopCamera={stopCamera}
          capturePhoto={capturePhoto}
        />
      </div>

      {/* ── Onboarding overlay ──────────────────────────────── */}
      {/* ── First-tx tooltip ────────────────────────────────── */}
      <AnimatePresence>
        {showFirstTxTooltip && (
          <motion.div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-card border border-primary/40 rounded-2xl px-4 py-3.5 shadow-xl w-[calc(100%-2rem)] max-w-xs text-center"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
          >
            <p className="text-sm font-semibold text-foreground">Registrá tu primer gasto</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ej: <span className="font-medium text-foreground">"Almuerzo $1500"</span> o <span className="font-medium text-foreground">"Nafta 10 dólares"</span>
            </p>
            <motion.div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-card border-r border-b border-primary/40"
            />
            <button
              type="button"
              onClick={() => { setShowFirstTxTooltip(false); localStorage.setItem("bb_first_tx_tip", "done") }}
              className="absolute top-2 right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer text-xs"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── First-tx celebration ─────────────────────────────── */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="flex flex-col items-center gap-3 bg-card border border-primary/30 rounded-2xl px-8 py-7 shadow-2xl"
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: "spring", damping: 18, stiffness: 240 }}
            >
              <motion.div
                className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10"
                animate={{ scale: [1, 1.18, 1, 1.08, 1] }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </motion.div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">¡Primer movimiento registrado!</p>
                <p className="text-sm text-muted-foreground mt-1">Ya estás controlando tus finanzas</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Onboarding wizard ────────────────────────────────── */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard onDone={() => {
            setShowOnboarding(false)
            if (transactions.length === 0) {
              setShowFirstTxTooltip(true)
            }
          }} />
        )}
      </AnimatePresence>

      {/* ── Retroactive recurring confirmation ───────────────── */}
      <AlertDialog open={!!retroConfirm} onOpenChange={open => { if (!open) setRetroConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar instancias pasadas</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Se encontraron <span className="font-semibold text-foreground">{retroConfirm?.dates.length}</span> instancias
                  pasadas de <span className="font-semibold text-foreground">&ldquo;{retroConfirm?.template.description}&rdquo;</span>{" "}
                  desde el{" "}
                  <span className="font-semibold text-foreground">
                    {retroConfirm?.dates[0]?.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                  </span>{" "}
                  hasta hoy.
                </p>
                {retroConfirm && retroConfirm.dates.length <= 12 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto">
                    {retroConfirm.dates.map((d, i) => (
                      <li key={i}>· {d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">¿Deseás generarlas ahora?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRetroConfirm(null)}>Omitir</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!retroConfirm) return
                const { template, dates } = retroConfirm
                for (const d of dates) {
                  addTransaction({ ...template, date: d }, (msg) => {
                    setAiError(msg)
                    setTimeout(() => setAiError(null), 5000)
                  })
                }
                toast.success(`${dates.length} transacción${dates.length !== 1 ? "es" : ""} generada${dates.length !== 1 ? "s" : ""}`, {
                  description: `Instancias pasadas de "${template.description}"`,
                })
                setRetroConfirm(null)
              }}
            >
              Generar {retroConfirm?.dates.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

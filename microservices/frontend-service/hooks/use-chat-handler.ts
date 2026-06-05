"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import type { Transaction, AIProvider, ExchangeRateType } from "@/lib/app-context"
import {
  callAI, callAIChat, callAIUpdateDetect, callAIDeleteDetect, callAIRecurringDetect,
  transcribeAudioAttachment, sanitizeUserInput, type ChatTurn, type AIAttachment,
} from "@/lib/ai"
import type { ExchangeRates } from "@/hooks/use-exchange-rate"
import { fileToBase64, detectAccountFromText } from "@/components/dashboard/shared"
import type { ChatMessage } from "@/components/dashboard/shared"

// Generic words that indicate transaction type rather than a description keyword
const TX_TYPE_WORDS: Record<string, "income" | "expense"> = {
  ingreso: "income", ingresos: "income", cobro: "income", cobros: "income", entrada: "income",
  gasto: "expense", gastos: "expense", pago: "expense", pagos: "expense", compra: "expense", egresos: "expense",
}

/** Fuzzy-find a transaction by approximate description, optional days-ago, and optional type */
export function findTransactionByMatch(
  txs: Transaction[],
  match: { description: string; daysAgo?: number; txType?: "income" | "expense" }
): Transaction | null {
  let candidates = [...txs]
  if (match.daysAgo !== undefined) {
    const target = new Date()
    target.setDate(target.getDate() - match.daysAgo)
    const targetDay = target.toDateString()
    candidates = candidates.filter(t => new Date(t.date).toDateString() === targetDay)
  }
  // If txType provided, pre-filter by type
  const typeFilter = match.txType ?? TX_TYPE_WORDS[match.description.toLowerCase()]
  if (typeFilter) candidates = candidates.filter(t => t.type === typeFilter)

  const terms = match.description.toLowerCase().split(/\s+/).filter(Boolean)
  // Skip terms that are generic type words — they don't help description matching
  const descTerms = terms.filter(t => !TX_TYPE_WORDS[t])

  if (descTerms.length > 0) {
    const scored = candidates
      .map(t => ({ t, score: descTerms.filter(term => t.description.toLowerCase().includes(term)).length }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.t.date).getTime() - new Date(a.t.date).getTime())
    if (scored.length > 0) return scored[0].t
  }

  // Fallback: if type filtering narrowed candidates, return the most recent one
  if (typeFilter && candidates.length > 0) {
    return candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
  }
  return null
}

interface ChatHandlerParams {
  transactions: Transaction[]
  deleteTransaction: (id: string, onError?: (msg: string) => void) => void
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, "id">>, onError?: (msg: string) => void) => void
  addTransaction: (t: Omit<Transaction, "id">, onError?: (msg: string) => void) => void
  apiKey: string
  aiProvider: AIProvider
  usdRate: number
  defaultAccount: string
  liveRates: ExchangeRates
  newExRateType: ExchangeRateType
  formatCurrency: (n: number) => string
  chatOpen: boolean
}

const INITIAL_BOT_MESSAGE: ChatMessage = {
  role: "bot",
  text: "¡Hola! Soy BudgetBuddy AI 🤖\n\n📝 Registrar  →  \"gasté 3500 en almuerzo\" · \"cobré 200 USD\"\n🔍 Consultar  →  \"¿cuánto gasté esta semana?\" · \"¿me alcanza el presupuesto?\"\n✏️ Modificar  →  \"al taxi de ayer, cambiá el monto a 2800\"\n🗑️ Eliminar   →  \"borrá el super de ayer\"\n🔁 Recurrente →  \"marcá el alquiler como recurrente\"\n📊 Analizar   →  \"¿en qué categoría gasto más?\"\n\n¿En qué te ayudo?",
}

// #7 — Rolling compression constants
const CHAT_HISTORY_MAX = 10
const CHAT_KEEP_RECENT = 6

export function useChatHandler({
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
}: ChatHandlerParams) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [INITIAL_BOT_MESSAGE]
    try {
      const saved = sessionStorage.getItem("bb_chat_messages")
      const parsed = saved ? JSON.parse(saved) : null
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
    return [INITIAL_BOT_MESSAGE]
  })
  const [chatInput, setChatInput] = useState("")
  const [isChatProcessing, setIsChatProcessing] = useState(false)
  const [chatStatusText, setChatStatusText] = useState<string | null>(null)
  const [lastModifiedTxId, setLastModifiedTxId] = useState<string | null>(null)
  const [isChatRecording, setIsChatRecording] = useState(false)
  const [chatAudioStream, setChatAudioStream] = useState<MediaStream | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chatAudioChunksRef = useRef<Blob[]>([])
  const chatAudioHoldRef = useRef(false)
  const chatAudioOptsRef = useRef<{ cancel?: boolean }>({})
  // Refs so onstop always reads fresh values regardless of closure staleness
  const chatMessagesRef = useRef(chatMessages)
  const dispatchChatRef = useRef<((label: string, prev: ChatMessage[], att?: AIAttachment) => Promise<void>) | null>(null)
  const processMessageRef = useRef<((msg: string) => Promise<void>) | null>(null)
  // Tracks the last transaction registered from the chat (for follow-up corrections)
  const chatLastRegisteredRef = useRef<{ description: string; amount: number; type: "expense" | "income"; currency: "ARS" | "USD" } | null>(null)

  // Always-fresh refs for async handlers — avoids stale closures after React re-renders mid-await
  const transactionsRef = useRef(transactions)
  const updateTransactionRef = useRef(updateTransaction)
  const deleteTransactionRef = useRef(deleteTransaction)
  const addTransactionRef = useRef(addTransaction)
  transactionsRef.current = transactions
  updateTransactionRef.current = updateTransaction
  deleteTransactionRef.current = deleteTransaction
  addTransactionRef.current = addTransaction

  // Keep refs in sync so onstop callbacks always read fresh values
  useEffect(() => { chatMessagesRef.current = chatMessages }, [chatMessages])

  // Persist chat history to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem("bb_chat_messages", JSON.stringify(chatMessages)) } catch {}
  }, [chatMessages])

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const toArs = (tx: { amount: number; currency: "ARS" | "USD"; txRate?: number }) =>
    tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount

  // #8 — Proactive anomaly detection when chat opens
  useEffect(() => {
    if (!chatOpen || transactions.length === 0) return
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)

    const todayExp = transactions
      .filter(t => t.type === "expense" && new Date(t.date) >= todayStart)
      .reduce((a, t) => a + toArs(t), 0)
    const last7Exp = transactions
      .filter(t => { const d = new Date(t.date); return t.type === "expense" && d >= sevenDaysAgo && d < todayStart })
      .reduce((a, t) => a + toArs(t), 0)
    const dailyAvg = last7Exp / 7

    let anomaly: string | null = null

    if (dailyAvg > 500 && todayExp > dailyAvg * 2.5) {
      const mult = (todayExp / dailyAvg).toFixed(1)
      anomaly = `Che, hoy gastaste ${formatCurrency(todayExp)}, que es ${mult}x tu promedio diario de esta semana (${formatCurrency(dailyAvg)}). 👀`
    }

    if (!anomaly) return
    setChatMessages(prev => {
      if (prev.some(m => m.text === anomaly)) return prev
      return [...prev, { role: "bot", text: anomaly! }]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen])

  const buildFinancialContext = (): string => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const todayStr = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

    const yearTxs = transactions.filter(t => new Date(t.date).getFullYear() === currentYear)
    const monthTxs = transactions.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    })

    const sumExpenses = (txs: typeof transactions) =>
      txs.filter(t => t.type === "expense").reduce((a, t) => a + toArs(t), 0)
    const sumIncome = (txs: typeof transactions) =>
      txs.filter(t => t.type === "income").reduce((a, t) => a + toArs(t), 0)

    const catMap: Record<string, number> = {}
    yearTxs.filter(t => t.type === "expense").forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + toArs(t)
    })
    const topCategories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`)
      .join(", ")

    const recentTxs = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 60)
    const txLines = recentTxs
      .map(t => {
        const dateStr = new Date(t.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
        const arsAmt = formatCurrency(toArs(t))
        const usdPart = t.currency === "USD" ? ` (USD ${t.amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })})` : ""
        return `${dateStr} · ${t.type === "expense" ? "Gasto" : "Ingreso"} · ${t.description} · ${t.category} · ${arsAmt}${usdPart}`
      })
      .join("\n")

    // #6 — Rich stats for accurate AI answers
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const monthExp = sumExpenses(monthTxs)
    const dailyAvgMonth = dayOfMonth > 0 ? monthExp / dayOfMonth : 0
    const projectionEOM = Math.round(dailyAvgMonth * daysInMonth)

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
    const todayExp = transactions
      .filter(t => t.type === "expense" && new Date(t.date) >= todayStart)
      .reduce((a, t) => a + toArs(t), 0)
    const last7Exp = transactions
      .filter(t => { const d = new Date(t.date); return t.type === "expense" && d >= sevenDaysAgo && d < todayStart })
      .reduce((a, t) => a + toArs(t), 0)
    const dailyAvg7 = last7Exp / 7

    const top3Month = [...monthTxs]
      .filter(t => t.type === "expense")
      .sort((a, b) => toArs(b) - toArs(a))
      .slice(0, 3)
      .map(t => `${t.description}: ${formatCurrency(toArs(t))}`)
      .join(", ")

    const todayUSDIncome = transactions
      .filter(t => t.type === "income" && t.currency === "USD" && new Date(t.date) >= todayStart)
      .reduce((a, t) => a + t.amount, 0)
    const todayUSDExpense = transactions
      .filter(t => t.type === "expense" && t.currency === "USD" && new Date(t.date) >= todayStart)
      .reduce((a, t) => a + t.amount, 0)

    return [
      `Hoy es ${todayStr}.`,
      usdRate ? `Cotización USD activa: 1 USD = ${usdRate.toLocaleString("es-AR")} ARS` : null,
      `=== RESUMEN ANUAL ${currentYear} ===`,
      `Ingresos año: ${formatCurrency(sumIncome(yearTxs))}`,
      `Gastos año: ${formatCurrency(sumExpenses(yearTxs))}`,
      `Balance año: ${formatCurrency(sumIncome(yearTxs) - sumExpenses(yearTxs))}`,
      `Transacciones en el año: ${yearTxs.length}`,
      topCategories ? `Top categorías de gastos (año): ${topCategories}` : null,
      ``,
      `=== MES ACTUAL (día ${dayOfMonth}/${daysInMonth}) ===`,
      `Ingresos mes: ${formatCurrency(sumIncome(monthTxs))}`,
      `Gastos mes: ${formatCurrency(monthExp)}`,
      `Proyección a fin de mes (ritmo actual): ${formatCurrency(projectionEOM)}`,
      `Promedio diario últimos 7 días: ${formatCurrency(dailyAvg7)}`,
      `Gasto de hoy: ${formatCurrency(todayExp)}`,
      todayUSDIncome > 0 ? `Ingreso de hoy en USD: USD ${todayUSDIncome.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : null,
      todayUSDExpense > 0 ? `Gasto de hoy en USD: USD ${todayUSDExpense.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : null,
      top3Month ? `Top 3 gastos más grandes del mes: ${top3Month}` : null,
      ``,
      `=== ÚLTIMAS ${recentTxs.length} TRANSACCIONES ===`,
      txLines,
    ].filter(v => v !== null).join("\n")
  }

  const dispatchChatMessage = async (userLabel: string, prevMessages: ChatMessage[], audioAttachment?: AIAttachment) => {
    if (!apiKey.trim()) {
      setChatMessages(prev => [...prev, { role: "bot", text: "Configurá tu API key en Ajustes para usar el asistente." }])
      return
    }
    setIsChatProcessing(true)

    // Build raw turns (skip the initial greeting at index 0)
    const allTurns: ChatTurn[] = prevMessages.slice(1).map(m => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      text: m.text,
    }))

    // #7 — Compress older turns into a summary when history gets long
    let history: ChatTurn[]
    if (allTurns.length > CHAT_HISTORY_MAX) {
      const older = allTurns.slice(0, allTurns.length - CHAT_KEEP_RECENT)
      const recent = allTurns.slice(-CHAT_KEEP_RECENT)
      const summaryText = older
        .map(t => `${t.role === "user" ? "Usuario" : "Asistente"}: ${t.text.slice(0, 120)}`)
        .join("\n")
      history = [
        { role: "assistant" as const, text: `[RESUMEN PREVIO DE CONVERSACIÓN]\n${summaryText}` },
        ...recent,
        { role: "user" as const, text: userLabel },
      ]
    } else {
      history = [
        ...allTurns,
        { role: "user" as const, text: userLabel },
      ]
    }

    try {
      const reply = await callAIChat(aiProvider, apiKey, buildFinancialContext(), history, audioAttachment)
      setChatMessages(prev => [...prev, { role: "bot", text: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al conectar."
      setChatMessages(prev => [...prev, { role: "bot", text: msg }])
    } finally {
      setIsChatProcessing(false)
    }
  }

  // Always point to the latest dispatchChatMessage
  dispatchChatRef.current = dispatchChatMessage

  const processMessage = async (userMsg: string) => {
    const prevMessages = chatMessages
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }])

    const lowerMsg = userMsg.toLowerCase()

    // ── Delete existing transaction (AI-powered) ─────────────────────────────
    const DELETE_WORDS = ["borrá", "borra", "eliminá", "elimina", "borralo", "borrarla", "eliminalo", "eliminarla", "borrar", "eliminar", "suprimí", "suprimir", "borrá el", "eliminá el"]
    const isDeleteIntent = DELETE_WORDS.some(w => lowerMsg.includes(w))
    if (isDeleteIntent) {
      if (!apiKey.trim()) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Configurá tu API key en Ajustes para poder eliminar movimientos." }])
        return
      }
      setIsChatProcessing(true)
      let handled = false
      try {
        const del = await callAIDeleteDetect(aiProvider, apiKey, userMsg)
        if (del.match) {
          handled = true
          const found = findTransactionByMatch(transactionsRef.current, del.match)
          if (found) {
            const label = `${found.type === "income" ? "📈" : "📉"} ${found.description} · ${formatCurrency(found.currency === "USD" ? found.amount * (found.txRate ?? usdRate) : found.amount)}`
            deleteTransactionRef.current(found.id, (msg) => { setChatMessages(prev => [...prev, { role: "bot", text: `⚠️ ${msg}` }]) })
            setChatMessages(prev => [...prev, { role: "bot", text: `🗑️ Eliminado — ${label}.` }])
          } else {
            const dateHint = del.match.daysAgo !== undefined ? ` de hace ${del.match.daysAgo} día${del.match.daysAgo !== 1 ? "s" : ""}` : ""
            setChatMessages(prev => [...prev, { role: "bot", text: `No encontré ninguna transacción que coincida con "${del.match!.description}"${dateHint}. Revisá la lista de movimientos y volvé a intentar con el nombre exacto.` }])
          }
        }
      } catch {
        // handled stays false
      }
      if (!handled) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Para eliminar un movimiento decime algo como: \"borrá el super de ayer\" o \"eliminá el taxi de hoy\"." }])
      }
      setIsChatProcessing(false)
      return
    }

    // ── Mark/unmark recurring (AI-powered) ───────────────────────────────────
    const RECURRING_WORDS = ["recurrente", "fijo mensual", "es fijo", "marcalo fijo", "marcá fijo", "marcá como fijo", "marcalo recurrente", "marcá recurrente", "marcá como recurrente", "es mensual", "es un fijo", "repetí", "ya no es fijo", "ya no es recurrente", "quitá recurrente", "quitá fijo", "sacá recurrente", "no es más fijo", "no es más recurrente"]
    const isRecurringIntent = RECURRING_WORDS.some(w => lowerMsg.includes(w))
    if (isRecurringIntent) {
      if (!apiKey.trim()) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Configurá tu API key en Ajustes para usar esta función." }])
        return
      }
      setIsChatProcessing(true)
      let handled = false
      try {
        const rec = await callAIRecurringDetect(aiProvider, apiKey, userMsg)
        if (rec.match) {
          handled = true
          const found = findTransactionByMatch(transactionsRef.current, rec.match)
          if (found) {
            updateTransactionRef.current(found.id, {
              description: found.description, amount: found.amount, type: found.type,
              icon: found.icon, category: found.category, date: new Date(found.date),
              currency: found.currency, amountUsd: found.amountUsd, txRate: found.txRate,
              exchangeRateType: found.exchangeRateType as ExchangeRateType | null,
              observation: found.observation, isRecurring: rec.recurring,
            }, (msg) => { setChatMessages(prev => [...prev, { role: "bot", text: `⚠️ ${msg}` }]) })
            const action = rec.recurring ? "marcada como recurrente 🔁" : "ya no es recurrente"
            setChatMessages(prev => [...prev, { role: "bot", text: `✅ ${found.description} — ${action}.` }])
          } else {
            const dateHint = rec.match.daysAgo !== undefined ? ` de hace ${rec.match.daysAgo} día${rec.match.daysAgo !== 1 ? "s" : ""}` : ""
            setChatMessages(prev => [...prev, { role: "bot", text: `No encontré ninguna transacción que coincida con "${rec.match!.description}"${dateHint}.` }])
          }
        }
      } catch {
        // handled stays false
      }
      if (!handled) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Para marcar un movimiento como recurrente decime algo como: \"marcá el alquiler como recurrente\" o \"el gym es un gasto fijo mensual\"." }])
      }
      setIsChatProcessing(false)
      return
    }

    // ── Modify existing transaction by description/date (AI-powered) ────────
    const MODIFY_WORDS = ["agregale", "ponele", "poné", "modificá", "modifica", "renombrá", "renombra", "editá", "edita", "cambiale", "cambialo", "cambiala", "cambiá", "añadile", "agrega", "cambia", "actualizá", "actualiza", "pasá", "pasalo", "pasala", "subí", "bajá", "ponerle", "cambiemos", "corregí", "corrige"]
    const isModifyIntent = MODIFY_WORDS.some(w => lowerMsg.includes(w))
    if (isModifyIntent) {
      if (!apiKey.trim()) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Configurá tu API key en Ajustes para poder modificar movimientos." }])
        return
      }
      setIsChatProcessing(true)
      let handled = false
      try {
        const upd = await callAIUpdateDetect(aiProvider, apiKey, userMsg)
        if (upd.match && Object.values(upd.updates).some(v => v !== undefined)) {
          handled = true
          const found = findTransactionByMatch(transactionsRef.current, upd.match)
          if (found) {
            updateTransactionRef.current(found.id, {
              description: upd.updates.description ?? found.description,
              amount: upd.updates.amount ?? found.amount,
              type: upd.updates.type ?? found.type,
              icon: upd.updates.icon ?? found.icon,
              category: upd.updates.category ?? found.category,
              date: new Date(found.date),
              currency: found.currency,
              amountUsd: found.amountUsd,
              txRate: found.txRate,
              exchangeRateType: found.exchangeRateType as ExchangeRateType | null,
              observation: upd.updates.observation ?? found.observation,
              isRecurring: found.isRecurring ?? false,
            }, (msg) => { setChatMessages(prev => [...prev, { role: "bot", text: `⚠️ ${msg}` }]) })
            const fieldLabels: Record<string, string> = {
              observation: "nota", description: "título", amount: "monto", category: "categoría", type: "tipo",
            }
            const summary = Object.entries(upd.updates)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${fieldLabels[k] ?? k}: "${v}"`)
              .join(", ")
            setChatMessages(prev => [...prev, { role: "bot", text: `✅ Actualizado — ${found.description} — ${summary}.` }])
            setLastModifiedTxId(found.id)
            setTimeout(() => setLastModifiedTxId(null), 2500)
          } else {
            const dateHint = upd.match.daysAgo !== undefined ? ` de hace ${upd.match.daysAgo} día${upd.match.daysAgo !== 1 ? "s" : ""}` : ""
            setChatMessages(prev => [...prev, { role: "bot", text: `No encontré ninguna transacción que coincida con "${upd.match!.description}"${dateHint}. Revisá la lista de movimientos y volvé a intentar con el nombre exacto.` }])
          }
        }
      } catch {
        // handled stays false → show hint below
      }
      if (!handled) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Para modificar un movimiento decime algo como: \"al padel de ayer, agregale la nota \'detalle\'\" o \"editá el gym de hoy, cambiá el monto a 8000\"." }])
      }
      setIsChatProcessing(false)
      return
    }

    // ── Update intent: check before trying to parse as a new transaction ────
    const UPDATE_INTENT = /actualiz|corregí|corrig|cambi[aáé]|era en|fue en|fueron en|modific|es en|son en|no oficial|no blue|no tarjeta|no mep|en dólar|en dolar/i
    const RATE_PATTERNS: { pattern: RegExp; type: ExchangeRateType }[] = [
      { pattern: /blue|azul/i, type: "BLUE" },
      { pattern: /oficial/i, type: "OFICIAL" },
      { pattern: /tarjeta/i, type: "TARJETA" },
      { pattern: /mep|bolsa|ccl/i, type: "MEP" },
    ]
    const hasRateKeyword = RATE_PATTERNS.some(({ pattern }) => pattern.test(userMsg))
    const isQuestion = /[?]/.test(userMsg) || /^(qué|que|cuál|cual|cuánto|cuanto|cómo|como)\b/i.test(userMsg)
    if ((UPDATE_INTENT.test(userMsg) || (hasRateKeyword && !isQuestion)) && chatLastRegisteredRef.current) {
      const ref = chatLastRegisteredRef.current
      const found = [...transactionsRef.current]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .find(t => t.description === ref.description && Math.abs(t.amount - ref.amount) < 0.01 && t.type === ref.type)
      if (found) {
        let newRateType: ExchangeRateType | null = null
        let newRate: number | undefined
        for (const { pattern, type: rateType } of RATE_PATTERNS) {
          if (pattern.test(userMsg)) {
            newRateType = rateType
            const lk = rateType.toLowerCase() as keyof typeof liveRates
            newRate = (liveRates[lk] as { venta?: number } | null)?.venta ?? usdRate
            break
          }
        }
        const numMatch = userMsg.match(/\b(\d[\d.,]*)\b/)
        const newAmount = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : null
        const hasAmountChange = newAmount && newAmount > 0 && Math.abs(newAmount - ref.amount) > 0.01

        if (newRateType || hasAmountChange) {
          const finalAmount = hasAmountChange ? newAmount! : found.amount
          const finalCurrency: "ARS" | "USD" = newRateType ? "USD" : found.currency
          const finalRate = newRate ?? found.txRate
          const finalRateType = newRateType ?? (found.exchangeRateType as ExchangeRateType | null)
          updateTransactionRef.current(found.id, {
            description: found.description,
            amount: finalAmount,
            type: found.type,
            icon: found.icon,
            category: found.category,
            date: new Date(found.date),
            currency: finalCurrency,
            amountUsd: finalCurrency === "USD" ? finalAmount : undefined,
            txRate: finalCurrency === "USD" ? finalRate : undefined,
            exchangeRateType: finalCurrency === "USD" ? finalRateType : null,
            observation: found.observation,
            isRecurring: found.isRecurring ?? false,
          }, (msg) => { setChatMessages(prev => [...prev, { role: "bot", text: `⚠️ ${msg}` }]) })
          chatLastRegisteredRef.current = null
          const arsTotal = finalCurrency === "USD" ? finalAmount * (finalRate ?? usdRate) : finalAmount
          const parts: string[] = []
          if (newRateType) parts.push(`tipo de cambio: ${newRateType}${newRate ? ` · $${newRate.toLocaleString("es-AR")}` : ""}`)
          if (hasAmountChange) parts.push(`monto: ${finalAmount}`)
          parts.push(`total: ${formatCurrency(arsTotal)}`)
          setChatMessages(prev => [...prev, { role: "bot", text: `✅ Actualizado — ${parts.join(", ")}.` }])
          setLastModifiedTxId(found.id)
          setTimeout(() => setLastModifiedTxId(null), 2500)
          return
        }
      }
    }

    // ── If message has numbers, try transaction parsing first ────────────────
    if (apiKey.trim() && /\d/.test(userMsg)) {
      setIsChatProcessing(true)
      try {
        const aiResult = await callAI(aiProvider, apiKey, userMsg, undefined)
        const results = Array.isArray(aiResult) ? aiResult : [aiResult]
        const valid = results.filter(r => r.type !== "unknown")
        if (valid.length > 0) {
          const confirmParts: string[] = []
          let usdToast = false
          let lastCurr: "ARS" | "USD" = "ARS"
          for (const result of valid) {
            let txDate2 = new Date()
            if (typeof result.daysAgo === "number" && result.daysAgo > 0) {
              txDate2 = new Date()
              txDate2.setDate(txDate2.getDate() - result.daysAgo)
              txDate2.setHours(12, 0, 0, 0)
            }
            let curr2: "ARS" | "USD" = "ARS"
            let rate2: number | undefined
            let rateType2: ExchangeRateType | null = null
            if (result.suggestedCurrency === "USD") {
              curr2 = "USD"
              const rt = result.suggestedExRateType ?? newExRateType
              const lk = rt.toLowerCase() as keyof typeof liveRates
              rate2 = (liveRates[lk] as { venta?: number } | null)?.venta ?? usdRate
              rateType2 = rt as ExchangeRateType
              if (!usdToast) {
                toast("💵 Moneda detectada: USD", { description: `Tasa ${rt} · $${rate2.toLocaleString("es-AR")}` })
                usdToast = true
              }
            }
            const chatDetectedAccount =
              result.account ||
              detectAccountFromText(userMsg) ||
              defaultAccount

            addTransactionRef.current({
              description: result.description,
              amount: result.amount,
              type: result.type as "expense" | "income",
              icon: result.icon,
              category: result.category,
              date: txDate2,
              currency: curr2,
              amountUsd: curr2 === "USD" ? result.amount : undefined,
              txRate: rate2,
              exchangeRateType: rateType2,
              observation: result.observation,
              isRecurring: result.suggestRecurring === true,
              account: chatDetectedAccount,
            }, (msg) => { setChatMessages(prev => [...prev, { role: "bot", text: `⚠️ ${msg}` }]) })
            const arsAmt = curr2 === "USD" ? (result.amount * (rate2 ?? usdRate)) : result.amount
            confirmParts.push(`${result.type === "income" ? "📈" : "📉"} ${result.description} · ${formatCurrency(arsAmt)}`)
            lastCurr = curr2
          }
          if (valid.length === 1) {
            chatLastRegisteredRef.current = { description: valid[0].description, amount: valid[0].amount, type: valid[0].type as "expense" | "income", currency: lastCurr }
          }
          const confirmText = valid.length === 1
            ? `✅ ¡Registrado! ${confirmParts[0]}. ¿Algo más?`
            : `✅ Registré ${valid.length} transacciones:\n${confirmParts.map(p => `• ${p}`).join("\n")}`
          setChatMessages(prev => [...prev, { role: "bot", text: confirmText }])
          setIsChatProcessing(false)
          return
        }
      } catch {
        // Fall through to conversational AI on any error
      }
      setIsChatProcessing(false)
    }

    await dispatchChatMessage(userMsg, prevMessages)
  }

  // Keep ref in sync so onstop always calls the latest processMessage
  processMessageRef.current = processMessage

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatProcessing || isChatRecording) return
    let userMsg: string
    try {
      userMsg = sanitizeUserInput(chatInput.trim())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Entrada inválida."
      setChatMessages(prev => [...prev, { role: "bot", text: msg }])
      setChatInput("")
      return
    }
    setChatInput("")
    await processMessage(userMsg)
  }

  const submitChatMessage = async (text: string, attachment?: AIAttachment, force = false) => {
    if ((!text.trim() && !attachment) || isChatRecording) return
    if (!force && isChatProcessing) return
    if (attachment?.type === "audio") {
      if (!apiKey.trim()) {
        setChatMessages(prev => [...prev, { role: "bot", text: "Configurá tu API key en Ajustes para usar el asistente." }])
        return
      }
      // Transcribe first → route through intent detection (modify/delete/recurring/new tx)
      setIsChatProcessing(true)
      setChatStatusText("Transcribiendo...")
      const cleanText = await transcribeAudioAttachment(aiProvider, apiKey, attachment)
      setChatStatusText(null)
      setIsChatProcessing(false)
      if (cleanText) {
        await processMessage(cleanText)
      } else {
        // No transcription (Claude, empty result) — fall back to conversational with raw audio
        const prevMessages = chatMessagesRef.current
        setChatMessages(prev => [...prev, { role: "user", text: "🎤 Mensaje de voz" }])
        await dispatchChatMessage("🎤 Mensaje de voz", prevMessages, attachment)
      }
      return
    }
    let userMsg: string
    try {
      userMsg = sanitizeUserInput(text.trim())
    } catch { return }
    setChatInput("")
    await processMessage(userMsg)
  }

  const startChatRecording = async () => {
    chatAudioHoldRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!chatAudioHoldRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      setChatAudioStream(stream)
      const recorder = new MediaRecorder(stream)
      chatMediaRecorderRef.current = recorder
      chatAudioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chatAudioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (chatAudioOptsRef.current.cancel) {
          chatAudioOptsRef.current = {}
          return
        }
        chatAudioOptsRef.current = {}
        try {
          const blob = new Blob(chatAudioChunksRef.current, { type: "audio/webm" })
          if (blob.size === 0) {
            setChatMessages(prev => [...prev, { role: "bot", text: "No se capturó audio. Intentá mantener el botón mientras hablás." }])
            return
          }
          const file = new File([blob], `chat-voz-${Date.now()}.webm`, { type: "audio/webm" })
          const base64 = await fileToBase64(file)
          const attachment: AIAttachment = { type: "audio", base64, mimeType: "audio/webm", file }
          // Transcribe → route through full intent detection (modify/delete/recurring/new tx)
          if (apiKey.trim()) {
            setIsChatProcessing(true)
            setChatStatusText("Transcribiendo...")
            const cleanText = await transcribeAudioAttachment(aiProvider, apiKey, attachment)
            setChatStatusText(null)
            setIsChatProcessing(false)
            if (cleanText) {
              await processMessageRef.current?.(cleanText)
              return
            }
          }
          // Fallback: conversational AI with raw audio
          const prevMessages = chatMessagesRef.current
          setChatMessages(prev => [...prev, { role: "user", text: "🎤 Mensaje de voz" }])
          await dispatchChatRef.current?.("🎤 Mensaje de voz", prevMessages, attachment)
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error al procesar el audio."
          setChatMessages(prev => [...prev, { role: "bot", text: msg }])
        }
      }
      recorder.start()
      setIsChatRecording(true)
    } catch {
      chatAudioHoldRef.current = false
      setChatMessages(prev => [...prev, { role: "bot", text: "No se pudo acceder al micrófono." }])
    }
  }

  const stopChatRecording = (opts?: { cancel?: boolean }) => {
    chatAudioHoldRef.current = false
    chatAudioOptsRef.current = opts || {}
    chatMediaRecorderRef.current?.stop()
    setIsChatRecording(false)
    setChatAudioStream(null)
  }

  const resetChat = () => {
    setChatMessages([INITIAL_BOT_MESSAGE])
    chatLastRegisteredRef.current = null
    try { sessionStorage.setItem("bb_chat_messages", JSON.stringify([INITIAL_BOT_MESSAGE])) } catch {}
  }

  return {
    chatMessages,
    setChatMessages,
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
  }
}

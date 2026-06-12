/**
 * AI client — calls the backend ai-service instead of AI providers directly.
 * API keys are managed server-side; the frontend sends NO credentials.
 *
 * Base URL: NEXT_PUBLIC_API_URL (api-gateway) → routed to ai-service
 */

import { getToken } from "@/lib/api-client"
import { localIsoDate } from "@/lib/utils"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "") + "/api/ai"

// ── Types (unchanged — shared with rest of the app) ───────────────────────────

export interface ParsedTransaction {
  type: "expense" | "income" | "unknown"
  description: string
  amount: number
  category: string
  icon: string
  daysAgo?: number
  suggestRecurring?: boolean
  recurringFrequency?: "weekly" | "biweekly" | "monthly" | "annual"
  suggestedCurrency?: "USD"
  suggestedExRateType?: "BLUE" | "OFICIAL" | "TARJETA" | "MEP"
  observation?: string
  account?: string
}

export interface ChatTurn {
  role: "user" | "assistant"
  text: string
}

export interface AIAttachment {
  type: "image" | "audio" | "file"
  base64: string
  mimeType: string
  file?: File
}

export interface ParsedUpdate {
  match: { description: string; daysAgo?: number; txType?: "income" | "expense" } | null
  updates: {
    observation?: string
    description?: string
    amount?: number
    category?: string
    icon?: string
    type?: "income" | "expense"
  }
}

export interface ParsedDelete {
  match: { description: string; daysAgo?: number; txType?: "income" | "expense" } | null
}

export interface ParsedRecurring {
  match: { description: string; daysAgo?: number; txType?: "income" | "expense" } | null
  recurring: boolean
}

export interface CSVMapping {
  dateCol: number
  descCol: number
  amountCol: number | null
  debitCol: number | null
  creditCol: number | null
  dateFormat: "dd/mm/yyyy" | "yyyy-mm-dd" | "mm/dd/yyyy" | "dd-mm-yyyy"
}

// ── Input sanitization (kept on frontend as first defense layer) ──────────────

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|prior|the\s+above|instructions)/i,
  /you\s+are\s+(now|a\b)/i,
  /\bsystem\s*:/i,
  /forget\s+(previous|all|prior)/i,
  /disregard\s+(previous|all|prior|your)/i,
  /\bjailbreak\b/i,
  /pretend\s+(you|that)/i,
  /act\s+as\s+(if\b|a\b)/i,
  /override\s+(system|instructions|rules|your)/i,
  /developer\s+mode/i,
  /<\s*\/?\s*system\s*>/i,
  /ignorá?\s+(todo|instrucciones|reglas|lo anterior|las instrucciones)/i,
  /olvidá?\s+(todo|instrucciones|las instrucciones|reglas)/i,
  /nueva\s+(instrucción|tarea|persona|identidad|regla)/i,
  /a\s+partir\s+de\s+ahora\s+(sos|actuás|ignorá|olvidá)/i,
  /modo\s+desarrollador/i,
]

export function sanitizeUserInput(text: string): string {
  const trimmed = text.trim().slice(0, 300)
  for (const p of INJECTION_PATTERNS) {
    if (p.test(trimmed)) {
      throw new Error("Entrada inválida. Describí el gasto de forma simple, por ejemplo: 'Gasté 5000 en el super'.")
    }
  }
  return trimmed
}

// ── Validation constants ──────────────────────────────────────────────────────

const VALID_ICONS = ["ShoppingCart", "Car", "Coffee", "Code", "Dumbbell", "ArrowDownLeft", "GraduationCap", "Heart", "Briefcase", "UtensilsCrossed", "Tag"]
const VALID_CATEGORIES = ["Comida", "Supermercado", "Transporte", "Salidas", "Suscripciones", "Deporte", "Educacion", "Salud", "Trabajo", "General"]

// ── Response parsing (unchanged — backend returns raw AI text) ────────────────

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function validateOne(raw: ParsedTransaction): ParsedTransaction {
  if (!["expense", "income"].includes(raw.type)) raw.type = "expense"
  if (typeof raw.amount !== "number" || !isFinite(raw.amount) || raw.amount < 1 || raw.amount > 1_000_000_000_000)
    throw new Error("Monto inválido en la respuesta.")
  if (!VALID_ICONS.includes(raw.icon)) raw.icon = "Tag"
  if (!VALID_CATEGORIES.includes(raw.category)) raw.category = "General"
  if (!raw.description?.trim()) raw.description = "Transacción"
  raw.description = capitalize(raw.description.slice(0, 40))
  raw.daysAgo = (
    typeof raw.daysAgo === "number" &&
    Number.isInteger(raw.daysAgo) &&
    raw.daysAgo >= 0 &&
    raw.daysAgo <= 365
  ) ? raw.daysAgo : 0
  raw.suggestRecurring = raw.suggestRecurring === true
  const VALID_FREQUENCIES = ["weekly", "biweekly", "monthly", "annual"]
  if (raw.suggestRecurring && VALID_FREQUENCIES.includes(raw.recurringFrequency as string)) {
    // keep as-is
  } else if (raw.suggestRecurring) {
    raw.recurringFrequency = "monthly"
  } else {
    delete raw.recurringFrequency
  }
  if (raw.suggestedCurrency !== "USD") delete raw.suggestedCurrency
  const VALID_RATE_TYPES = ["BLUE", "OFICIAL", "TARJETA", "MEP"]
  if (!VALID_RATE_TYPES.includes(raw.suggestedExRateType as string)) delete raw.suggestedExRateType
  if (raw.observation !== undefined) {
    const sanitized = String(raw.observation).replace(/<[^>]*>/g, "").trim().slice(0, 100)
    raw.observation = sanitized || undefined
  }
  if (raw.account !== undefined) {
    const sanitized = String(raw.account).replace(/<[^>]*>/g, "").trim().slice(0, 60)
    raw.account = sanitized || undefined
  }
  return raw
}

function extractAndValidate(raw: string): ParsedTransaction | ParsedTransaction[] {
  const clean = raw.trim().replace(/```json|```/g, "").trim()
  const arrMatch = clean.match(/\[[\s\S]*\]/)
  const objMatch = clean.match(/\{[\s\S]*?\}/)

  if (arrMatch) {
    let parsed: ParsedTransaction[]
    try { parsed = JSON.parse(arrMatch[0]) } catch { throw new Error("Error al interpretar la respuesta de la IA.") }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("La IA no devolvió transacciones.")
    return parsed
      .filter(item => item.type !== "unknown")
      .map(validateOne)
  }

  if (!objMatch) throw new Error("La IA no devolvió una respuesta válida.")
  let parsed: ParsedTransaction
  try { parsed = JSON.parse(objMatch[0]) } catch { throw new Error("Error al interpretar la respuesta de la IA.") }

  if (!parsed.type) throw new Error("Respuesta incompleta de la IA.")
  if (parsed.type === "unknown") return { type: "unknown", description: "", amount: 0, category: "", icon: "" }

  return validateOne(parsed)
}

function parseAIMatch(raw: string): { description: string; daysAgo?: number; txType?: "income" | "expense" } | null {
  const clean = raw.trim().replace(/```json|```/g, "").trim()
  const m = clean.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const p = JSON.parse(m[0])
    if (!p.match?.description) return null
    const rawTxType = p.match.txType ?? p.match.tipo ?? p.match.type
    return {
      description: String(p.match.description).slice(0, 50),
      daysAgo: typeof p.match.daysAgo === "number" && p.match.daysAgo >= 0 ? Math.floor(p.match.daysAgo) : undefined,
      txType: (["income", "expense"] as const).includes(rawTxType) ? rawTxType as "income" | "expense" : undefined,
    }
  } catch {
    return null
  }
}

function translateError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("timeout") || m.includes("tardó demasiado") || m.includes("aborted") || m.includes("timed out"))
    return "La IA tardó demasiado. Revisá tu conexión e intentá de nuevo."
  if (m.includes("rate limit") || m.includes("429") || m.includes("quota") || m.includes("resource_exhausted"))
    return "Límite de requests alcanzado. Esperá unos segundos e intentá de nuevo."
  if (m.includes("500") || m.includes("502") || m.includes("503") || m.includes("service unavailable") || m.includes("overloaded"))
    return "El servicio de IA no está disponible. Intentá en unos minutos."
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch") || m.includes("load failed"))
    return "Error de conexión. Revisá tu internet."
  return msg
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function postToAiService<T>(path: string, body: object, provider?: string): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...body,
      ...(provider ? { provider } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(translateError((err as { error?: string }).error || `Error ${res.status}`))
  }
  return res.json()
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse free-form text (and optional image) into transactions.
 * Calls POST /api/ai/parse — backend holds the API key.
 */
export async function callAI(
  provider: unknown,
  input: string,
  attachments?: AIAttachment[]
): Promise<ParsedTransaction | ParsedTransaction[]> {
  const safeInput = sanitizeUserInput(input)
  const today = localIsoDate()

  const imageAttachment = attachments?.find(a => a.type === "image")
  const fileAttachment = attachments?.find(a => a.type === "file")

  try {
    const data = await postToAiService<{ rawResponse: string }>("/parse", {
      input: safeInput,
      imageBase64: imageAttachment?.base64 ?? null,
      imageMimeType: imageAttachment?.mimeType ?? "image/jpeg",
      fileBase64: fileAttachment?.base64 ?? null,
      fileMimeType: fileAttachment?.mimeType ?? null,
      todayDate: today,
    }, provider as string)
    return extractAndValidate(data.rawResponse)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido."
    throw new Error(translateError(msg))
  }
}

/**
 * Chat with the financial assistant.
 * Calls POST /api/ai/chat — session history stored in MongoDB on the backend.
 */
export async function callAIChat(
  provider: unknown,
  context: string,
  history: ChatTurn[],
  _audioAttachment?: AIAttachment
): Promise<string> {
  const safeHistory = history.map((turn, i) =>
    i === history.length - 1 && turn.role === "user"
      ? { ...turn, text: sanitizeUserInput(turn.text) }
      : turn
  )
  try {
    const data = await postToAiService<{ reply: string; sessionId: string }>("/chat", {
      message: safeHistory[safeHistory.length - 1]?.text ?? "",
      financialContext: context,
      history: safeHistory,
    }, provider as string)
    return data.reply
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido."
    throw new Error(translateError(msg))
  }
}

/**
 * Detect update intent: which transaction to modify and what fields.
 */
export async function callAIUpdateDetect(
  provider: unknown,
  message: string
): Promise<ParsedUpdate> {
  const today = localIsoDate()
  try {
    const safeMsg = sanitizeUserInput(message)
    const data = await postToAiService<{ rawResponse: string }>("/detect-intent", {
      message: safeMsg,
      intentType: "update",
      todayDate: today,
    }, provider as string)
    const raw = data.rawResponse
    const matchBase = parseAIMatch(raw)
    if (!matchBase) return { match: null, updates: {} }
    const clean = raw.trim().replace(/```json|```/g, "").trim()
    const m = clean.match(/\{[\s\S]*\}/)
    const p = m ? JSON.parse(m[0]) : {}
    const u = p.updates ?? {}
    const rawObs = u.observation ?? u.nota ?? u.observacion ?? u.observación ?? u.comentario ?? u.detalle
    const rawDesc = u.description ?? u.titulo ?? u.título ?? u.nombre
    const rawAmt = u.amount ?? u.monto
    const rawCat = u.category ?? u.categoria ?? u.categoría
    const rawType = u.type ?? u.tipo
    return {
      match: matchBase,
      updates: {
        observation: rawObs != null ? String(rawObs).slice(0, 300) : undefined,
        description: rawDesc ? String(rawDesc).slice(0, 35) : undefined,
        amount: typeof rawAmt === "number" && rawAmt > 0 ? rawAmt : undefined,
        category: VALID_CATEGORIES.includes(rawCat) ? rawCat : undefined,
        icon: VALID_ICONS.includes(u.icon) ? u.icon : undefined,
        type: (["income", "expense"] as const).includes(rawType) ? rawType as "income" | "expense" : undefined,
      },
    }
  } catch {
    return { match: null, updates: {} }
  }
}

/**
 * Detect delete intent: which transaction to remove.
 */
export async function callAIDeleteDetect(
  provider: unknown,
  message: string
): Promise<ParsedDelete> {
  const today = localIsoDate()
  try {
    const safeMsg = sanitizeUserInput(message)
    const data = await postToAiService<{ rawResponse: string }>("/detect-intent", {
      message: safeMsg,
      intentType: "delete",
      todayDate: today,
    }, provider as string)
    const match = parseAIMatch(data.rawResponse)
    return { match }
  } catch {
    return { match: null }
  }
}

/**
 * Detect recurring intent: which transaction to mark/unmark as recurring.
 */
export async function callAIRecurringDetect(
  provider: unknown,
  message: string
): Promise<ParsedRecurring> {
  const today = localIsoDate()
  try {
    const safeMsg = sanitizeUserInput(message)
    const data = await postToAiService<{ rawResponse: string }>("/detect-intent", {
      message: safeMsg,
      intentType: "recurring",
      todayDate: today,
    }, provider as string)
    const raw = data.rawResponse
    const match = parseAIMatch(raw)
    if (!match) return { match: null, recurring: false }
    const clean = raw.trim().replace(/```json|```/g, "").trim()
    const m = clean.match(/\{[\s\S]*\}/)
    const p = m ? JSON.parse(m[0]) : {}
    return { match, recurring: p.recurring === true }
  } catch {
    return { match: null, recurring: false }
  }
}

/**
 * CSV column mapping — identify columns from headers + sample rows.
 */
export async function callAICSVMapping(
  provider: unknown,
  headers: string[],
  sampleRows: string[][]
): Promise<CSVMapping | null> {
  try {
    const data = await postToAiService<{ rawResponse: string }>("/csv-mapping", {
      headers,
      sampleRows,
    }, provider as string)
    const m = data.rawResponse.match(/\{[\s\S]*\}/)
    if (!m) return null
    const p = JSON.parse(m[0])
    return {
      dateCol: p.dateCol ?? 0,
      descCol: p.descCol ?? 1,
      amountCol: typeof p.amountCol === "number" ? p.amountCol : null,
      debitCol: typeof p.debitCol === "number" ? p.debitCol : null,
      creditCol: typeof p.creditCol === "number" ? p.creditCol : null,
      dateFormat: p.dateFormat ?? "dd/mm/yyyy",
    }
  } catch {
    return null
  }
}

/**
 * Audio transcription via OpenAI Whisper (server-side).
 * Returns the transcribed text, or null if the provider doesn't support
 * transcription (Claude / Gemini) or an error occurs.
 */
export async function transcribeAudioAttachment(
  provider: unknown,
  attachment: AIAttachment
): Promise<string | null> {
  try {
    const data = await postToAiService<{ transcription: string }>(
      "/transcribe",
      { audioBase64: attachment.base64, mimeType: attachment.mimeType },
      provider as string
    )
    return data.transcription?.trim() || null
  } catch {
    return null
  }
}

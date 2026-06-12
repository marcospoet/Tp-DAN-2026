"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { apiRequest } from "@/lib/api-client"
import { useAuth, type ProfileResponse } from "@/lib/auth-context"

export type TimeFilter = "week" | "month" | "year" | "custom"
export type ExchangeRateMode = "api" | "manual"
export type ExchangeRateType = "BLUE" | "TARJETA" | "OFICIAL" | "MEP" | "MANUAL"
export type AIProvider = "claude" | "openai" | "gemini"

interface SettingsState {
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
  defaultExRateType: ExchangeRateType
  setDefaultExRateType: (t: ExchangeRateType) => void
  saveProfile: (overrides?: {
    userName?: string
    defaultAccount?: string
    usdRate?: number
    exchangeRateMode?: ExchangeRateMode
    aiProvider?: AIProvider
    apiKeyClaude?: string
    apiKeyOpenAI?: string
    apiKeyGemini?: string
    defaultExRateType?: ExchangeRateType
  }) => Promise<void>
  // Filters
  timeFilter: TimeFilter
  setTimeFilter: (f: TimeFilter) => void
  customRange: { from: Date; to: Date }
  setCustomRange: (r: { from: Date; to: Date }) => void
}

const SettingsContext = createContext<SettingsState | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, registerAuthHydrate, registerSignOutCleanup } = useAuth()

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
  const [defaultExRateType, setDefaultExRateType] = useState<ExchangeRateType>("BLUE")

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month")
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date()
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
  })

  // ── Hydrate from profile after auth init ─────────────────────────────────────
  useEffect(() => {
    return registerAuthHydrate((profile: ProfileResponse) => {
      setUserName(profile.userName ?? "Usuario")
      setDefaultAccount(profile.defaultAccount ?? "Efectivo")
      setExchangeRateMode((profile.exchangeRateMode as ExchangeRateMode) ?? "api")
      setUsdRate(profile.usdRate ?? 1350)
      setDefaultExRateType((profile.defaultExRateType as ExchangeRateType) ?? "BLUE")
      setAiProvider((profile.aiProvider as AIProvider) ?? "claude")
      setApiKeyClaude(profile.apiKeyClaude ?? "")
      setApiKeyOpenAI(profile.apiKeyOpenai ?? "")
      setApiKeyGemini(profile.apiKeyGemini ?? "")
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset on sign-out ─────────────────────────────────────────────────────────
  useEffect(() => {
    return registerSignOutCleanup(() => {
      setUserName("Usuario")
      setApiKeyClaude("")
      setApiKeyOpenAI("")
      setApiKeyGemini("")
      setDefaultExRateType("BLUE")
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    defaultExRateType?: ExchangeRateType
  }) => {
    if (!user) return
    // Las API keys solo viajan si vienen EXPLÍCITAS en overrides (settings /
    // onboarding). El backend interpreta "" como "borrar la key": si las
    // mandáramos siempre desde el estado del contexto, cualquier guardado de
    // otro campo (nombre, presupuesto) o un guardado pre-hidratación las
    // borraría silenciosamente. Backend ignora los campos null/ausentes.
    const body: Record<string, unknown> = {
      userName: overrides?.userName ?? userName,
      defaultAccount: overrides?.defaultAccount ?? defaultAccount,
      exchangeRateMode: overrides?.exchangeRateMode ?? exchangeRateMode,
      usdRate: overrides?.usdRate ?? usdRate,
      defaultExRateType: overrides?.defaultExRateType ?? defaultExRateType,
    }
    // aiProvider también opt-in: un guardado pre-hidratación (ej. "Saltar" en
    // el onboarding tras un reload) mandaría el default "claude" y pisaría la
    // elección real del usuario.
    if (overrides && "aiProvider" in overrides) body.aiProvider = overrides.aiProvider
    if (overrides && "apiKeyClaude" in overrides) body.apiKeyClaude = overrides.apiKeyClaude
    if (overrides && "apiKeyOpenAI" in overrides) body.apiKeyOpenai = overrides.apiKeyOpenAI
    if (overrides && "apiKeyGemini" in overrides) body.apiKeyGemini = overrides.apiKeyGemini

    await apiRequest("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  return (
    <SettingsContext.Provider value={{
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
      defaultExRateType,
      setDefaultExRateType,
      saveProfile,
      timeFilter,
      setTimeFilter,
      customRange,
      setCustomRange,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider")
  return ctx
}

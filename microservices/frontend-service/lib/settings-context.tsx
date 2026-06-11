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
        defaultExRateType: overrides?.defaultExRateType ?? defaultExRateType,
      }),
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

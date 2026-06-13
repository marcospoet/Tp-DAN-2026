"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { apiRequest, getToken, removeToken, setToken, TOKEN_KEY } from "@/lib/api-client"

export type View = "landing" | "auth" | "settings" | "dashboard" | "profile" | "analytics"

export interface AuthUser {
  id: string
  email: string
}

// Shape of GET /api/auth/profile — consumed by SettingsProvider via registerAuthHydrate
export interface ProfileResponse {
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
  defaultExRateType?: string
}

export const AUTHENTICATED_VIEWS: View[] = ["dashboard", "settings", "profile", "analytics"]

interface AuthState {
  user: AuthUser | null
  loadingAuth: boolean
  signOut: () => void
  isPasswordRecovery: boolean
  setIsPasswordRecovery: (v: boolean) => void
  currentView: View
  setView: (view: View, replace?: boolean) => void
  navDirection: "forward" | "back"
  /** Called once by other providers on mount to receive the profile after auth init */
  registerAuthHydrate: (fn: (profile: ProfileResponse, user: AuthUser) => void) => () => void
  /** Called once by other providers on mount to register their sign-out reset logic */
  registerSignOutCleanup: (fn: () => void) => () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [currentView, setCurrentView] = useState<View>("landing")
  const [navDirection, setNavDirection] = useState<"forward" | "back">("forward")

  const currentViewRef = useRef<View>("landing")
  const userRef = useRef<AuthUser | null>(null)
  useEffect(() => { userRef.current = user }, [user])

  const [isPasswordRecovery] = useState(false)
  const setIsPasswordRecovery = (_v: boolean) => { /* no-op: not supported by auth-service */ }

  const hydrateCallbacks = useRef<Set<(profile: ProfileResponse, user: AuthUser) => void>>(new Set())
  const signOutCallbacks = useRef<Set<() => void>>(new Set())

  const registerAuthHydrate = (fn: (profile: ProfileResponse, user: AuthUser) => void) => {
    hydrateCallbacks.current.add(fn)
    return () => hydrateCallbacks.current.delete(fn)
  }

  const registerSignOutCleanup = (fn: () => void) => {
    signOutCallbacks.current.add(fn)
    return () => signOutCallbacks.current.delete(fn)
  }

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

  // ── Auth init on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)

      // Captura token OAuth2 devuelto por el success handler del auth-service
      const oauthToken = urlParams.get("oauth_token")
      if (oauthToken) {
        setToken(oauthToken)
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    const token = getToken()
    if (!token) {
      setLoadingAuth(false)
      return
    }

    apiRequest<ProfileResponse>("/api/auth/profile")
      .then((profile) => {
        const authUser: AuthUser = { id: profile.userId, email: profile.email }
        hydrateCallbacks.current.forEach(cb => cb(profile, authUser))
        setUser(authUser)
        const saved = sessionStorage.getItem("bb_view") as View | null
        setView(saved && AUTHENTICATED_VIEWS.includes(saved) ? saved : "dashboard")
      })
      .catch(() => {
        removeToken()
      })
      .finally(() => setLoadingAuth(false))
   
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────────
  const signOut = () => {
    signOutCallbacks.current.forEach(cb => cb())
    sessionStorage.removeItem("bb_view")
    sessionStorage.removeItem("bb_chat_messages")
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setView("landing", true)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loadingAuth,
      signOut,
      isPasswordRecovery,
      setIsPasswordRecovery,
      currentView,
      setView,
      navDirection,
      registerAuthHydrate,
      registerSignOutCleanup,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

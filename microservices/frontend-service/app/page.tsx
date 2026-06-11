"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { AppProvider } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { LandingPage } from "@/components/landing-page"
import { AuthPage } from "@/components/auth-page"
import { BiometricLock } from "@/components/biometric-lock"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { DashboardSkeleton } from "@/components/dashboard/skeleton"
import { toast } from "sonner"

// Code-split heavy pages — only load the JS chunk when the view is active
const DashboardPage = dynamic(
  () => import("@/components/dashboard-page").then((m) => ({ default: m.DashboardPage })),
  { ssr: false, loading: () => <DashboardSkeleton /> }
)
const SettingsPage = dynamic(
  () => import("@/components/settings-page").then((m) => ({ default: m.SettingsPage })),
  { ssr: false }
)
const ProfilePage = dynamic(
  () => import("@/components/profile-page").then((m) => ({ default: m.ProfilePage })),
  { ssr: false }
)
const AnalyticsPage = dynamic(
  () => import("@/components/analytics-page").then((m) => ({ default: m.AnalyticsPage })),
  { ssr: false }
)

function AppRouter() {
  const { currentView, loadingAuth, user, navDirection } = useAuth()
  // Always start false to match SSR; updated client-side in useEffect to avoid #418 hydration error
  const [locked, setLocked] = useState(false)
  const [hadSession, setHadSession] = useState(false)

  useEffect(() => {
    // Read localStorage/sessionStorage only after mount (client-only, no SSR mismatch)
    setLocked(
      localStorage.getItem("bb_biometric_enabled") === "true" &&
      !!localStorage.getItem("bb_biometric_credential_id") &&
      sessionStorage.getItem("bb_unlocked") !== "true"
    )
    setHadSession(
      ["dashboard", "settings", "profile", "analytics"].includes(
        sessionStorage.getItem("bb_view") ?? ""
      )
    )
  }, [])

  useEffect(() => {
    if (!loadingAuth && !user) setLocked(false)
  }, [loadingAuth, user])

  // Toast hint when user swipes back from dashboard (first press of double-back-to-exit)
  useEffect(() => {
    const handler = () => toast("Deslizá de nuevo para salir", { duration: 2000, id: "exit-hint" })
    window.addEventListener("bb_exit_hint", handler)
    return () => window.removeEventListener("bb_exit_hint", handler)
  }, [])

  if (loadingAuth) {
    if (hadSession) return <DashboardSkeleton />
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </motion.div>
      </div>
    )
  }

  if (locked && user) return <BiometricLock onUnlock={() => setLocked(false)} />

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        initial={navDirection === "back" ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="min-h-screen"
      >
        {currentView === "landing" && <LandingPage />}
        {currentView === "auth" && <AuthPage />}
        {currentView === "settings" && <SettingsPage />}
        {currentView === "dashboard" && <DashboardPage />}
        {currentView === "profile" && <ProfilePage />}
        {currentView === "analytics" && <AnalyticsPage />}
      </motion.div>
    </AnimatePresence>
  )
}

export default function Home() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  )
}

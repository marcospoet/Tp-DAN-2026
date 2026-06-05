"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Fingerprint, Wallet, KeyRound, Loader2 } from "lucide-react"
import { useBiometric } from "@/hooks/use-biometric"
import { useApp } from "@/lib/app-context"

interface BiometricLockProps {
  onUnlock: () => void
}

export function BiometricLock({ onUnlock }: BiometricLockProps) {
  const { authenticate } = useBiometric()
  const { signOut } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBiometric = async () => {
    setLoading(true)
    setError(null)
    try {
      const ok = await authenticate()
      if (ok) {
        sessionStorage.setItem("bb_unlocked", "true")
        onUnlock()
      } else {
        setError("No se pudo verificar la identidad. Intentá de nuevo.")
      }
    } catch {
      setError("Error al autenticar. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        className="flex flex-col items-center gap-6 w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">BudgetBuddy</h1>
          <p className="text-sm text-muted-foreground text-center">
            Verificá tu identidad para continuar
          </p>
        </div>

        <motion.button
          type="button"
          onClick={handleBiometric}
          disabled={loading}
          className="flex flex-col items-center gap-3 w-full py-8 rounded-2xl border border-border bg-card hover:bg-secondary/50 transition-colors cursor-pointer disabled:opacity-50"
          whileTap={{ scale: 0.97 }}
        >
          {loading
            ? <Loader2 className="w-10 h-10 text-primary animate-spin" />
            : <Fingerprint className="w-10 h-10 text-primary" />}
          <span className="text-sm font-medium text-foreground">
            {loading ? "Verificando..." : "Desbloquear con biometría"}
          </span>
          <span className="text-xs text-muted-foreground">Face ID · Touch ID · Huella dactilar</span>
        </motion.button>

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Usar contraseña
        </button>
      </motion.div>
    </div>
  )
}

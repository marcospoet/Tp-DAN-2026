"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Wallet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/lib/app-context"
import { apiRequest, setToken } from "@/lib/api-client"
import { toast } from "sonner"

type Mode = "login" | "register"

interface AuthResponse {
  token: string
  userId: string
  email: string
}

export function AuthPage() {
  const { setView } = useApp()

  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const clearMessages = () => {
    setError(null)
    setSuccessMsg(null)
  }

  const switchMode = (next: Mode) => {
    clearMessages()
    setName("")
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setMode(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()

    if (!email.trim() || !password.trim()) {
      setError("Completá todos los campos.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("El email no tiene un formato válido.")
      return
    }
    if (mode === "register" && name.trim().length > 50) {
      setError("El nombre no puede tener más de 50 caracteres.")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    setLoading(true)
    try {
      if (mode === "login") {
        const res = await apiRequest<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        })
        setToken(res.token)
        toast.success("¡Bienvenido de vuelta!", { description: email.trim() })
        // Reload the page so AppProvider re-initialises with the new token
        window.location.reload()
      } else {
        const res = await apiRequest<AuthResponse>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
            userName: name.trim() || undefined,
          }),
        })
        setToken(res.token)
        toast.success("¡Cuenta creada!", { description: `Bienvenido${name.trim() ? `, ${name.trim()}` : ""}` })
        window.location.reload()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error."
      if (msg.includes("already") || msg.includes("registrado") || msg.includes("409")) {
        setError("Ya existe una cuenta con ese email.")
      } else if (msg.includes("401") || msg.includes("credentials") || msg.includes("incorrecta")) {
        setError("Email o contraseña incorrectos.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Shared feedback block ───────────────────────────────────────────────────
  const FeedbackBlock = () => (
    <AnimatePresence mode="wait">
      {error && (
        <motion.div
          key="error"
          className="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive leading-snug">{error}</p>
        </motion.div>
      )}
      {successMsg && (
        <motion.div
          key="success"
          className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-500 leading-snug">{successMsg}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/3 w-[400px] h-[300px] rounded-full bg-accent/5 blur-[100px]" />

      <motion.button
        className="fixed z-50 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        style={{ top: "max(1.5rem, env(safe-area-inset-top))", left: "max(1.5rem, env(safe-area-inset-left))" }}
        onClick={() => setView("landing")}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Volver</span>
      </motion.button>

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="glass rounded-2xl border border-border p-8">

          {/* ── Logo ─────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
              <Wallet className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Inicia sesion para continuar" : "Registrate para empezar a trackear"}
            </p>
          </div>

          {/* ── Login / Register form ─────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              initial={{ opacity: 0, x: mode === "register" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Name field — only on signup */}
              <AnimatePresence initial={false}>
                {mode === "register" && (
                  <motion.div
                    className="flex flex-col gap-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Label htmlFor="name" className="text-sm text-muted-foreground">
                      Tu nombre
                    </Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Juan García"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
                        disabled={loading}
                        autoComplete="name"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
                    disabled={loading}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <FeedbackBlock />

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold rounded-xl cursor-pointer mt-1"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === "login" ? (
                  "Iniciar sesion"
                ) : (
                  "Crear cuenta"
                )}
              </Button>
            </motion.form>
          </AnimatePresence>

          {/* Switch mode link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? "No tienes cuenta? " : "Ya tienes cuenta? "}
            <button
              type="button"
              className="text-primary hover:underline font-medium cursor-pointer"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Registrate" : "Inicia sesion"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

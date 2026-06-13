"use client"

import { useEffect, useState } from "react"
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
import { PENDING_VERIFY_KEY, useAuth } from "@/lib/auth-context"
import { apiRequest, removeToken, setToken } from "@/lib/api-client"
import { toast } from "sonner"

type Mode = "login" | "register" | "verify"

interface AuthResponse {
  token: string
  userId: string
  email: string
  emailVerified: boolean
}

// SVG inline para evitar dependencias externas
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

export function AuthPage() {
  const { setView } = useAuth()

  // Si quedó una verificación pendiente (login o recarga sin verificar), arrancar en esa pantalla
  const pendingVerifyEmail =
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_VERIFY_KEY) : null

  const [mode, setMode] = useState<Mode>(pendingVerifyEmail ? "verify" : "login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState(pendingVerifyEmail ?? "")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const clearMessages = () => {
    setError(null)
    setSuccessMsg(null)
  }

  // Cuenta regresiva del cooldown de reenvío (1 tick por segundo)
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  const formatCooldown = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  const switchMode = (next: Mode) => {
    clearMessages()
    setName("")
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setMode(next)
  }

  const handleOAuth = (provider: "google" | "github") => {
    setOauthLoading(provider)
    const oauthBase = (window as { __OAUTH_URL__?: string }).__OAUTH_URL__ || "http://localhost:8080"
    window.location.href = `${oauthBase}/oauth2/authorization/${provider}`
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
    if (mode === "register" && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.")
      return
    }
    if (mode === "login" && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
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
        if (!res.emailVerified) {
          // Cuenta sin verificar: no entra hasta ingresar el código
          sessionStorage.setItem(PENDING_VERIFY_KEY, email.trim())
          toast.info("Verificá tu email para continuar", { description: email.trim() })
          setMode("verify")
          return
        }
        toast.success("¡Bienvenido de vuelta!", { description: email.trim() })
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
        sessionStorage.setItem(PENDING_VERIFY_KEY, email.trim())
        toast.success("¡Cuenta creada!", { description: `Bienvenido${name.trim() ? `, ${name.trim()}` : ""}` })
        // No recargamos: pasamos a la pantalla de verificación con la sesión ya activa
        setResendCooldown(120)
        setMode("verify")
      }
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      const msg = err instanceof Error ? err.message : "Ocurrió un error."

      if (mode === "register") {
        if (status === 409) {
          setError("Ya existe una cuenta con ese email.")
        } else if (status === 400) {
          setError(msg.startsWith("HTTP ") ? "Datos inválidos. Revisá el formulario." : msg)
        } else {
          setError("No se pudo crear la cuenta. Intentá de nuevo.")
        }
      } else {
        if (status === 401 || status === 403) {
          setError("Email o contraseña incorrectos.")
        } else {
          setError("Ocurrió un error inesperado. Intentá de nuevo.")
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()

    if (!/^\d{6}$/.test(code)) {
      setError("Ingresá el código de 6 dígitos que te enviamos por email.")
      return
    }

    setLoading(true)
    try {
      await apiRequest("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code }),
      })
      sessionStorage.removeItem(PENDING_VERIFY_KEY)
      toast.success("¡Email verificado!", { description: "Tu cuenta está completamente activa." })
      window.location.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      setError(msg && !msg.startsWith("HTTP ") ? msg : "Código inválido o expirado.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    clearMessages()
    setResending(true)
    try {
      await apiRequest("/api/auth/resend-verification", { method: "POST" })
      setCode("")
      setResendCooldown(120)
      setSuccessMsg("Te enviamos un código nuevo. Revisá tu casilla.")
    } catch {
      setError("No se pudo reenviar el código. Intentá de nuevo en unos minutos.")
    } finally {
      setResending(false)
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
        onClick={() => {
          // Si se abandona una verificación pendiente, no debe quedar "pegada":
          // de lo contrario, al volver a /auth para registrar/loguear OTRA
          // cuenta, pendingVerifyEmail seguiría apuntando a la cuenta anterior.
          if (mode === "verify") {
            removeToken()
            sessionStorage.removeItem(PENDING_VERIFY_KEY)
          }
          setView("landing")
        }}
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
              {mode === "login" ? "Bienvenido de vuelta" : mode === "register" ? "Crea tu cuenta" : "Verificá tu email"}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {mode === "login"
                ? "Inicia sesion para continuar"
                : mode === "register"
                ? "Registrate para empezar a trackear"
                : <>Te enviamos un código de 6 dígitos a <span className="text-foreground font-medium">{email.trim()}</span></>}
            </p>
          </div>

          {/* ── OAuth buttons ─────────────────────────────────── */}
          {mode !== "verify" && (
          <>
          <div className="flex flex-col gap-2 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-border bg-secondary/30 hover:bg-secondary/60 gap-2.5 font-medium cursor-pointer"
              onClick={() => handleOAuth("google")}
              disabled={oauthLoading !== null || loading}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continuar con Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-border bg-secondary/30 hover:bg-secondary/60 gap-2.5 font-medium cursor-pointer"
              onClick={() => handleOAuth("github")}
              disabled={oauthLoading !== null || loading}
            >
              {oauthLoading === "github" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GitHubIcon />
              )}
              Continuar con GitHub
            </Button>
          </div>

          {/* ── Divisor ──────────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">o continúa con email</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          </>
          )}

          {/* ── Verification code form ───────────────────────── */}
          {mode === "verify" ? (
          <motion.form
            onSubmit={handleVerify}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="code" className="text-sm text-muted-foreground">
                Código de verificación
              </Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/40 h-14 text-center text-2xl font-semibold tracking-[0.5em]"
                disabled={loading}
                autoFocus
              />
            </div>

            <FeedbackBlock />

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold rounded-xl cursor-pointer mt-1"
              disabled={loading || code.length !== 6}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
            </Button>

            <div className="flex items-center justify-between mt-1">
              <button
                type="button"
                className="text-sm text-primary hover:underline font-medium cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-default"
                onClick={handleResend}
                disabled={resending || loading || resendCooldown > 0}
              >
                {resending
                  ? "Enviando..."
                  : resendCooldown > 0
                  ? `Reenviar en ${formatCooldown(resendCooldown)}`
                  : "Reenviar código"}
              </button>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={() => {
                  removeToken()
                  sessionStorage.removeItem(PENDING_VERIFY_KEY)
                  switchMode("login")
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </motion.form>
          ) : (
          <>
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
                    placeholder={mode === "register" ? "Min. 8 car., mayúscula y número" : "Tu contraseña"}
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
          </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

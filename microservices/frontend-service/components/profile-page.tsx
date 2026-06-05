"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useApp } from "@/lib/app-context"
import { apiRequest } from "@/lib/api-client"

export function ProfilePage() {
  const { setView, userName, setUserName, saveProfile, user } = useApp()
  const [localName, setLocalName] = useState(userName)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savedName, setSavedName] = useState(false)
  const [savedPassword, setSavedPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handleSaveName = async () => {
    if (!localName.trim()) return
    const newName = localName.trim().slice(0, 50)
    setUserName(newName)
    await saveProfile({ userName: newName })
    setSavedName(true)
    setTimeout(() => setSavedName(false), 2000)
  }

  const handleSavePassword = async () => {
    setPasswordError("")
    if (newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.")
      return
    }

    setPasswordLoading(true)
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setSavedPassword(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setSavedPassword(false), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error."
      setPasswordError(msg.includes("incorrecta") || msg.includes("400")
        ? "La contraseña actual es incorrecta."
        : msg)
    } finally {
      setPasswordLoading(false)
    }
  }

  const initials = localName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U"
  const avatarUrl: string | null = null

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />

      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
      >
        <motion.button
          type="button"
          onClick={() => setView("dashboard")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Dashboard</span>
        </motion.button>
        <div className="flex items-center gap-2 ml-1">
          <User className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Mi Perfil</span>
        </div>
      </header>

      <motion.div
        className="flex-1 px-6 py-6 w-full max-w-lg mx-auto"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="glass rounded-2xl border border-border p-8">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <Avatar className="w-16 h-16">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={localName} referrerPolicy="no-referrer" />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground text-center">
              Administrá tu nombre y contraseña
            </p>
          </div>

          {/* Name Section */}
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="w-4 h-4 text-muted-foreground" />
              Nombre
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profileName" className="sr-only">
                Nombre
              </Label>
              <Input
                id="profileName"
                type="text"
                placeholder="Tu nombre"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
              />
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-semibold rounded-xl cursor-pointer"
                onClick={handleSaveName}
                disabled={!localName.trim() || localName.trim() === userName}
              >
                {savedName ? (
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> Guardado
                  </span>
                ) : (
                  "Guardar nombre"
                )}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mb-8" />

          {/* Password Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Cambiar contraseña
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currentPw" className="text-xs text-muted-foreground">
                  Contraseña actual
                </Label>
                <div className="relative">
                  <Input
                    id="currentPw"
                    type={showCurrent ? "text" : "password"}
                    placeholder="Tu contraseña actual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showCurrent ? "Ocultar" : "Mostrar"}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPw" className="text-xs text-muted-foreground">
                  Nueva contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="newPw"
                    type={showNew ? "text" : "password"}
                    placeholder="Mín. 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showNew ? "Ocultar" : "Mostrar"}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPw" className="text-xs text-muted-foreground">
                  Confirmá la nueva contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPw"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repetí la nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground/50 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showConfirm ? "Ocultar" : "Mostrar"}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {passwordError && (
                <motion.div
                  className="flex items-center gap-2 text-sm text-destructive"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {passwordError}
                </motion.div>
              )}

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-semibold rounded-xl cursor-pointer mt-1"
                onClick={handleSavePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || passwordLoading}
              >
                {savedPassword ? (
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> Contraseña actualizada
                  </span>
                ) : passwordLoading ? (
                  "Verificando..."
                ) : (
                  "Cambiar contraseña"
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

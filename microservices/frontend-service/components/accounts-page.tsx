"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Plus, Pencil, Trash2, ArrowRightLeft,
  Banknote, Landmark, Smartphone, TrendingUp, Wallet,
  X, AlertCircle,
} from "lucide-react"
import { useApp } from "@/lib/app-context"
import type { Account, AccountType } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const TYPE_CONFIG: Record<AccountType, { label: string; Icon: React.ElementType; defaultColor: string; defaultIcon: string }> = {
  cash:        { label: "Efectivo",      Icon: Banknote,   defaultColor: "#16a34a", defaultIcon: "Banknote" },
  bank:        { label: "Banco",         Icon: Landmark,   defaultColor: "#2563eb", defaultIcon: "Landmark" },
  mercadopago: { label: "MercadoPago",   Icon: Smartphone, defaultColor: "#009ee3", defaultIcon: "Smartphone" },
  crypto:      { label: "Cripto",        Icon: TrendingUp, defaultColor: "#d97706", defaultIcon: "TrendingUp" },
  custom:      { label: "Personalizada", Icon: Wallet,     defaultColor: "#7c3aed", defaultIcon: "Wallet" },
}

const COLOR_PRESETS = [
  "#16a34a", "#2563eb", "#009ee3", "#d97706", "#7c3aed",
  "#dc2626", "#0891b2", "#db2777", "#059669", "#9333ea",
]

function fmtArs(n: number): string {
  if (Math.abs(n) >= 1_000_000) return String.fromCharCode(36) + (n / 1_000_000).toFixed(2) + "M"
  if (Math.abs(n) >= 1_000)     return String.fromCharCode(36) + (n / 1_000).toFixed(0) + "K"
  return String.fromCharCode(36) + Math.round(n).toLocaleString("es-AR")
}

const BLANK: Omit<Account, "id" | "createdAt"> = {
  name: "", type: "cash", color: "#16a34a", icon: "Banknote", currency: "ARS",
}
export function AccountsPage() {
  const {
    setView, accounts, addAccount, updateAccount, deleteAccount,
    createTransfer, transactions, usdRate,
  } = useApp()

  const [showForm, setShowForm]         = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [formError, setFormError]       = useState("")
  const [saving, setSaving]             = useState(false)
  const [form, setForm] = useState<Omit<Account, "id" | "createdAt">>(BLANK)

  const [txFrom, setTxFrom]         = useState("")
  const [txTo, setTxTo]             = useState("")
  const [txAmount, setTxAmount]     = useState("")
  const [txCurrency, setTxCurrency] = useState<"ARS" | "USD">("ARS")
  const [txNote, setTxNote]         = useState("")
  const [txSaving, setTxSaving]     = useState(false)
  const [txError, setTxError]       = useState("")

  const toArs = (tx: { amount: number; currency: "ARS" | "USD"; txRate?: number }) =>
    tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount

  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {}
    accounts.forEach(a => { map[a.id] = 0 })
    transactions.forEach(tx => {
      if (!tx.accountId || !(tx.accountId in map)) return
      const val = toArs(tx)
      map[tx.accountId] += tx.type === "income" ? val : -val
    })
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions, usdRate])

  const totalBalance = Object.values(balanceMap).reduce((a, b) => a + b, 0)
  const openCreate = () => {
    setEditingId(null)
    setForm(BLANK)
    setFormError("")
    setShowForm(true)
  }

  const openEdit = (acc: Account) => {
    setEditingId(acc.id)
    setForm({ name: acc.name, type: acc.type, color: acc.color, icon: acc.icon, currency: acc.currency })
    setFormError("")
    setShowForm(true)
  }

  const handleTypeChange = (type: AccountType) => {
    const cfg = TYPE_CONFIG[type]
    setForm(f => ({ ...f, type, color: cfg.defaultColor, icon: cfg.defaultIcon }))
  }

  const handleSaveAccount = async () => {
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }
    setSaving(true)
    setFormError("")
    if (editingId) {
      await updateAccount(editingId, form, (msg) => setFormError(msg))
    } else {
      await addAccount(form, (msg) => setFormError(msg))
    }
    setSaving(false)
    if (!formError) setShowForm(false)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    await deleteAccount(deletingId)
    setDeletingId(null)
  }

  const handleTransfer = async () => {
    if (!txFrom || !txTo) { setTxError("Selecioná las cuentas."); return }
    if (txFrom === txTo)  { setTxError("Las cuentas deben ser distintas."); return }
    const amount = parseFloat(txAmount)
    if (!amount || amount <= 0) { setTxError("Ingresá un monto válido."); return }
    setTxSaving(true)
    setTxError("")
    await createTransfer(
      { fromAccountId: txFrom, toAccountId: txTo, amount, currency: txCurrency, date: new Date(), note: txNote || undefined },
      (msg) => setTxError(msg)
    )
    setTxSaving(false)
    if (!txError) {
      setShowTransfer(false)
      setTxFrom(""); setTxTo(""); setTxAmount(""); setTxNote("")
    }
  }
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6 border-b border-border bg-background">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Cuentas</span>
        </div>
        <button
          type="button"
          onClick={() => setShowTransfer(true)}
          disabled={accounts.length < 2}
          className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Transferir
        </button>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6 max-w-2xl mx-auto w-full pb-24 flex flex-col gap-4">
        <motion.div
          className="rounded-2xl border border-border bg-card p-5 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Saldo total (ARS)</p>
          <p className={"text-3xl font-bold tabular-nums " + (totalBalance >= 0 ? "text-primary" : "text-destructive")}>
            {totalBalance >= 0 ? "" : "−"}{fmtArs(Math.abs(totalBalance))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{accounts.length} cuenta{accounts.length !== 1 ? "s" : ""}</p>
        </motion.div>

        {accounts.length === 0 ? (
          <motion.div
            className="rounded-2xl border border-dashed border-border p-10 text-center flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Wallet className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Aún no tenés cuentas creadas.</p>
            <Button size="sm" onClick={openCreate} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" /> Crear primera cuenta
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {accounts.map((acc) => {
                const cfg = TYPE_CONFIG[acc.type]
                const bal = balanceMap[acc.id] ?? 0
                return (
                  <motion.div
                    key={acc.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3"
                    style={{ borderLeftColor: acc.color, borderLeftWidth: 3 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: acc.color + "20" }}
                        >
                          <cfg.Icon className="w-4 h-4" style={{ color: acc.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(acc)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(acc.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className={"text-xl font-bold tabular-nums " + (bal >= 0 ? "text-foreground" : "text-destructive")}>
                          {bal < 0 && "−"}{fmtArs(Math.abs(bal))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{acc.currency}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {transactions.filter(t => t.accountId === acc.id).length} movimientos
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {accounts.length > 0 && (
          <motion.button
            type="button"
            onClick={openCreate}
            className="w-full rounded-2xl border border-dashed border-border bg-secondary/20 hover:bg-secondary/40 transition-colors py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <Plus className="w-4 h-4" />
            Agregar cuenta
          </motion.button>
        )}
      </main>

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl border-t border-border p-6 pb-8 flex flex-col gap-5 max-h-[90vh] overflow-y-auto sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{editingId ? "Editar cuenta" : "Nueva cuenta"}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input
                  placeholder="Ej: Cuenta corriente Galicia"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="h-11 bg-secondary/50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.keys(TYPE_CONFIG) as AccountType[]).map(type => {
                    const cfg = TYPE_CONFIG[type]
                    const isSelected = form.type === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleTypeChange(type)}
                        className={"flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-[10px] font-medium transition-all cursor-pointer " + (isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60")}
                      >
                        <cfg.Icon className="w-4 h-4" />
                        {cfg.label.split(" ")[0]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: col }))}
                      className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer"
                      style={{ background: col, borderColor: form.color === col ? "white" : "transparent", boxShadow: form.color === col ? "0 0 0 2px " + col : "none" }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Moneda base</Label>
                <div className="flex gap-2">
                  {(["ARS", "USD"] as const).map(cur => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, currency: cur }))}
                      className={"flex-1 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer " + (form.currency === cur ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50")}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formError}
                </p>
              )}

              <Button onClick={handleSaveAccount} disabled={saving} className="w-full h-11 cursor-pointer">
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cuenta"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingId(null)} />
            <motion.div
              className="fixed inset-x-4 bottom-8 z-50 bg-card rounded-2xl border border-border p-6 flex flex-col gap-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Eliminar cuenta</p>
                  <p className="text-xs text-muted-foreground">Los movimientos quedarán sin cuenta asignada.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setDeletingId(null)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1 cursor-pointer" onClick={handleDelete}>Eliminar</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTransfer && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTransfer(false)} />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl border-t border-border p-6 pb-8 flex flex-col gap-4 max-h-[90vh] overflow-y-auto sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold">Transferencia</h2>
                </div>
                <button type="button" onClick={() => setShowTransfer(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <select
                  value={txFrom}
                  onChange={e => setTxFrom(e.target.value)}
                  className="h-11 rounded-xl border border-border bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/40 cursor-pointer"
                >
                  <option value="">Selecioná cuenta origen</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Hacia</Label>
                <select
                  value={txTo}
                  onChange={e => setTxTo(e.target.value)}
                  className="h-11 rounded-xl border border-border bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/40 cursor-pointer"
                >
                  <option value="">Selecioná cuenta destino</option>
                  {accounts.filter(a => a.id !== txFrom).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Monto</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    className="h-11 bg-secondary/50 tabular-nums"
                    min={0}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Moneda</Label>
                  <div className="flex gap-1">
                    {(["ARS", "USD"] as const).map(cur => (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => setTxCurrency(cur)}
                        className={"h-11 px-3 rounded-xl border text-sm font-medium transition-all cursor-pointer " + (txCurrency === cur ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground")}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Nota (opcional)</Label>
                <Input
                  placeholder="Ej: recarga MercadoPago"
                  value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  className="h-11 bg-secondary/50"
                />
              </div>

              {txError && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {txError}
                </p>
              )}

              <Button onClick={handleTransfer} disabled={txSaving} className="w-full h-11 gap-2 cursor-pointer">
                <ArrowRightLeft className="w-4 h-4" />
                {txSaving ? "Transfiriendo..." : "Confirmar transferencia"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

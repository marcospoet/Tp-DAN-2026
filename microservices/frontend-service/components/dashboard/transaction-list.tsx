"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Pencil, Trash2, ChevronDown, ChevronUp, ChevronRight,
  Search, StickyNote, ShoppingCart, Wallet, Sparkles, FileUp, Loader2, Plus,
  CalendarClock, Clock,
} from "lucide-react"
// Note: X still used by search clear button; Pencil/Trash2 used by desktop hover buttons
import { SwipeCard } from "./swipe-card"
import { ReceiptImage } from "./receipt-image"
import { ExchangeTypeBadge } from "./exchange-type-badge"
import { iconMap, formatDate, VALID_CATEGORIES, CATEGORY_ICON_MAP } from "./shared"
import type { Transaction, TimeFilter } from "@/lib/app-context"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const TX_PAGE = 6

// ── Scroll-up detector ────────────────────────────────────────────────────────
function useScrollUp(threshold = 320) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    const handler = () => {
      const y = window.scrollY
      setShow(y > threshold && y < lastY)
      lastY = y
    }
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [threshold])
  return show
}

// ── Date separator helpers ────────────────────────────────────────────────────
function getDateLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Hoy"
  if (diffDays === 1) return "Ayer"
  if (diffDays < 7) {
    const name = date.toLocaleDateString("es-AR", { weekday: "long" })
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

type ListItem =
  | { kind: "separator"; label: string; key: string }
  | { kind: "tx"; tx: Transaction }

interface TransactionListProps {
  filteredTransactions: Transaction[]
  displayedTransactions: Transaction[]
  visibleTransactions: Transaction[]
  hasMoreTx: boolean
  showAllTx: boolean
  setShowAllTx: React.Dispatch<React.SetStateAction<boolean>>
  searchQuery: string
  setSearchQuery: (q: string) => void
  expandedTx: string | null
  setExpandedTx: (id: string | null) => void
  dragActiveRef: React.MutableRefObject<boolean>
  usdRate: number
  openEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  lastModifiedTxId?: string | null
  timeFilter: TimeFilter
  totalTransactions: number
  onCategoryChange: (tx: Transaction, category: string, icon: string) => void
  onImportCSV: () => void
  isLoadingHistory?: boolean
  hasMoreTransactions?: boolean
  onLoadMoreHistory?: () => void
  activeCategoryFilter?: string | null
  onClearCategoryFilter?: () => void
  futureTransactions?: Transaction[]
}

export function TransactionList({
  filteredTransactions,
  displayedTransactions,
  visibleTransactions,
  hasMoreTx,
  showAllTx,
  setShowAllTx,
  searchQuery,
  setSearchQuery,
  expandedTx,
  setExpandedTx,
  dragActiveRef,
  usdRate,
  openEdit,
  onDelete,
  lastModifiedTxId,
  timeFilter,
  totalTransactions,
  onCategoryChange,
  onImportCSV,
  isLoadingHistory,
  hasMoreTransactions,
  onLoadMoreHistory,
  activeCategoryFilter,
  onClearCategoryFilter,
  futureTransactions = [],
}: TransactionListProps) {
  const showScrollTop = useScrollUp()
  const [categoryPickerTxId, setCategoryPickerTxId] = useState<string | null>(null)
  const [categorySearch, setCategorySearch] = useState("")
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem("bb_custom_categories") ?? "[]") } catch { return [] }
  })
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; txId: string } | null>(null)

  // ── Future transactions panel ─────────────────────────────────────────────
  const [showFuture, setShowFuture] = useState(false)
  const [futureAutoMode, setFutureAutoMode] = useState(false)
  const futureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFutureCountRef = useRef(futureTransactions.length)

  useEffect(() => {
    const curr = futureTransactions.length
    if (curr > prevFutureCountRef.current) {
      // New future tx added → auto-open with timer
      setShowFuture(true)
      setFutureAutoMode(true)
      if (futureTimerRef.current) clearTimeout(futureTimerRef.current)
      futureTimerRef.current = setTimeout(() => {
        setShowFuture(false)
        setFutureAutoMode(false)
      }, 5000)
    }
    prevFutureCountRef.current = curr
  }, [futureTransactions.length])

  useEffect(() => () => { if (futureTimerRef.current) clearTimeout(futureTimerRef.current) }, [])

  const allCategories = useMemo(() => [...VALID_CATEGORIES, ...customCategories], [customCategories])
  const filteredCategoryChips = useMemo(() => {
    const s = categorySearch.toLowerCase().trim()
    return s ? allCategories.filter(c => c.toLowerCase().includes(s)) : allCategories
  }, [allCategories, categorySearch])
  const isNewCategorySearch = categorySearch.trim().length > 0 &&
    !allCategories.some(c => c.toLowerCase() === categorySearch.toLowerCase().trim())

  // Build flat list with date separators
  const items = useMemo<ListItem[]>(() => {
    const result: ListItem[] = []
    let lastKey = ""
    for (const tx of visibleTransactions) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (key !== lastKey) {
        lastKey = key
        result.push({ kind: "separator", label: getDateLabel(d), key: `sep-${key}` })
      }
      result.push({ kind: "tx", tx })
    }
    return result
  }, [visibleTransactions])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      {/* Header row */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Movimientos{" "}
              {searchQuery.trim()
                ? `(${displayedTransactions.length} de ${filteredTransactions.length})`
                : `(${filteredTransactions.length})`}
            </p>
            {activeCategoryFilter && (
              <button
                type="button"
                onClick={onClearCategoryFilter}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors cursor-pointer"
              >
                {activeCategoryFilter}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filteredTransactions.length > 0 && (
              <p className="md:hidden text-[10px] text-muted-foreground/50">
                Deslizá para editar o eliminar
              </p>
            )}
            <button
              type="button"
              onClick={onImportCSV}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar CSV
            </button>
          </div>
        </div>

        {filteredTransactions.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por descripción o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state — no transactions in period */}
      {filteredTransactions.length === 0 ? (
        <motion.div
          className="flex flex-col items-center gap-4 py-16 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary">
            {totalTransactions === 0
              ? <Sparkles className="w-7 h-7 text-primary/50" />
              : <Wallet className="w-7 h-7 text-muted-foreground/40" />
            }
          </div>
          <div>
            {totalTransactions === 0 ? (
              <>
                <p className="text-sm font-semibold text-foreground">¡Empezá a registrar!</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Escribí un gasto, tomá una foto<br />o grabá un audio con la barra de abajo
                </p>
                <button
                  type="button"
                  onClick={onImportCSV}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer mx-auto"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  ¿Tenés un CSV del banco? Importalo
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Sin movimientos{
                  timeFilter === "week" ? " esta semana" :
                  timeFilter === "month" ? " este mes" :
                  timeFilter === "year" ? " este año" : " en el período"
                }</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Probá cambiando el filtro de tiempo<br />o registrá un nuevo movimiento
                </p>
              </>
            )}
          </div>
        </motion.div>

      /* Empty state — search with no results */
      ) : displayedTransactions.length === 0 ? (
        <motion.div
          className="flex flex-col items-center gap-3 py-12 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Search className="w-8 h-8 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin resultados</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No hay movimientos para &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        </motion.div>

      ) : (
        <div className="flex flex-col gap-2">
          {/* ── Future transactions panel ─────────────────────────────── */}
          {futureTransactions.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (futureTimerRef.current) clearTimeout(futureTimerRef.current)
                  futureTimerRef.current = null
                  setShowFuture(v => {
                    if (!v) setFutureAutoMode(false)  // opening manually → permanent mode
                    return !v
                  })
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {futureTransactions.length === 1
                      ? "1 movimiento programado a futuro"
                      : `${futureTransactions.length} movimientos programados a futuro`}
                  </span>
                </div>
                <motion.div animate={{ rotate: showFuture ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {showFuture && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col divide-y divide-border border-t border-border">
                      {futureTransactions.slice(0, 3).map(tx => {
                        const Icon = iconMap[CATEGORY_ICON_MAP[tx.category] ?? "Tag"] || ShoppingCart
                        const isIncome = tx.type === "income"
                        const d = new Date(tx.date)
                        return (
                          <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${isIncome ? "bg-primary/10" : "bg-secondary"}`}>
                              <Icon className={`w-4 h-4 ${isIncome ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · {tx.category}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Clock className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                              <span className={`text-xs font-semibold tabular-nums ${isIncome ? "text-primary" : "text-destructive"}`}>
                                {isIncome ? "+" : "−"}${tx.amount.toLocaleString("es-AR")} {tx.currency}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEdit(tx)}
                                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(tx)}
                                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      {futureTransactions.length > 3 && (
                        <p className="text-center text-[10px] text-muted-foreground/60 py-2">
                          +{futureTransactions.length - 3} más en Analítica
                        </p>
                      )}
                    </div>
                    {/* Auto-collapse progress bar — only in auto mode */}
                    {futureAutoMode && (
                      <motion.div
                        className="h-0.5 bg-primary/40 origin-left"
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        transition={{ duration: 5, ease: "linear" }}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              if (item.kind === "separator") {
                return (
                  <motion.div
                    key={item.key}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-1 pt-2 pb-0.5"
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider whitespace-nowrap">
                      {item.label}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </motion.div>
                )
              }

              const tx = item.tx
              const Icon = iconMap[tx.icon] || ShoppingCart
              const isIncome = tx.type === "income"
              const isExpanded = expandedTx === tx.id
              const isUsd = tx.currency === "USD"

              return (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  className={`group relative rounded-2xl transition-all duration-700 ${lastModifiedTxId === tx.id ? "ring-1 ring-emerald-500/50 bg-emerald-500/5" : ""}`}
                >
                  <SwipeCard
                    onDragStart={() => { dragActiveRef.current = true }}
                    onDragEnd={(swipedLeft, swipedRight) => {
                      setTimeout(() => { dragActiveRef.current = false }, 50)
                      if (swipedLeft) onDelete(tx)
                      else if (swipedRight) openEdit(tx)
                    }}
                  >
                    {/* Card row */}
                    <div
                      className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 hover:bg-secondary/30 active:bg-secondary/50 transition-colors cursor-pointer text-left select-none"
                      onClick={() => { if (dragActiveRef.current) return; setExpandedTx(isExpanded ? null : tx.id) }}
                    >
                      <button
                        type="button"
                        className={`relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform active:scale-90 cursor-pointer group/icon ${isIncome ? "bg-primary/10" : "bg-secondary"} ${categoryPickerTxId === tx.id ? "ring-2 ring-primary/40" : ""}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (dragActiveRef.current) return
                          const opening = categoryPickerTxId !== tx.id
                          setCategoryPickerTxId(opening ? tx.id : null)
                          if (!opening) setCategorySearch("")
                        }}
                        aria-label="Cambiar categoría"
                      >
                        <Icon className={`w-5 h-5 transition-opacity group-hover/icon:opacity-0 ${isIncome ? "text-primary" : "text-muted-foreground"}`} />
                        <Pencil className="w-3.5 h-3.5 absolute opacity-0 group-hover/icon:opacity-100 transition-opacity text-muted-foreground" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{tx.category} · {formatDate(new Date(tx.date), tx.type)}</span>
                          {isUsd && tx.exchangeRateType && (
                            <ExchangeTypeBadge type={tx.exchangeRateType} />
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <span className={`text-sm font-semibold tabular-nums ${isIncome ? "text-primary" : "text-foreground"}`}>
                          {isIncome ? "+" : "−"}{" "}
                          {isUsd
                            ? `US$ ${tx.amount.toLocaleString("es-AR")}`
                            : `$ ${tx.amount.toLocaleString("es-AR")}`}
                        </span>
                        {isUsd && (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            ~${(tx.amount * (tx.txRate ?? usdRate)).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                          </span>
                        )}
                      </div>

                      {/* Desktop action buttons — always visible */}
                      <div className="hidden md:flex items-center gap-0.5 shrink-0 ml-1">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); openEdit(tx) }}
                          aria-label="Editar movimiento"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); onDelete(tx) }}
                          aria-label="Eliminar movimiento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {(tx.observation || tx.receiptUrl) && (
                        <ChevronRight
                          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      )}
                    </div>
                  </SwipeCard>

                  {/* Category picker */}
                  <AnimatePresence>
                    {categoryPickerTxId === tx.id && (
                      <motion.div
                        className="mx-1 mt-1 mb-1 rounded-xl bg-secondary/60 border border-border overflow-hidden"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {/* Search input */}
                        <div className="p-2 pb-1.5">
                          <input
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            placeholder="Buscar o escribir categoría..."
                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/40"
                            onPointerDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        {/* Category chips — horizontal scroll */}
                        <div className="px-2 pb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                          {(categorySearch.trim()
                            ? filteredCategoryChips
                            : [
                                ...(allCategories.includes(tx.category) ? [tx.category] : []),
                                ...filteredCategoryChips.filter(c => c !== tx.category),
                              ]
                          ).map((cat) => {
                            const isCustom = customCategories.includes(cat)
                            const isActive = tx.category === cat
                            return isCustom ? (
                              <div
                                key={cat}
                                className={`flex-none flex items-center rounded-lg border overflow-hidden transition-colors ${
                                  isActive ? "border-primary bg-primary" : "border-border bg-background"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onCategoryChange(tx, cat, CATEGORY_ICON_MAP[cat] ?? "Tag")
                                    setCategoryPickerTxId(null)
                                    setCategorySearch("")
                                  }}
                                  className={`px-3 py-1 text-xs cursor-pointer transition-colors ${
                                    isActive
                                      ? "text-primary-foreground"
                                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  {cat}
                                </button>
                                <div className={`w-px h-3 shrink-0 ${isActive ? "bg-primary-foreground/20" : "bg-border"}`} />
                                <button
                                  type="button"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeletingCategory({ name: cat, txId: tx.id })
                                  }}
                                  className={`px-1.5 py-1 cursor-pointer transition-colors ${
                                    isActive
                                      ? "text-primary-foreground/70 hover:text-primary-foreground"
                                      : "text-muted-foreground/40 hover:text-destructive"
                                  }`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                onCategoryChange(tx, cat, CATEGORY_ICON_MAP[cat] ?? "Tag")
                                setCategoryPickerTxId(null)
                                setCategorySearch("")
                              }}
                              className={`flex-none px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                                tx.category === cat
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              {cat}
                            </button>
                            )
                          })}
                          {isNewCategorySearch && (
                            <button
                              type="button"
                              onClick={() => {
                                const newCat = categorySearch.trim()
                                const updated = [...customCategories, newCat]
                                setCustomCategories(updated)
                                localStorage.setItem("bb_custom_categories", JSON.stringify(updated))
                                onCategoryChange(tx, newCat, "Tag")
                                setCategoryPickerTxId(null)
                                setCategorySearch("")
                              }}
                              className="flex-none px-3 py-1 text-xs rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Crear &ldquo;{categorySearch.trim()}&rdquo;
                            </button>
                          )}
                          {filteredCategoryChips.length === 0 && !isNewCategorySearch && (
                            <p className="flex-none text-xs text-muted-foreground/50 px-1 py-0.5">Sin resultados</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Observation + Receipt expand */}
                  <AnimatePresence>
                    {isExpanded && (tx.observation || tx.receiptUrl) && (
                      <motion.div
                        className="mt-1 mb-1 rounded-xl bg-secondary/50 border border-border overflow-hidden"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {tx.receiptUrl && <ReceiptImage txId={tx.id} />}
                        {tx.observation && (
                          <div className={`px-4 py-2.5${tx.receiptUrl ? " border-t border-border" : ""}`}>
                            <p className="text-xs text-muted-foreground flex items-start gap-2">
                              <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-accent" />
                              {tx.observation}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Ver más / Ver menos */}
          {hasMoreTx && (
            <button
              type="button"
              onClick={() => setShowAllTx(v => !v)}
              className="w-full mt-1 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {showAllTx ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ver {displayedTransactions.length - TX_PAGE} movimientos más
                </>
              )}
            </button>
          )}

          {/* Phase 2 history loading */}
          {isLoadingHistory && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Cargando transacciones anteriores...
            </div>
          )}
          {!isLoadingHistory && hasMoreTransactions && !hasMoreTx && (
            <button
              type="button"
              onClick={onLoadMoreHistory}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cargar transacciones anteriores
            </button>
          )}
        </div>
      )}

      {/* Scroll-to-top — visible only while scrolling up */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed right-4 z-30 w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
            aria-label="Volver al inicio"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Confirm delete custom category */}
      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={(open) => { if (!open) setDeletingCategory(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la categoría &ldquo;{deletingCategory?.name}&rdquo;. Los movimientos que la tengan asignada pasarán a &ldquo;General&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingCategory) return
                const updated = customCategories.filter(c => c !== deletingCategory.name)
                setCustomCategories(updated)
                localStorage.setItem("bb_custom_categories", JSON.stringify(updated))
                // Update the originating transaction (in visible list)
                const affectedTx = visibleTransactions.find(t => t.id === deletingCategory.txId)
                if (affectedTx?.category === deletingCategory.name) {
                  onCategoryChange(affectedTx, "General", "Tag")
                }
                // Also update any future transactions with the same deleted category
                for (const tx of futureTransactions) {
                  if (tx.category === deletingCategory.name) {
                    onCategoryChange(tx, "General", "Tag")
                  }
                }
                setDeletingCategory(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

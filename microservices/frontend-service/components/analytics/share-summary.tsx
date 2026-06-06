"use client"

import { useState, useCallback } from "react"
import { Share2, Loader2 } from "lucide-react"
import type { Transaction } from "@/lib/app-context"

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]
const CAT_COLORS = ["#10b981","#a78bfa","#f59e0b","#60a5fa","#f87171","#34d399","#fb923c"]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString("es-AR")}`
}

// roundRect with fallback for older browsers
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function drawCard(canvas: HTMLCanvasElement, opts: {
  month: number
  year: number
  expenses: number
  income: number
  cats: { name: string; pct: number }[]
}) {
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  const { month, year, expenses, income, cats } = opts

  // ── Background
  ctx.fillStyle = "#08100d"
  ctx.fillRect(0, 0, W, H)

  // Decorative blobs
  const g1 = ctx.createRadialGradient(W * 0.85, 160, 0, W * 0.85, 160, 520)
  g1.addColorStop(0, "rgba(16,185,129,0.13)")
  g1.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)

  const g2 = ctx.createRadialGradient(W * 0.12, H * 0.87, 0, W * 0.12, H * 0.87, 580)
  g2.addColorStop(0, "rgba(139,92,246,0.10)")
  g2.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)

  // ── HEADER ──────────────────────────────────────────────────────────────────
  const HY = 122

  // Logo circle
  ctx.fillStyle = "#10b981"
  ctx.beginPath(); ctx.arc(82, HY, 30, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#08100d"
  ctx.font = "800 34px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("P", 82, HY + 1)

  // App name
  ctx.fillStyle = "#ecfdf5"
  ctx.font = "700 46px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText("Pesito", 130, HY)

  // Month/year badge
  const badgeLabel = `${MONTH_NAMES[month]} ${year}`
  ctx.font = "500 30px system-ui"
  const badgeW = ctx.measureText(badgeLabel).width + 40
  const badgeX = W - 72 - badgeW
  rr(ctx, badgeX, HY - 26, badgeW, 52, 26)
  ctx.fillStyle = "rgba(16,185,129,0.14)"; ctx.fill()
  ctx.strokeStyle = "rgba(16,185,129,0.3)"; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.fillStyle = "#10b981"
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(badgeLabel, badgeX + badgeW / 2, HY)

  // Divider
  const dg = ctx.createLinearGradient(60, 0, W - 60, 0)
  dg.addColorStop(0, "rgba(16,185,129,0)")
  dg.addColorStop(0.5, "rgba(16,185,129,0.22)")
  dg.addColorStop(1, "rgba(16,185,129,0)")
  ctx.strokeStyle = dg; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, 178); ctx.lineTo(W - 60, 178); ctx.stroke()

  // ── HERO EXPENSE ────────────────────────────────────────────────────────────
  let y = 244

  ctx.fillStyle = "rgba(52,211,153,0.7)"
  ctx.font = "600 27px system-ui"
  ctx.textAlign = "left"; ctx.textBaseline = "top"
  ctx.fillText("GASTOS DEL MES", 74, y)
  y += 50

  const expStr = fmt(expenses)
  const fs = expStr.length > 10 ? 100 : expStr.length > 8 ? 116 : 136
  ctx.fillStyle = "#ecfdf5"
  ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = "left"; ctx.textBaseline = "top"
  ctx.fillText(expStr, 68, y)
  y += fs + 14

  ctx.fillStyle = "#3a6650"
  ctx.font = "500 30px system-ui"
  ctx.textAlign = "left"; ctx.textBaseline = "top"
  ctx.fillText("pesos argentinos", 76, y)
  y += 78

  // ── STATS CARDS ─────────────────────────────────────────────────────────────
  {
    const cW = (W - 144 - 20) / 2, cH = 162, cR = 22
    const balance = income - expenses
    const isPos = balance >= 0

    // Income card
    rr(ctx, 72, y, cW, cH, cR)
    ctx.fillStyle = "rgba(52,211,153,0.07)"; ctx.fill()
    ctx.strokeStyle = "rgba(52,211,153,0.2)"; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = "#34d399"
    ctx.font = "500 24px system-ui"
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillText("INGRESOS", 72 + 24, y + 20)
    ctx.fillStyle = "#ecfdf5"
    ctx.font = `700 ${fmt(income).length > 7 ? 44 : 52}px system-ui`
    ctx.fillText(fmt(income), 72 + 24, y + 58)

    // Balance card
    const bx = 72 + cW + 20
    rr(ctx, bx, y, cW, cH, cR)
    ctx.fillStyle = isPos ? "rgba(52,211,153,0.07)" : "rgba(248,113,113,0.07)"; ctx.fill()
    ctx.strokeStyle = isPos ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = isPos ? "#34d399" : "#f87171"
    ctx.font = "500 24px system-ui"
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillText("BALANCE", bx + 24, y + 20)
    ctx.fillStyle = isPos ? "#34d399" : "#f87171"
    ctx.font = `700 ${fmt(Math.abs(balance)).length > 7 ? 44 : 52}px system-ui`
    ctx.fillText((isPos ? "+" : "−") + fmt(Math.abs(balance)), bx + 24, y + 58)

    y += cH + 64
  }

  // ── CATEGORIES ──────────────────────────────────────────────────────────────
  if (cats.length > 0) {
    ctx.fillStyle = "rgba(52,211,153,0.7)"
    ctx.font = "600 27px system-ui"
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillText("TOP CATEGORÍAS", 74, y)
    y += 50

    const barMaxW = W - 144 - 110

    cats.slice(0, 4).forEach((cat, i) => {
      const color = CAT_COLORS[i]

      // Dot
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(90, y + 20, 9, 0, Math.PI * 2); ctx.fill()

      // Name
      ctx.fillStyle = "#ecfdf5"
      ctx.font = "500 34px system-ui"
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillText(cat.name, 116, y + 2)

      // Percentage
      ctx.fillStyle = "#3a6650"
      ctx.font = "600 30px system-ui"
      ctx.textAlign = "right"; ctx.textBaseline = "top"
      ctx.fillText(`${Math.round(cat.pct)}%`, W - 72, y + 4)

      // Bar bg
      const bY = y + 52
      rr(ctx, 72, bY, barMaxW, 10, 5)
      ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fill()

      // Bar fill
      rr(ctx, 72, bY, Math.max(barMaxW * cat.pct / 100, 14), 10, 5)
      ctx.fillStyle = color; ctx.fill()

      y += 90
    })
    y += 24
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  const fY = H - 100

  const fg = ctx.createLinearGradient(60, 0, W - 60, 0)
  fg.addColorStop(0, "rgba(255,255,255,0)")
  fg.addColorStop(0.5, "rgba(255,255,255,0.07)")
  fg.addColorStop(1, "rgba(255,255,255,0)")
  ctx.strokeStyle = fg; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, fY - 24); ctx.lineTo(W - 60, fY - 24); ctx.stroke()

  ctx.fillStyle = "#10b981"
  ctx.beginPath(); ctx.arc(80, fY + 16, 11, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#08100d"
  ctx.font = "bold 14px system-ui"
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("B", 80, fY + 17)

  ctx.fillStyle = "#3a6650"
  ctx.font = "400 28px system-ui"
  ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText("Generado con Pesito", 108, fY + 16)

  ctx.fillStyle = "#243d30"
  ctx.font = "400 24px system-ui"
  ctx.textAlign = "right"; ctx.textBaseline = "middle"
  ctx.fillText("finanzas-budget-buddy.vercel.app", W - 72, fY + 16)
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ShareSummaryProps {
  transactions: Transaction[]
  usdRate: number
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ShareSummary({ transactions, usdRate }: ShareSummaryProps) {
  const [loading, setLoading] = useState(false)

  const toArs = useCallback(
    (tx: Transaction) => tx.currency === "USD" ? tx.amount * (tx.txRate ?? usdRate) : tx.amount,
    [usdRate]
  )

  const handleShare = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      const month = now.getMonth()
      const year = now.getFullYear()

      const monthTxs = transactions.filter(tx => {
        const d = new Date(tx.date)
        return d.getMonth() === month && d.getFullYear() === year
      })

      const expenses = monthTxs
        .filter(tx => tx.type === "expense")
        .reduce((a, tx) => a + toArs(tx), 0)

      const income = monthTxs
        .filter(tx => tx.type === "income")
        .reduce((a, tx) => a + toArs(tx), 0)

      // Top categories
      const catMap = new Map<string, number>()
      monthTxs
        .filter(tx => tx.type === "expense")
        .forEach(tx => {
          const cat = tx.category || "General"
          catMap.set(cat, (catMap.get(cat) ?? 0) + toArs(tx))
        })
      const cats = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, val]) => ({ name, pct: expenses > 0 ? (val / expenses) * 100 : 0 }))

      const canvas = document.createElement("canvas")
      drawCard(canvas, { month, year, expenses, income, cats })

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("canvas toBlob failed")), "image/png")
      })

      const filename = `resumen-${MONTH_NAMES[month].toLowerCase()}-${year}.png`
      const file = new File([blob], filename, { type: "image/png" })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Resumen ${MONTH_NAMES[month]} ${year} · Pesito`,
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      // user cancelled or error — silent
    } finally {
      setLoading(false)
    }
  }, [transactions, usdRate, toArs])

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Share2 className="w-3.5 h-3.5" />
      }
      Compartir
    </button>
  )
}

import type { ExchangeRateType } from "@/lib/app-context"

const RATE_BADGE_CONFIG: Record<ExchangeRateType, { label: string; className: string }> = {
  BLUE:    { label: "Blue",    className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TARJETA: { label: "Tarjeta", className: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  OFICIAL: { label: "Oficial", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  MEP:     { label: "MEP",     className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  MANUAL:  { label: "Manual",  className: "bg-secondary text-muted-foreground border-border" },
}

export function ExchangeTypeBadge({ type }: { type: ExchangeRateType }) {
  const cfg = RATE_BADGE_CONFIG[type]
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

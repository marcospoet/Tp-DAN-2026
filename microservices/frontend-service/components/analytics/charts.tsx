"use client"

// Charts de analytics extraídos a componentes memoizados: Recharts re-renderiza
// SVG completo en cada render del padre, y AnalyticsPage tiene mucho estado de
// UI (filtros, diálogos, export) que no afecta a los datos de los charts.
// Con memo() solo se re-dibujan cuando cambian sus datos (useMemo en el padre).

import { memo } from "react"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtArs(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(1)}T`
  if (abs >= 1_000_000_000)     return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000)         return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)             return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${Math.round(abs).toLocaleString("es-AR")}`
}

export const PIE_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#a855f7", "#10b981", "#f97316"]

interface ChartColors {
  income: string
  expense: string
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name === "ingresos" ? "Ingresos" : "Gastos"}:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtArs(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function DailyProjectionTooltip({ active, payload }: { active?: boolean; payload?: { dataKey: string; value: number; color: string; payload: { dateLabel: string } }[] }) {
  if (!active || !payload?.length) return null
  const real = payload.find(p => p.dataKey === "real")
  const projected = payload.find(p => p.dataKey === "projected")
  const dateLabel = payload[0]?.payload?.dateLabel ?? ""
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1.5 capitalize">{dateLabel}</p>
      {real?.value != null && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: real.color }} />
          <span className="text-muted-foreground">Acumulado:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtArs(real.value)}</span>
        </div>
      )}
      {projected?.value != null && real?.value == null && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0 opacity-55" style={{ background: projected.color }} />
          <span className="text-muted-foreground">Proyectado:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtArs(projected.value)}</span>
        </div>
      )}
    </div>
  )
}

function SimpleValueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload?: { dateLabel?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const displayLabel = label || payload[0]?.payload?.dateLabel || ""
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-0.5">{displayLabel}</p>
      <p className="text-muted-foreground">{fmtArs(payload[0].value)}</p>
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { name: string } }[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{item.payload.name}</p>
      <p className="text-muted-foreground mt-0.5">{fmtArs(item.value)}</p>
    </div>
  )
}

// ── Trend — 12-month income/expense lines ────────────────────────────────────

export const TrendChart = memo(function TrendChart({ data, colors }: {
  data: { label: string; gastos: number; ingresos: number }[]
  colors: ChartColors
}) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtArs}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={7}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {value === "gastos" ? "Gastos" : "Ingresos"}
            </span>
          )}
        />
        <Line
          type="monotone"
          dataKey="ingresos"
          stroke={colors.income}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: colors.income }}
        />
        <Line
          type="monotone"
          dataKey="gastos"
          stroke={colors.expense}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: colors.expense }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
})

// ── Daily expenses + projection (current month) ───────────────────────────────

export const DailyProjectionChart = memo(function DailyProjectionChart({ data, projectedTotal, colors }: {
  data: { label: string; dateLabel: string; real: number | null; projected: number | null }[]
  projectedTotal: number
  colors: ChartColors
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.expense} stopOpacity={0.18} />
            <stop offset="95%" stopColor={colors.expense} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtArs}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip content={<DailyProjectionTooltip />} />
        <Area
          type="monotone"
          dataKey="real"
          stroke={colors.expense}
          strokeWidth={2}
          fill="url(#gradReal)"
          dot={false}
          activeDot={{ r: 4, fill: colors.expense }}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="projected"
          stroke={colors.expense}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeOpacity={0.5}
          fill="none"
          dot={false}
          activeDot={{ r: 4, fill: colors.expense }}
          connectNulls={false}
        />
        <ReferenceLine
          y={projectedTotal}
          stroke={colors.expense}
          strokeDasharray="3 3"
          strokeOpacity={0.35}
          label={{
            value: fmtArs(projectedTotal),
            position: "insideTopRight",
            fontSize: 10,
            fill: "var(--muted-foreground)",
            dy: -4,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

// ── Expenses by period (week / year / custom) ─────────────────────────────────

export const PeriodBarChart = memo(function PeriodBarChart({ data, color }: {
  data: { label: string; value: number; dateLabel?: string }[]
  color: string
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtArs}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip content={<SimpleValueTooltip />} />
        <Bar
          dataKey="value"
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          fillOpacity={0.85}
        />
      </BarChart>
    </ResponsiveContainer>
  )
})

// ── Category donut + legend ───────────────────────────────────────────────────

export const CategoryDonutChart = memo(function CategoryDonutChart({ data }: {
  data: { name: string; value: number }[]
}) {
  const total = data.reduce((a, c) => a + c.value, 0)
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={86}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((item, i) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
          return (
            <div key={item.name} className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground truncate flex-1">{item.name}</span>
              <span className="text-xs font-medium text-foreground tabular-nums shrink-0">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

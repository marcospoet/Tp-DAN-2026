"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CalendarWithNav } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"
import { es } from "date-fns/locale"
import type { TimeFilter } from "@/lib/app-context"
import { formatDateShort } from "./shared"

interface CalendarPreset {
  label: string
  getRange: () => { from: Date; to: Date }
}

interface FilterBarProps {
  timeFilter: TimeFilter
  setTimeFilter: (f: TimeFilter) => void
  filterLabels: Record<TimeFilter, string>
  showCalendar: boolean
  setShowCalendar: (v: boolean) => void
  calendarRange: DateRange | undefined
  setCalendarRange: (r: DateRange | undefined) => void
  calendarPresets: CalendarPreset[]
  applyRange: (from: Date, to: Date) => void
  handleApplyCustomRange: () => void
}

export function FilterBar({
  timeFilter,
  setTimeFilter,
  filterLabels,
  showCalendar,
  setShowCalendar,
  calendarRange,
  setCalendarRange,
  calendarPresets,
  applyRange,
  handleApplyCustomRange,
}: FilterBarProps) {
  return (
    <motion.div
      className="mb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pr-8 lg:mx-0 lg:px-0 lg:pr-0 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["week", "month", "year"] as TimeFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`shrink-0 h-8 px-3.5 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                timeFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setTimeFilter(f)
                setShowCalendar(false)
              }}
            >
              {filterLabels[f]}
            </button>
          ))}
          <button
            type="button"
            className={`shrink-0 h-8 px-3.5 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border ${
              timeFilter === "custom"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setShowCalendar(!showCalendar)}
          >
            {timeFilter === "custom" ? filterLabels.custom : "Personalizado"}
          </button>
      </div>

      <AnimatePresence>
        {showCalendar && (
          <motion.div
            className="mt-3 rounded-2xl border border-border bg-card overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Quick presets */}
            <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {calendarPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const { from, to } = preset.getRange()
                    applyRange(from, to)
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t border-border/40" />

            <div className="p-3">
              {/* Selected range preview */}
              <div className="flex items-center justify-between mb-2 px-1 min-h-[20px]">
                {calendarRange?.from ? (
                  <>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDateShort(calendarRange.from)}
                      {" → "}
                      {calendarRange.to ? formatDateShort(calendarRange.to) : "..."}
                    </span>
                    {calendarRange.to && (
                      <span className="text-xs text-muted-foreground">
                        {Math.max(1, Math.round((calendarRange.to.getTime() - calendarRange.from.getTime()) / 86400000) + 1)} días
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/50">Seleccioná una fecha de inicio</span>
                )}
              </div>

              <CalendarWithNav
                selected={calendarRange}
                onSelect={setCalendarRange}
                locale={es}
                disabled={{ after: new Date() }}
              />
              <button
                type="button"
                className="mt-2 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleApplyCustomRange}
                disabled={!calendarRange?.from}
              >
                Aplicar rango
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

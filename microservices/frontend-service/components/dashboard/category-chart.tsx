"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ShoppingCart, X } from "lucide-react"
import { iconMap, CATEGORY_ICON_MAP } from "./shared"

interface CategoryChartProps {
  categoryBreakdown: [string, number][]
  showCategoryChart: boolean
  setShowCategoryChart: React.Dispatch<React.SetStateAction<boolean>>
  formatCurrency: (n: number) => string
  selectedCategory?: string | null
  onCategoryClick?: (cat: string) => void
}

export function CategoryChart({
  categoryBreakdown,
  showCategoryChart,
  setShowCategoryChart,
  formatCurrency,
  selectedCategory,
  onCategoryClick,
}: CategoryChartProps) {
  if (categoryBreakdown.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card mb-4 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setShowCategoryChart(v => !v)}
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Gastos por categoría
          </p>
          {selectedCategory && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30">
              {selectedCategory}
              <X className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            showCategoryChart ? "rotate-90" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {showCategoryChart && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col gap-1 px-3 pb-3">
              {categoryBreakdown.map(([cat, amount]) => {
                const maxAmount = categoryBreakdown[0][1]
                const pct = (amount / maxAmount) * 100
                const Icon = iconMap[CATEGORY_ICON_MAP[cat] ?? "ShoppingCart"] || ShoppingCart
                const isSelected = selectedCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryClick?.(cat)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className={`flex items-center justify-center w-6 h-6 rounded-lg shrink-0 ${isSelected ? "bg-primary/20" : "bg-secondary"}`}>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <span className={`text-xs w-[4.5rem] shrink-0 truncate ${isSelected ? "text-primary font-medium" : "text-muted-foreground"}`}>{cat}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${isSelected ? "bg-primary" : "bg-primary/60"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                      />
                    </div>
                    <span className={`text-xs tabular-nums font-medium w-28 text-right shrink-0 ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {formatCurrency(amount)}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

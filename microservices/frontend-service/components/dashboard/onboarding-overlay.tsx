"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Bot, Wallet } from "lucide-react"
import { ONBOARDING_KEY } from "./shared"

const ONBOARDING_STEPS = [
  {
    Icon: Sparkles,
    title: "El Magic Bar",
    description: "Escribí un gasto en lenguaje natural, adjuntá una foto de ticket o grabá un audio. La IA lo interpreta y registra automáticamente.",
  },
  {
    Icon: Bot,
    title: "BudgetBuddy AI",
    description: "Preguntale al asistente sobre tus finanzas. Analizá tendencias, pedí consejos y chequeá en qué estás gastando más.",
  },
  {
    Icon: Wallet,
    title: "Tu resumen",
    description: "Filtrá por semana, mes o año. Exportá tus datos en CSV. Marcá gastos como fijos mensuales para aplicarlos con un clic.",
  },
]

export function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const isLast = step === ONBOARDING_STEPS.length - 1
  const { Icon, title, description } = ONBOARDING_STEPS[step]

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, "done")
      onDone()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-md px-5 pb-8 sm:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 flex flex-col items-center gap-5 shadow-2xl"
        initial={{ scale: 0.94, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
          >
            <Icon className="w-8 h-8 text-primary" />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="text-center"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.18 }}
          >
            <h2 className="text-lg font-bold text-foreground mb-2">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-1.5">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-secondary"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
        >
          {isLast ? "Comenzar" : "Siguiente"}
        </button>

        {!isLast && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(ONBOARDING_KEY, "done")
              onDone()
            }}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer -mt-2"
          >
            Omitir
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

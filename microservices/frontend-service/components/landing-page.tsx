"use client"

import { useState, useEffect, useRef } from "react"
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useMotionValue,
  useMotionTemplate,
  AnimatePresence,
} from "framer-motion"
import {
  Sparkles, Mic, ArrowRight, Wallet,
  Download, Smartphone, DollarSign, Camera, MessageCircle,
  ShieldCheck, Repeat, Github, TrendingUp, Zap, Share, Check,
} from "lucide-react"
import { useApp } from "@/lib/app-context"

// ── Types ──────────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface Feature {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  iconBg: string
  iconColor: string
  glowColor: string
}

// ── Constants ──────────────────────────────────────────────────────────────────
const EASE = [0.25, 0.1, 0.25, 1.0]

const MARQUEE_ITEMS = [
  "Texto libre", "Foto de ticket", "Grabación de voz",
  "ARS y USD", "Cotización Blue en vivo", "IA clasifica solo",
  "Gastos fijos", "Análisis mensual", "Sin formularios",
  "Datos encriptados", "Chat financiero", "PWA offline",
]

const FEATURES: Feature[] = [
  {
    icon: DollarSign,
    title: "Multimoneda ARS / USD",
    desc: "Blue, Oficial, Tarjeta y MEP en vivo. La tasa queda bloqueada al momento del gasto para históricos exactos.",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    glowColor: "oklch(0.72 0.19 160 / 0.1)",
  },
  {
    icon: Camera,
    title: "Foto de ticket",
    desc: "Sacale una foto a la factura y la IA extrae el monto y el establecimiento automáticamente.",
    iconBg: "bg-violet-400/10",
    iconColor: "text-violet-400",
    glowColor: "oklch(0.6 0.2 285 / 0.1)",
  },
  {
    icon: MessageCircle,
    title: "Chat financiero IA",
    desc: "Preguntale en qué estás gastando más, cómo ahorrar, o cualquier consulta sobre tus finanzas.",
    iconBg: "bg-amber-400/10",
    iconColor: "text-amber-400",
    glowColor: "oklch(0.82 0.18 85 / 0.1)",
  },
  {
    icon: Repeat,
    title: "Gastos fijos",
    desc: "Marcá recurrentes y aplicalos todos en un clic cada mes.",
    iconBg: "bg-sky-400/10",
    iconColor: "text-sky-400",
    glowColor: "oklch(0.72 0.15 220 / 0.1)",
  },
  {
    icon: ShieldCheck,
    title: "Datos seguros",
    desc: "Sincronizado en Supabase con cifrado en reposo. Disponible en cualquier dispositivo.",
    iconBg: "bg-rose-400/10",
    iconColor: "text-rose-400",
    glowColor: "oklch(0.7 0.2 20 / 0.1)",
  },
  {
    icon: TrendingUp,
    title: "Tendencia mensual",
    desc: "12 meses de historial. Detectá patrones y meses atípicos al instante.",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    glowColor: "oklch(0.72 0.19 160 / 0.1)",
  },
]

const CHAT_MESSAGES = [
  { side: "user" as const, text: "Pagué $12.000 en el super" },
  { side: "bot" as const,  text: "✓ Comida — $12.000 ARS registrado" },
  { side: "user" as const, text: "Gasté 20 dólares en Netflix" },
  { side: "bot" as const,  text: "✓ Suscripciones — USD 20 registrado" },
]

// ── ScrollProgressBar ──────────────────────────────────────────────────────────
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] bg-primary origin-left pointer-events-none"
      style={{ scaleX }}
    />
  )
}

// ── WordReveal ─────────────────────────────────────────────────────────────────
function WordReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" })
  return (
    <span ref={ref} className={className}>
      {text.split(" ").map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          style={{ marginRight: "0.3em" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: delay + i * 0.07, duration: 0.55, ease: EASE }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

// ── MarqueeStrip ───────────────────────────────────────────────────────────────
function MarqueeStrip() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <div
      className="relative overflow-hidden border-y border-border/30 py-5"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <motion.div
        className="flex w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center mx-6 text-sm text-muted-foreground whitespace-nowrap">
            <span className="w-1 h-1 rounded-full bg-primary/50 mr-6 shrink-0" />
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ── Illustrations ──────────────────────────────────────────────────────────────
function ChatIllustration() {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    if (visible >= CHAT_MESSAGES.length) {
      const t = setTimeout(() => setVisible(0), 2000)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setVisible(v => v + 1), 900)
    return () => clearTimeout(t)
  }, [visible])
  return (
    <div className="flex flex-col gap-2 w-full min-h-[90px]">
      <AnimatePresence>
        {CHAT_MESSAGES.slice(0, visible).map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={`text-xs px-3 py-1.5 rounded-2xl max-w-[88%] ${
              m.side === "user"
                ? "self-end bg-primary/15 border border-primary/20 text-primary rounded-tr-sm"
                : "self-start bg-secondary/80 text-foreground rounded-tl-sm border border-border/40"
            }`}
          >
            {m.side === "bot" && <Sparkles className="inline w-3 h-3 text-primary mr-1 shrink-0" />}
            {m.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function CategoriesIllustration() {
  const cats = [
    { label: "Comida",        cls: "text-primary bg-primary/15 border-primary/20" },
    { label: "Transporte",    cls: "text-accent bg-accent/15 border-accent/20" },
    { label: "Salidas",       cls: "text-yellow-400 bg-yellow-400/15 border-yellow-400/20" },
    { label: "Salud",         cls: "text-rose-400 bg-rose-400/15 border-rose-400/20" },
    { label: "Suscripciones", cls: "text-sky-400 bg-sky-400/15 border-sky-400/20" },
    { label: "Trabajo",       cls: "text-primary bg-primary/10 border-primary/15" },
  ]
  return (
    <div className="flex flex-wrap gap-2 py-1">
      {cats.map((c, i) => (
        <motion.span
          key={c.label}
          initial={{ opacity: 0, scale: 0.8, y: 6 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
          className={`${c.cls} border rounded-full px-3 py-1 text-xs font-medium`}
        >
          {c.label}
        </motion.span>
      ))}
    </div>
  )
}

function ChartIllustration() {
  const bars = [40, 70, 30, 85, 50, 65, 35, 90, 55, 75, 45, 80]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <div ref={ref} className="flex items-end gap-1 h-20 w-full">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t"
          style={{
            background: `oklch(0.72 0.19 160 / ${0.18 + (i / bars.length) * 0.7})`,
            originY: 1,
            height: `${h}%`,
          }}
          initial={{ scaleY: 0 }}
          animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ delay: i * 0.04, duration: 0.5, ease: EASE }}
        />
      ))}
    </div>
  )
}

// ── HowItWorks ─────────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Mic,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      title: "Hablá o escribí",
      body: "Contale a BudgetBuddy lo que gastaste como si le mandaras un mensaje. Texto, audio o foto.",
      illustration: <ChatIllustration />,
    },
    {
      number: "02",
      icon: Sparkles,
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      title: "La IA clasifica",
      body: "El modelo detecta el monto, la categoría y la moneda. Sin formularios, sin tipeo manual.",
      illustration: <CategoriesIllustration />,
    },
    {
      number: "03",
      icon: TrendingUp,
      iconBg: "bg-amber-400/10",
      iconColor: "text-amber-400",
      title: "Visualizá todo",
      body: "Gráficos claros de los últimos 12 meses. Presupuesto en tiempo real. Alertas automáticas.",
      illustration: <ChartIllustration />,
    },
  ]

  return (
    <section className="px-5 pb-14 md:pb-24 lg:px-12">
      <motion.p
        className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-8 md:mb-12"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        Cómo funciona
      </motion.p>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            className="rounded-3xl border border-border bg-card p-6 flex flex-col gap-5"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.12, duration: 0.6, ease: EASE }}
            whileHover={{ y: -4, boxShadow: "0 20px 40px oklch(0 0 0 / 0.3), 0 0 0 1px oklch(0.72 0.19 160 / 0.12)" }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-6xl font-black leading-none select-none"
                style={{ color: "oklch(0.3 0.01 260 / 0.35)" }}
              >
                {step.number}
              </p>
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${step.iconBg}`}>
                <step.icon className={`w-5 h-5 ${step.iconColor}`} />
              </div>
            </div>
            <div className="flex-1 min-h-[90px]">
              {step.illustration}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ── BentoCard ──────────────────────────────────────────────────────────────────
function BentoCard({ feature, className }: { feature: Feature; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  const glowBg = useMotionTemplate`radial-gradient(200px circle at ${mouseX}px ${mouseY}px, ${feature.glowColor}, transparent 80%)`

  return (
    <motion.div
      ref={cardRef}
      className={`group rounded-3xl border border-border bg-card p-6 flex flex-col gap-4 cursor-default relative overflow-hidden ${className ?? ""}`}
      onMouseMove={onMouseMove}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: EASE }}
      whileHover={{ y: -4, boxShadow: "0 20px 40px oklch(0 0 0 / 0.3), 0 0 0 1px oklch(0.72 0.19 160 / 0.15)" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: glowBg }}
      />
      <div className={`relative z-10 flex items-center justify-center w-11 h-11 rounded-2xl self-start ${feature.iconBg}`}>
        <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
      </div>
      <div className="relative z-10">
        <p className="text-foreground font-semibold">{feature.title}</p>
        <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">{feature.desc}</p>
      </div>
    </motion.div>
  )
}

// ── AuroraMesh ─────────────────────────────────────────────────────────────────
function AuroraMesh() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-background overflow-hidden">
      {/* Emerald — top center */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 700,
          top: "-20%",
          left: "5%",
          background: "radial-gradient(ellipse, oklch(0.72 0.19 160 / 0.15) 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />
      {/* Violet — left */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 800,
          top: "15%",
          left: "-20%",
          background: "radial-gradient(ellipse, oklch(0.6 0.22 285 / 0.13) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      {/* Indigo — right */}
      <div
        style={{
          position: "absolute",
          width: 750,
          height: 600,
          top: "30%",
          right: "-15%",
          background: "radial-gradient(ellipse, oklch(0.55 0.2 265 / 0.12) 0%, transparent 70%)",
          filter: "blur(75px)",
        }}
      />
      {/* Teal — bottom */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 500,
          bottom: "5%",
          left: "25%",
          background: "radial-gradient(ellipse, oklch(0.68 0.17 175 / 0.11) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LandingPage() {
  const { setView } = useApp()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  const { scrollY } = useScroll()
  const navBgOpacity = useTransform(scrollY, [0, 80], [0, 1])
  const orb1Y = useTransform(scrollY, [0, 800], [0, -100])
  const orb2Y = useTransform(scrollY, [0, 800], [0, 50])
  const orb3Y = useTransform(scrollY, [0, 800], [0, -70])

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    if (standalone) { setIsInstalled(true); return }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as any).standalone
    setIsIOS(ios)
    if (ios) setShowIOSBanner(true)
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === "accepted") { setInstallPrompt(null); setIsInstalled(true) }
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">

      {/* Aurora mesh gradient background */}
      <AuroraMesh />

      {/* Scroll progress bar */}
      <ScrollProgressBar />

      {/* ── Fixed Nav ─────────────────────────────────────────────────────────── */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 lg:px-12"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))", paddingBottom: "0.75rem" }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        {/* Frosted glass overlay — fades in as user scrolls */}
        <motion.div
          className="absolute inset-0 bg-background border-b border-border/50"
          style={{ opacity: navBgOpacity }}
        />
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
            <Wallet className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">BudgetBuddy</span>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          {installPrompt && !isInstalled && (
            <motion.button
              className="flex items-center justify-center w-8 h-8 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer"
              onClick={handleInstall}
              title="Instalar app"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
            >
              <Download className="w-3.5 h-3.5" />
            </motion.button>
          )}
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setView("auth")}
          >
            Iniciar sesión
          </button>
        </div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center px-5 text-center pb-20 min-h-screen overflow-hidden"
        style={{ paddingTop: "max(8rem, calc(env(safe-area-inset-top, 0px) + 7rem))" }}
      >
        {/* Parallax background orbs */}
        <motion.div
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/8 blur-[140px]"
          style={{ y: orb1Y }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute bottom-20 -left-40 w-[350px] h-[350px] rounded-full bg-accent/6 blur-[100px]"
          style={{ y: orb2Y }}
        />
        <motion.div
          className="pointer-events-none absolute top-1/3 -right-20 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[90px]"
          style={{ y: orb3Y }}
        />

        {/* Badge */}
        <motion.div
          className="relative z-10 flex items-center gap-2 mb-5 md:mb-8 rounded-full border border-border/60 bg-secondary/40 backdrop-blur-sm px-4 py-1.5"
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        >
          <Zap className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-muted-foreground font-medium">Potenciado por Inteligencia Artificial</span>
        </motion.div>

        {/* Headline — word-by-word blur+fade */}
        <h1 className="relative z-10 leading-[1.06] mb-5 md:mb-6 max-w-4xl">
          <span className="block text-[2.6rem] sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground">
            {["Tus", "finanzas,", "a", "la"].map((word, i) => (
              <motion.span
                key={word + i}
                className="inline-block mr-[0.3em]"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07, duration: 0.6, ease: EASE }}
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span
            className="block text-[2.6rem] sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-primary"
            style={{ textShadow: "0 0 60px oklch(0.72 0.19 160 / 0.55), 0 0 120px oklch(0.72 0.19 160 / 0.25)" }}
          >
            {["velocidad", "del", "chat"].map((word, i) => (
              <motion.span
                key={word}
                className="inline-block mr-[0.3em]"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.52 + i * 0.07, duration: 0.6, ease: EASE }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h1>

        {/* Subtext */}
        <motion.p
          className="relative z-10 text-sm md:text-xl text-muted-foreground max-w-xl leading-relaxed px-2 mb-7 md:mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6, ease: EASE }}
        >
          Olvidate de los formularios. Contale a BudgetBuddy lo que gastaste
          — en texto, foto o audio — y la IA hace el resto.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="relative z-10 flex flex-col sm:flex-row items-center gap-3 mb-8 md:mb-12 w-full sm:w-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.6, ease: EASE }}
        >
          <motion.button
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-base px-10 py-4 rounded-full cursor-pointer w-full sm:w-auto justify-center"
            onClick={() => setView("auth")}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 40px oklch(0.72 0.19 160 / 0.5), 0 8px 20px oklch(0.72 0.19 160 / 0.3)" }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "" }}
          >
            Empezar gratis
            <ArrowRight className="w-4 h-4" />
          </motion.button>
          {installPrompt && !isInstalled && (
            <motion.button
              className="sm:hidden inline-flex items-center gap-2 border border-border/60 text-muted-foreground font-medium text-sm px-6 py-3.5 rounded-full cursor-pointer hover:text-foreground w-full justify-center"
              onClick={handleInstall}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
            >
              <Smartphone className="w-4 h-4" />
              Instalar como app
            </motion.button>
          )}
        </motion.div>

        {/* Stat chips */}
        <motion.div
          className="relative z-10 flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.6 }}
        >
          {[
            { icon: Mic,         label: "Voz, texto o foto" },
            { icon: DollarSign,  label: "ARS y USD" },
            { icon: ShieldCheck, label: "Datos seguros" },
          ].map(({ icon: Icon, label }, i) => (
            <motion.span
              key={label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 border border-border/50 rounded-full px-3 py-1.5 backdrop-blur-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 + i * 0.1 }}
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              {label}
            </motion.span>
          ))}
        </motion.div>

        {/* iOS install hint */}
        {isIOS && !isInstalled && (
          <motion.button
            type="button"
            onClick={() => setShowIOSBanner(v => !v)}
            className="relative z-10 mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Cómo instalar en iPhone
          </motion.button>
        )}

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.8 }}
        >
          <motion.div
            className="w-px h-10 bg-gradient-to-b from-transparent via-border/60 to-transparent"
            animate={{ scaleY: [0.5, 1, 0.5], opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ── Marquee ────────────────────────────────────────────────────────────── */}
      <MarqueeStrip />

      {/* ── Statement 1 — scale + blur reveal ─────────────────────────────────── */}
      <section className="px-5 py-14 md:py-24 lg:px-12 flex flex-col items-center text-center">
        <motion.h2
          className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.05] max-w-4xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          Registrá cualquier gasto<br />
          <span className="text-primary">en segundos.</span>
        </motion.h2>
        <motion.p
          className="mt-6 text-muted-foreground text-base md:text-xl max-w-md leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
        >
          Con voz, foto o texto libre.<br />Sin categorías manuales ni formularios.
        </motion.p>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── Statement 2 ───────────────────────────────────────────────────────── */}
      <section className="px-5 py-14 md:py-24 lg:px-12 flex flex-col items-center text-center">
        <motion.p
          className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-5"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Diseñado para Argentina
        </motion.p>
        <motion.h2
          className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.05] max-w-3xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          Tu plata, tu idioma,<br />
          <span className="text-primary">tu economía.</span>
        </motion.h2>
        <motion.div
          className="mt-6 sm:mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {[
            "Cotización Blue, Oficial y MEP en vivo",
            "Español rioplatense",
            "Pesos y dólares",
            "Alertas de presupuesto",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              {item}
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Features bento grid ─────────────────────────────────────────────────── */}
      <section className="px-5 pb-14 md:pb-28 lg:px-12">
        <motion.p
          className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Características
        </motion.p>
        <motion.h2
          className="text-center text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-8 md:mb-12 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6, ease: EASE }}
        >
          Todo lo que necesitás en un solo lugar
        </motion.h2>
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <BentoCard feature={FEATURES[0]} className="lg:col-span-2" />
          <BentoCard feature={FEATURES[1]} />
          <BentoCard feature={FEATURES[2]} />
          <BentoCard feature={FEATURES[3]} />
          <BentoCard feature={FEATURES[4]} />
          <BentoCard feature={FEATURES[5]} />
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="px-5 pb-14 md:pb-28 lg:px-12">
        <motion.div
          className="max-w-2xl mx-auto rounded-3xl border border-primary/20 bg-card/50 p-8 sm:p-12 md:p-16 flex flex-col items-center text-center gap-5 sm:gap-6 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 0%, oklch(0.72 0.19 160 / 0.1), transparent 70%)" }}
          />
          <motion.div
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/8 blur-3xl"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
          <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight">
              ¿Listo para tomar control<br />de tus finanzas?
            </h2>
            <p className="text-muted-foreground text-sm mt-4 leading-relaxed">
              Gratis, sin tarjeta de crédito. Empezá en segundos.
            </p>
          </div>
          <motion.button
            className="relative z-10 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-base px-8 sm:px-12 py-4 rounded-full cursor-pointer w-full sm:w-auto"
            onClick={() => setView("auth")}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 40px oklch(0.72 0.19 160 / 0.5)" }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "" }}
          >
            Crear cuenta gratis
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </section>

      {/* ── iOS install banner ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isIOS && !isInstalled && showIOSBanner && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[env(safe-area-inset-bottom,1rem)] pt-1"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 280 }}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
                    <Wallet className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-none">Instalar BudgetBuddy</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Acceso rápido desde tu pantalla de inicio</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSBanner(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { step: "1", text: "Tocá el botón", highlight: "Compartir", icon: <Share className="w-3.5 h-3.5 inline mx-0.5 text-primary" /> },
                  { step: "2", text: "Elegí", highlight: '"Agregar a pantalla de inicio"', icon: null },
                  { step: "3", text: "Tocá", highlight: '"Agregar"', icon: null },
                ].map(({ step, text, highlight, icon }) => (
                  <div key={step} className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0">{step}</span>
                    <p className="text-xs text-muted-foreground">
                      {text} <span className="font-medium text-foreground">{highlight}</span>{icon}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 px-5 py-8 lg:px-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary shrink-0">
              <Wallet className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">BudgetBuddy</span>
          </div>
          <a
            href="https://github.com/MarcosPiv"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
          >
            Desarrollado por
            <span className="font-medium text-foreground group-hover:text-primary transition-colors">Marcos Pividori</span>
            <Github className="w-3.5 h-3.5" />
          </a>
        </div>
      </footer>

    </div>
  )
}

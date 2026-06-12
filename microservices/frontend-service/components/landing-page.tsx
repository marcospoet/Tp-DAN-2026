"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useMotionValue,
  useMotionTemplate,
  animate,
  AnimatePresence,
  MotionConfig,
} from "framer-motion"
import {
  Sparkles, Mic, ArrowRight, Coins,
  Download, Smartphone, DollarSign, Camera, MessageCircle,
  ShieldCheck, Repeat, Github, TrendingUp, Zap, Share, Check,
} from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { GooeyText } from "@/components/ui/gooey-text-morphing"
import { usePerformanceTier, type PerfTier } from "@/hooks/use-performance-mode"

// ── Types ──────────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const E = [0.22, 1, 0.36, 1] as const

// Shared context — LandingPage sets this; sub-components read it to decide
// which effects to run: "full" = everything, "lite" (mobile) = only
// compositor-cheap transform/opacity animations, "off" = nothing continuous.
const PerfContext = createContext<PerfTier>("full")

// ── Text Scramble hook ─────────────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$€#@"
function useScramble(text: string, delay = 0.3) {
  const [out, setOut] = useState(() => text.split("").map(c => (c === " " || c === "." ? c : "_")).join(""))
  useEffect(() => {
    let iter = 0
    const timeout = setTimeout(() => {
      const iv = setInterval(() => {
        setOut(text.split("").map((ch, i) => {
          if (ch === " " || ch === ".") return ch
          if (i < iter) return ch
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        }).join(""))
        iter += 0.45
        if (iter >= text.length) clearInterval(iv)
      }, 38)
    }, delay * 1000)
    return () => clearTimeout(timeout)
  }, [text, delay])
  return out
}

// ── PesitoLogo ─────────────────────────────────────────────────────────────────
function PesitoLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const c = { sm: [24, 6, 13], md: [36, 10, 18], lg: [64, 16, 30] }[size]
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: c[0], height: c[0], borderRadius: c[1],
        background: "linear-gradient(135deg, oklch(0.75 0.19 160) 0%, oklch(0.55 0.2 175) 100%)",
        boxShadow: size === "lg" ? "0 0 40px oklch(0.72 0.19 160 / 0.4)" : "none",
      }}
    >
      <Coins style={{ width: c[2], height: c[2] }} className="text-white drop-shadow" />
    </div>
  )
}

// ── ScrollProgressBar ──────────────────────────────────────────────────────────
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] origin-left pointer-events-none"
      style={{
        scaleX,
        background: "linear-gradient(90deg, oklch(0.72 0.19 160), oklch(0.6 0.2 175), oklch(0.72 0.19 160))",
      }}
    />
  )
}

// ── CursorSpotlight ────────────────────────────────────────────────────────────
function CursorSpotlight() {
  const tier = useContext(PerfContext)
  const mx = useMotionValue(-400)
  const my = useMotionValue(-400)
  useEffect(() => {
    if (tier !== "full") return
    const h = (e: MouseEvent) => { mx.set(e.clientX); my.set(e.clientY) }
    window.addEventListener("mousemove", h)
    return () => window.removeEventListener("mousemove", h)
  }, [mx, my, tier])
  const bg = useMotionTemplate`radial-gradient(380px circle at ${mx}px ${my}px, oklch(0.72 0.19 160 / 0.055), transparent 65%)`
  if (tier !== "full") return null
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[5] hidden lg:block"
      style={{ background: bg }}
    />
  )
}

// ── TiltCard ───────────────────────────────────────────────────────────────────
// 3D perspective tilt with spring physics — inspired by 21st.dev InteractiveCard
function TiltCard({ children, className, maxTilt = 7 }: { children: React.ReactNode; className?: string; maxTilt?: number }) {
  const tier = useContext(PerfContext)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const xs = useSpring(x, { stiffness: 150, damping: 20 })
  const ys = useSpring(y, { stiffness: 150, damping: 20 })
  const rotX = useTransform(ys, [-0.5, 0.5], [`${maxTilt}deg`, `-${maxTilt}deg`])
  const rotY = useTransform(xs, [-0.5, 0.5], [`-${maxTilt}deg`, `${maxTilt}deg`])
  const sc = useSpring(1, { stiffness: 200, damping: 22 })

  // 3-D transforms + spring physics are hover-driven: pointless on touch
  // devices and janky without GPU — desktop "full" tier only.
  if (tier !== "full") return <div className={className}>{children}</div>

  return (
    <div style={{ perspective: "1000px" }} className={className}>
      <motion.div
        className="h-full"
        style={{ rotateX: rotX, rotateY: rotY, scale: sc, transformStyle: "preserve-3d" }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          x.set((e.clientX - r.left) / r.width - 0.5)
          y.set((e.clientY - r.top) / r.height - 0.5)
        }}
        onMouseEnter={() => sc.set(1.03)}
        onMouseLeave={() => { x.set(0); y.set(0); sc.set(1) }}
      >
        {children}
      </motion.div>
    </div>
  )
}

// ── AnimatedNumber ─────────────────────────────────────────────────────────────
// Scroll-triggered animated counter — inspired by 21st.dev Count Animation
function AnimatedNumber({ target, prefix = "", suffix = "", className = "" }: {
  target: number; prefix?: string; suffix?: string; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const count = useMotionValue(0)
  const rounded = useTransform(count, Math.round)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  useEffect(() => {
    if (inView) {
      animate(count, target, { duration: 1.8, ease: [0.16, 1, 0.3, 1] })
    }
  }, [inView, count, target])

  return (
    <div ref={ref} className={className}>
      {prefix}<motion.span>{rounded}</motion.span>{suffix}
    </div>
  )
}

// ── FloatingCoin ───────────────────────────────────────────────────────────────
function FloatingCoin({ delay, x, size, dur }: { delay: number; x: string; size: number; dur: number }) {
  // Pure transform/opacity → compositor-cheap, runs on mobile ("lite") too
  const tier = useContext(PerfContext)
  if (tier === "off") return null
  return (
    <motion.div
      className="pointer-events-none absolute bottom-0"
      style={{ left: x, color: "oklch(0.72 0.19 160 / 0.18)" }}
      initial={{ y: 60, opacity: 0, rotate: 0 }}
      animate={{ y: -680, opacity: [0, 0.28, 0.28, 0], rotate: 200 }}
      transition={{ delay, duration: dur, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
    >
      <Coins style={{ width: size, height: size }} />
    </motion.div>
  )
}

// ── MarqueeRow ─────────────────────────────────────────────────────────────────
function MarqueeRow({ items, dir }: { items: string[]; dir: 1 | -1 }) {
  const tier = useContext(PerfContext)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const tripled = [...items, ...items, ...items]

  // Sin animación solo cuando todo está apagado (reduced motion / sin GPU)
  if (tier === "off") {
    return (
      <div className="flex w-max">
        {items.map((item, i) => (
          <div key={i} className="flex items-center mx-6 whitespace-nowrap text-sm text-muted-foreground/55">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mr-6 shrink-0" />
            {item}
          </div>
        ))}
      </div>
    )
  }

  // Animación CSS pura (keyframes en globals.css): corre en el compositor sin
  // JS por frame, y se pausa cuando la fila sale del viewport.
  return (
    <div
      ref={ref}
      className={`flex w-max marquee-track ${dir === -1 ? "marquee-reverse" : ""}`}
      style={{ animationPlayState: inView ? "running" : "paused" }}
    >
      {tripled.map((item, i) => (
        <div key={i} className="flex items-center mx-6 whitespace-nowrap text-sm text-muted-foreground/55">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mr-6 shrink-0" />
          {item}
        </div>
      ))}
    </div>
  )
}

// ── LiveChatDemo ───────────────────────────────────────────────────────────────
const CHAT = [
  { s: "user", t: "Pagué $15.000 en el súper" },
  { s: "bot",  t: "✓ Supermercado · $15.000 ARS" },
  { s: "user", t: "Gasté 20 dólares blue en Netflix" },
  { s: "bot",  t: "✓ Suscripciones · USD 20 · Blue" },
  { s: "user", t: "¿Cuánto gasté este mes?" },
  { s: "bot",  t: "Gastaste $142.300 — 8% menos que el mes pasado 📉" },
]
function LiveChatDemo() {
  const [vis, setVis] = useState(0)
  useEffect(() => {
    if (vis >= CHAT.length) { const t = setTimeout(() => setVis(0), 2500); return () => clearTimeout(t) }
    const t = setTimeout(() => setVis(v => v + 1), 1000); return () => clearTimeout(t)
  }, [vis])
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <AnimatePresence>
        {CHAT.slice(0, vis).map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.26, ease: E }}
            className={`flex ${m.s === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] px-3 py-1.5 rounded-2xl text-[11px] leading-relaxed ${
              m.s === "user" ? "bg-primary/15 border border-primary/25 text-primary rounded-tr-sm" : "bg-secondary/80 border border-border/40 text-foreground rounded-tl-sm"
            }`}>
              {m.s === "bot" && <Sparkles className="inline w-3 h-3 text-primary mr-1" />}{m.t}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── ChartBarDemo ───────────────────────────────────────────────────────────────
function ChartBarDemo() {
  const bars = [32, 55, 40, 75, 52, 88, 43, 80, 60, 72, 48, 85]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <div ref={ref} className="flex items-end gap-1 h-16 w-full">
      {bars.map((h, i) => (
        <motion.div key={i} className="flex-1 rounded-sm" style={{ background: `oklch(0.72 0.19 160 / ${0.2 + (i / bars.length) * 0.65})`, originY: 1 }}
          initial={{ scaleY: 0 }} animate={inView ? { scaleY: h / 100 } : {}}
          transition={{ delay: i * 0.05, duration: 0.55, ease: E }} />
      ))}
    </div>
  )
}

// ── CategoriesPills ────────────────────────────────────────────────────────────
function CategoriesPills() {
  const cats = [
    { label: "Comida",         col: "text-primary border-primary/25 bg-primary/10" },
    { label: "Transporte",     col: "text-violet-400 border-violet-400/25 bg-violet-400/10" },
    { label: "Salud",          col: "text-rose-400 border-rose-400/25 bg-rose-400/10" },
    { label: "Ocio",           col: "text-amber-400 border-amber-400/25 bg-amber-400/10" },
    { label: "Suscripciones",  col: "text-sky-400 border-sky-400/25 bg-sky-400/10" },
    { label: "Trabajo",        col: "text-primary border-primary/20 bg-primary/8" },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {cats.map((c, i) => (
        <motion.span key={c.label} initial={{ opacity: 0, scale: 0.7 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.35, ease: E }}
          className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${c.col}`}>
          {c.label}
        </motion.span>
      ))}
    </div>
  )
}

// ── PhoneShowcase ──────────────────────────────────────────────────────────────
// Real product screenshot inside a CSS phone frame. All the motion here is
// transform/opacity only (compositor-cheap), so it runs on mobile too; the
// only "full"-tier exclusive is the blurred glow behind the phone.

// Floating notification chip around the phone — gentle y-loop, staggered entrance
function FloatingChip({ className, delay = 0, dur = 4.5, children }: {
  className?: string; delay?: number; dur?: number; children: React.ReactNode
}) {
  const tier = useContext(PerfContext)
  return (
    <motion.div
      className={`absolute z-10 ${className ?? ""}`}
      initial={{ opacity: 0, y: 18, scale: 0.85 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: 0.35 + delay, duration: 0.55, ease: E }}
    >
      <motion.div
        className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl"
        animate={tier === "off" ? undefined : { y: [0, -9, 0] }}
        transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function PhoneShowcase() {
  const tier = useContext(PerfContext)
  return (
    // pt-10: la flotación sube el teléfono ~12px por encima de su posición y
    // el paint containment de cv-auto recorta lo que salga de la sección
    <section className="cv-auto relative px-5 pt-10 pb-20 md:pb-28 flex flex-col items-center overflow-x-clip">
      <div style={{ perspective: 1200 }}>
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 56, rotateX: 16, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: E }}
        >
          {/* Glow behind the phone — blur filter, "full" tier only */}
          {tier === "full" && (
            <div
              className="pointer-events-none absolute -inset-10 rounded-full"
              style={{ background: "radial-gradient(ellipse, oklch(0.72 0.19 160 / 0.22) 0%, transparent 70%)", filter: "blur(60px)" }}
            />
          )}

          {/* Floating chips — mirror real app events around the phone */}
          <FloatingChip className="-left-16 sm:-left-28 top-16" delay={0} dur={4.2}>
            <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-primary whitespace-nowrap">+ $100.000</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Cobro · Trabajo</p>
            </div>
          </FloatingChip>

          <FloatingChip className="-right-14 sm:-right-28 top-40" delay={0.8} dur={5}>
            <span className="w-7 h-7 rounded-full bg-violet-400/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-foreground whitespace-nowrap">✓ Clasificado</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Nafta · Transporte</p>
            </div>
          </FloatingChip>

          <FloatingChip className="-left-10 sm:-left-24 bottom-28" delay={1.6} dur={4.6}>
            <span className="w-7 h-7 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0">
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            </span>
            <p className="text-[10px] text-muted-foreground italic whitespace-nowrap">&ldquo;Pagué 12.000 en el súper&rdquo;</p>
          </FloatingChip>

          {/* Phone: continuous gentle float (transform-only) + hover tilt on desktop */}
          <motion.div
            animate={tier === "off" ? undefined : { y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <TiltCard maxTilt={5}>
              {/* Bezel — extra top padding so the upper frame is always visible
                  (the screenshot's dark header blends with a thin bezel) */}
              <div
                className="relative rounded-[2.6rem] border border-border/70 px-2 pb-2 pt-7"
                style={{
                  background: "linear-gradient(160deg, oklch(0.3 0.01 260) 0%, oklch(0.17 0.01 260) 100%)",
                  boxShadow: "0 24px 70px oklch(0 0 0 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.1)",
                }}
              >
                {/* Speaker + camera in the top bezel */}
                <div className="absolute top-[13px] left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <div className="w-12 h-[5px] rounded-full bg-background/70" />
                  <div className="w-[7px] h-[7px] rounded-full bg-background/70 ring-1 ring-border/40" />
                </div>

                {/* Side buttons */}
                <div className="absolute -left-[2px] top-24 w-[3px] h-10 rounded-l-full bg-border/80" />
                <div className="absolute -left-[2px] top-36 w-[3px] h-14 rounded-l-full bg-border/80" />
                <div className="absolute -right-[2px] top-28 w-[3px] h-16 rounded-r-full bg-border/80" />

                <div className="relative rounded-t-xl rounded-b-[2rem] overflow-hidden">
                  <Image
                    src="/dashboard.png"
                    alt="Dashboard de Pesito: balance del mes, ingresos y gastos, movimientos registrados y barra de registro por voz"
                    width={540}
                    height={1169}
                    sizes="(max-width: 640px) 270px, 320px"
                    className="w-[270px] sm:w-[320px] h-auto select-none"
                    draggable={false}
                  />
                  {/* Periodic shine sweep across the screen (transform-only) */}
                  {tier !== "off" && (
                    <motion.div
                      className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12"
                      style={{ background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.07), transparent)" }}
                      initial={{ x: "-150%" }}
                      animate={{ x: "350%" }}
                      transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }}
                    />
                  )}
                </div>
              </div>
            </TiltCard>
          </motion.div>
        </motion.div>
      </div>

      <motion.p
        className="mt-8 text-sm text-muted-foreground max-w-xs text-center leading-relaxed"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Balance, movimientos y registro por voz —{" "}
        <span className="text-foreground font-medium">todo en una pantalla</span>.
      </motion.p>
    </section>
  )
}

// ── GlowCard (for smaller feature cards) ──────────────────────────────────────
function GlowCard({ children, className, glow = "oklch(0.72 0.19 160 / 0.13)", delay = 0 }: {
  children: React.ReactNode; className?: string; glow?: string; delay?: number
}) {
  const tier = useContext(PerfContext)
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const bg = useMotionTemplate`radial-gradient(200px circle at ${mx}px ${my}px, ${glow}, transparent 80%)`
  return (
    <motion.div ref={ref} className={`group relative rounded-3xl border border-border bg-card overflow-hidden ${className ?? ""}`}
      onMouseMove={tier !== "full" ? undefined : e => {
        if (!ref.current) return
        const r = ref.current.getBoundingClientRect()
        mx.set(e.clientX - r.left); my.set(e.clientY - r.top)
      }}
      initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: E }}>
      {tier === "full" && <motion.div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: bg }} />}
      {children}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Main LandingPage ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export function LandingPage() {
  const { setView } = useAuth()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  const perfTier = usePerformanceTier()

  const { scrollY } = useScroll()
  const navOpacity = useTransform(scrollY, [0, 70], [0, 1])
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3])

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    if (standalone) { setIsInstalled(true); return }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone
    setIsIOS(ios); if (ios) setShowIOSBanner(true)
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

  const scrambled = useScramble("Pesito.", 0.55)

  const ROW1 = ["Texto libre", "Foto de ticket", "Grabación de voz", "ARS y USD", "Blue en vivo", "Pesito clasifica solo", "Sin formularios"]
  const ROW2 = ["Gastos fijos mensuales", "Chat financiero IA", "12 meses de historial", "PWA offline", "Datos seguros", "Cotización en tiempo real", "Exportar CSV"]

  return (
    <PerfContext.Provider value={perfTier}>
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <ScrollProgressBar />
      <CursorSpotlight />

      {/* ── Fixed aurora bg — animated blur orbs need a real GPU ("full") ──── */}
      {perfTier === "full" && (
        <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
          <motion.div
            className="absolute rounded-full"
            style={{ width: 1000, height: 700, top: "-25%", left: "50%", x: "-50%", background: "radial-gradient(ellipse, oklch(0.72 0.19 160 / 0.17) 0%, transparent 70%)", filter: "blur(90px)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <div style={{ position: "absolute", width: 600, height: 600, top: "30%", left: "-15%", background: "radial-gradient(ellipse, oklch(0.6 0.22 285 / 0.11) 0%, transparent 70%)", filter: "blur(100px)" }} />
          <div style={{ position: "absolute", width: 500, height: 500, top: "45%", right: "-12%", background: "radial-gradient(ellipse, oklch(0.68 0.17 175 / 0.09) 0%, transparent 70%)", filter: "blur(90px)" }} />
          <div style={{ position: "absolute", width: 700, height: 400, bottom: "5%", left: "15%", background: "radial-gradient(ellipse, oklch(0.72 0.19 160 / 0.07) 0%, transparent 70%)", filter: "blur(110px)" }} />
        </div>
      )}

      {/* ── Lite aurora (mobile) — static radial gradients, no blur filter,
             no animation: one-time paint, zero per-frame cost ─────────────── */}
      {perfTier === "lite" && (
        <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
          <div style={{ position: "absolute", width: "140%", height: "60%", top: "-20%", left: "-20%", background: "radial-gradient(ellipse, oklch(0.72 0.19 160 / 0.12) 0%, transparent 70%)" }} />
          <div style={{ position: "absolute", width: "90%", height: "40%", top: "35%", left: "-30%", background: "radial-gradient(ellipse, oklch(0.6 0.22 285 / 0.08) 0%, transparent 70%)" }} />
          <div style={{ position: "absolute", width: "100%", height: "35%", bottom: "0%", right: "-25%", background: "radial-gradient(ellipse, oklch(0.68 0.17 175 / 0.07) 0%, transparent 70%)" }} />
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 lg:px-12"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))", paddingBottom: "0.75rem" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: E }}
      >
        <motion.div className="absolute inset-0 bg-background/85 backdrop-blur-2xl border-b border-border/35" style={{ opacity: navOpacity }} />
        <div className="relative z-10 flex items-center gap-2.5">
          <PesitoLogo size="sm" />
          <span className="text-sm font-bold text-foreground tracking-tight">Pesito</span>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          {installPrompt && !isInstalled && (
            <motion.button onClick={handleInstall} title="Instalar"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Download className="w-3.5 h-3.5" />
            </motion.button>
          )}
          <button onClick={() => setView("auth")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            Iniciar sesión
          </button>
          <motion.button onClick={() => setView("auth")}
            className="text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-full cursor-pointer"
            whileHover={{ scale: 1.06, boxShadow: "0 0 25px oklch(0.72 0.19 160 / 0.5)" }}
            whileTap={{ scale: 0.95 }}>
            Comenzar
          </motion.button>
        </div>
      </motion.header>

      {/* ══════════════════════════════════════════════════════════════════════
          ── HERO ─────────────────────────────────────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        className="relative flex flex-col items-center justify-center min-h-screen px-5 text-center overflow-hidden"
        style={{ paddingTop: "max(9rem, calc(env(safe-area-inset-top,0px) + 8rem))", paddingBottom: "6rem", scale: heroScale, opacity: heroOpacity }}
      >
        {/* Grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(to right, oklch(0.72 0.19 160) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.19 160) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 40%, transparent 100%)",
          }}
        />

        {/* Floating coins */}
        <FloatingCoin delay={0}   x="8%"  size={18} dur={9} />
        <FloatingCoin delay={2.5} x="22%" size={13} dur={12} />
        <FloatingCoin delay={1.2} x="68%" size={21} dur={10} />
        <FloatingCoin delay={3.8} x="85%" size={15} dur={11} />
        <FloatingCoin delay={0.6} x="50%" size={11} dur={14} />

        {/* Badge */}
        <motion.div
          className="relative z-10 inline-flex items-center gap-2 mb-8 rounded-full border border-primary/25 bg-primary/8 backdrop-blur-sm px-4 py-1.5"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: E }}
        >
          <motion.span className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
          <span className="text-xs text-primary/80 font-semibold tracking-wide">Tu asistente financiero personal · con IA</span>
        </motion.div>

        {/* ── Hero headline with scramble ───────────────────────────────────── */}
        <div className="relative z-10 max-w-5xl mx-auto mb-6">
          {/* "Manejá tu plata sin esfuerzo." — reveal from bottom */}
          <div className="overflow-hidden mb-1">
            <motion.p
              className="text-lg sm:text-xl md:text-2xl font-medium tracking-tight"
              style={{ color: "oklch(0.65 0.05 160 / 0.7)" }}
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, delay: 0.2, ease: E }}
            >
              Manejá tu plata sin esfuerzo.
            </motion.p>
          </div>

          {/* "Pesito." — MASSIVE + text scramble */}
          <div className="overflow-hidden">
            <motion.h1
              className="font-black tracking-tighter leading-none font-mono"
              style={{
                fontSize: "clamp(4.5rem, 17vw, 10.5rem)",
                background: "linear-gradient(140deg, oklch(0.92 0.12 155) 0%, oklch(0.75 0.19 160) 30%, oklch(0.6 0.21 175) 65%, oklch(0.72 0.19 160) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 70px oklch(0.72 0.19 160 / 0.5))",
              }}
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.82, delay: 0.35, ease: E }}
            >
              {scrambled}
            </motion.h1>
          </div>

          {/* "Contale lo que gastaste. Pesito lo clasifica." */}
          <div className="overflow-hidden mt-2">
            <motion.p
              className="text-lg sm:text-xl md:text-2xl text-foreground/65 font-medium tracking-tight"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, delay: 0.6, ease: E }}
            >
              Contale lo que gastaste.{" "}
              <span className="text-primary font-semibold">Pesito lo clasifica.</span>
            </motion.p>
          </div>
        </div>

        {/* Subtext */}
        <motion.p
          className="relative z-10 text-sm md:text-base text-muted-foreground max-w-md leading-relaxed mb-9 px-2"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.88, duration: 0.65, ease: E }}
        >
          Texto libre, foto de ticket o audio. La IA interpreta todo,
          registra automáticamente y te da análisis de tus finanzas en tiempo real.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="relative z-10 flex flex-col sm:flex-row items-center gap-3 mb-10 w-full sm:w-auto"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.08, duration: 0.65, ease: E }}
        >
          {/* Primary CTA — shimmer + glow */}
          <motion.button
            onClick={() => setView("auth")}
            className="relative inline-flex items-center gap-2.5 bg-primary text-primary-foreground font-bold text-base px-10 py-4 rounded-full cursor-pointer w-full sm:w-auto justify-center overflow-hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 55px oklch(0.72 0.19 160 / 0.65), 0 8px 28px oklch(0.72 0.19 160 / 0.4)" }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "" }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12"
              initial={{ x: "-120%" }}
              whileHover={{ x: "220%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            Comenzar gratis
            <ArrowRight className="w-4 h-4" />
          </motion.button>
          {installPrompt && !isInstalled && (
            <motion.button onClick={handleInstall}
              className="inline-flex items-center gap-2 border border-border/60 text-muted-foreground font-medium text-sm px-6 py-3.5 rounded-full cursor-pointer hover:text-foreground w-full sm:w-auto justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
              <Smartphone className="w-4 h-4" />
              Instalar como app
            </motion.button>
          )}
        </motion.div>

        {/* Proof chips */}
        <motion.div className="relative z-10 flex flex-wrap justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.7 }}>
          {[
            { icon: Mic,         label: "Voz, texto o foto" },
            { icon: DollarSign,  label: "ARS y USD" },
            { icon: ShieldCheck, label: "Datos seguros" },
            { icon: Zap,         label: "IA en tiempo real" },
          ].map(({ icon: Icon, label }, i) => (
            <motion.span key={label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/40 border border-border/40 rounded-full px-3 py-1.5 backdrop-blur-sm"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 + i * 0.08 }}>
              <Icon className="w-3 h-3 text-primary" />
              {label}
            </motion.span>
          ))}
        </motion.div>

        {isIOS && !isInstalled && (
          <motion.button type="button" onClick={() => setShowIOSBanner(v => !v)}
            className="relative z-10 mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
            <Smartphone className="w-3.5 h-3.5" /> Cómo instalar en iPhone
          </motion.button>
        )}

        {/* Scroll line */}
        <motion.div className="absolute bottom-7 left-1/2 -translate-x-1/2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }}>
          <motion.div className="w-px h-12 bg-gradient-to-b from-transparent via-primary/40 to-transparent mx-auto"
            animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.2, 0.9, 0.2] }} transition={{ duration: 2.4, repeat: Infinity }} />
        </motion.div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════════
          ── PRODUCT SHOWCASE — real dashboard screenshot ─────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <PhoneShowcase />

      {/* ══════════════════════════════════════════════════════════════════════
          ── DUAL MARQUEE ─────────────────────────────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="border-y border-border/25 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        }}
      >
        <div className="py-3.5 overflow-hidden"><MarqueeRow items={ROW1} dir={1} /></div>
        <div className="border-t border-border/20 py-3.5 overflow-hidden"><MarqueeRow items={ROW2} dir={-1} /></div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ── STATEMENT ────────────────────────────────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="cv-auto px-5 py-20 md:py-32 lg:px-12 flex flex-col items-center text-center">
        <motion.p
          className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary/50 mb-16"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          ¿Cómo funciona?
        </motion.p>
        <div className="relative h-24 md:h-32 w-full max-w-4xl mx-auto">
          <GooeyText
            texts={["Hablale a Pesito.", "Él lo registra.", "Foto o voz.", "Sin formularios."]}
            morphTime={1}
            cooldownTime={0.5}
            className="h-full"
            textClassName="font-black tracking-tighter text-foreground"
            disabled={perfTier !== "full"}
          />
        </div>
        <motion.p
          className="mt-6 text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed"
          initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Sin categorías manuales, sin formularios. Solo contale lo que pasó en lenguaje natural.
        </motion.p>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ── HOW IT WORKS — TiltCards ─────────────────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="cv-auto px-5 pb-20 md:pb-32 lg:px-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "01", icon: Mic, color: "text-primary", bg: "bg-primary/10",
              title: "Contale", desc: "Escribí, hablá o sacale foto al ticket. Pesito entiende lenguaje natural.", demo: <LiveChatDemo />,
            },
            {
              step: "02", icon: Sparkles, color: "text-violet-400", bg: "bg-violet-400/10",
              title: "Pesito clasifica", desc: "Detecta monto, categoría, moneda y tipo de cambio automáticamente.", demo: <CategoriesPills />,
            },
            {
              step: "03", icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10",
              title: "Visualizá todo", desc: "12 meses de historial. Preguntale a Pesito cualquier consulta financiera.", demo: <ChartBarDemo />,
            },
          ].map((s, i) => (
            <motion.div key={s.step}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.13, duration: 0.7, ease: E }}>
              <TiltCard className="h-full">
                <div className="rounded-3xl border border-border bg-card p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between">
                    <span className="text-5xl font-black leading-none select-none" style={{ color: "oklch(0.3 0.01 260 / 0.28)" }}>{s.step}</span>
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                  </div>
                  <div className="min-h-[110px] flex flex-col justify-end">{s.demo}</div>
                  <div><h3 className="text-base font-bold text-foreground mb-1">{s.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p></div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ── STATS — Animated numbers ─────────────────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="cv-auto relative px-5 py-20 md:py-28 lg:px-12 overflow-hidden">
        {/* Subtle different bg */}
        <div className="absolute inset-0 bg-primary/[0.03] border-y border-primary/10" />
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(to right, oklch(0.72 0.19 160 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.19 160 / 0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.p
            className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-primary/50 mb-12"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          >
            Por qué Pesito
          </motion.p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/30 rounded-3xl overflow-hidden border border-border/30">
            {[
              { target: 0,  prefix: "$", suffix: "",  label: "comisiones",          sub: "siempre gratis",           col: "text-primary" },
              { target: 4,  prefix: "",  suffix: "",   label: "tipos de cambio",      sub: "Blue · Oficial · MEP · Tarjeta", col: "text-violet-400" },
              { target: 12, prefix: "",  suffix: "",   label: "meses de historial",   sub: "análisis completo",        col: "text-amber-400" },
              { target: 3,  prefix: "",  suffix: "",   label: "formas de ingresar",   sub: "voz · texto · foto",       col: "text-sky-400" },
            ].map((s, i) => (
              <motion.div key={s.label}
                className="bg-card/80 backdrop-blur-sm p-8 flex flex-col items-center text-center gap-1"
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.55, ease: E }}>
                <AnimatedNumber target={s.target} prefix={s.prefix} suffix={s.suffix}
                  className={`text-5xl sm:text-6xl font-black tabular-nums leading-none ${s.col}`}
                />
                <p className="text-sm font-semibold text-foreground mt-2">{s.label}</p>
                <p className="text-[11px] text-muted-foreground/60">{s.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ── FEATURES BENTO — TiltCard + GlowCard ────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="cv-auto px-5 py-20 md:py-32 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <motion.p
            className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            Características
          </motion.p>
          <motion.h2
            className="text-center font-black tracking-tight text-foreground mb-10 max-w-2xl mx-auto leading-tight"
            style={{ fontSize: "clamp(1.8rem, 4.5vw, 3.5rem)" }}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6, ease: E }}>
            Todo lo que necesitás en un solo lugar
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Featured card 1 — TiltCard (col-span-2) */}
            <motion.div className="lg:col-span-2"
              initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: E }}>
              <TiltCard className="h-full" maxTilt={5}>
                <div className="rounded-3xl border border-primary/25 bg-card h-full overflow-hidden">
                  <div className="p-7 flex flex-col gap-4 h-full">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center self-start">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-bold text-lg mb-2">Multimoneda ARS / USD</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Blue, Oficial, Tarjeta y MEP en vivo. La tasa queda bloqueada al momento del gasto para históricos exactos. Nunca más perdés el tipo de cambio real.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {["Blue", "Oficial", "MEP", "Tarjeta"].map(tag => (
                        <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Camera — GlowCard */}
            <GlowCard className="p-6 flex flex-col gap-4" glow="oklch(0.6 0.2 285 / 0.14)" delay={0.08}>
              <TiltCard>
                <div className="flex flex-col gap-4 h-full">
                  <div className="w-11 h-11 rounded-2xl bg-violet-400/10 flex items-center justify-center self-start">
                    <Camera className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="relative z-10 text-foreground font-semibold mb-1.5">Foto de ticket</p>
                    <p className="relative z-10 text-muted-foreground text-sm leading-relaxed">Sacale una foto y Pesito extrae monto, establecimiento y categoría automáticamente.</p>
                  </div>
                </div>
              </TiltCard>
            </GlowCard>

            {/* Chat — GlowCard */}
            <GlowCard className="p-6 flex flex-col gap-4" glow="oklch(0.82 0.18 85 / 0.14)" delay={0.1}>
              <TiltCard>
                <div className="flex flex-col gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-amber-400/10 flex items-center justify-center self-start">
                    <MessageCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="relative z-10 text-foreground font-semibold mb-1.5">Chat con Pesito</p>
                    <p className="relative z-10 text-muted-foreground text-sm leading-relaxed">Preguntale en qué gastás más, cómo ahorrar o cualquier consulta sobre tus finanzas.</p>
                  </div>
                </div>
              </TiltCard>
            </GlowCard>

            {/* Repeat — GlowCard */}
            <GlowCard className="p-6 flex flex-col gap-4" glow="oklch(0.72 0.15 220 / 0.14)" delay={0.12}>
              <TiltCard>
                <div className="flex flex-col gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-sky-400/10 flex items-center justify-center self-start">
                    <Repeat className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <p className="relative z-10 text-foreground font-semibold mb-1.5">Gastos fijos</p>
                    <p className="relative z-10 text-muted-foreground text-sm leading-relaxed">Marcá recurrentes y aplicalos todos en un clic cada mes. Sin reingresarlos.</p>
                  </div>
                </div>
              </TiltCard>
            </GlowCard>

            {/* Voice — GlowCard */}
            <GlowCard className="p-6 flex flex-col gap-4" glow="oklch(0.72 0.18 160 / 0.14)" delay={0.13}>
              <TiltCard>
                <div className="flex flex-col gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-400/10 flex items-center justify-center self-start">
                    <Mic className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="relative z-10 text-foreground font-semibold mb-1.5">Dictado por voz</p>
                    <p className="relative z-10 text-muted-foreground text-sm leading-relaxed">Grabá un audio y Pesito transcribe y registra el gasto automáticamente. Sin escribir nada.</p>
                  </div>
                </div>
              </TiltCard>
            </GlowCard>

            {/* Featured card 2 — TiltCard (col-span-2) */}
            <motion.div className="lg:col-span-2"
              initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: 0.15, ease: E }}>
              <TiltCard className="h-full" maxTilt={5}>
                <div className="rounded-3xl border border-amber-400/25 bg-card h-full overflow-hidden">
                  <div className="p-7 flex flex-col gap-4 h-full">
                    <div className="w-11 h-11 rounded-2xl bg-amber-400/10 flex items-center justify-center self-start">
                      <TrendingUp className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-foreground font-bold text-lg mb-2">12 meses de tendencia</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Gráficos de línea, barras y dona para detectar patrones de gasto. Identificá meses atípicos, comparás períodos y entendés tu economía real.
                      </p>
                    </div>
                    <ChartBarDemo />
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Shield — GlowCard */}
            <GlowCard className="p-6 flex flex-col gap-4" glow="oklch(0.7 0.2 20 / 0.14)" delay={0.18}>
              <TiltCard>
                <div className="flex flex-col gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-rose-400/10 flex items-center justify-center self-start">
                    <ShieldCheck className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="relative z-10 text-foreground font-semibold mb-1.5">Datos seguros</p>
                    <p className="relative z-10 text-muted-foreground text-sm leading-relaxed">Tus datos cifrados y sincronizados. Accedé desde cualquier dispositivo.</p>
                  </div>
                </div>
              </TiltCard>
            </GlowCard>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ── ARGENTINA SECTION ────────────────────────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="cv-auto px-5 py-20 md:py-32 lg:px-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary/50 mb-5"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
              Diseñado para Argentina
            </motion.p>
            <motion.h2
              className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-tight mb-7"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: E }}>
              Tu plata,<br />tu idioma,<br />
              <span className="text-primary">tu economía.</span>
            </motion.h2>
            <div className="flex flex-col gap-3.5">
              {[
                "Cotización Blue, Oficial, Tarjeta y MEP en vivo",
                "Multi-moneda ARS / USD con tasa bloqueada al gasto",
                "Español rioplatense — hablale como a un amigo",
                "Gastos fijos mensuales aplicados con un clic",
                "Exportá tu historial en CSV con todos los detalles",
              ].map((item, i) => (
                <motion.div key={item} className="flex items-start gap-3 text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ delay: 0.08 + i * 0.07, duration: 0.5, ease: E }}>
                  <motion.div
                    className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5"
                    whileInView={{ scale: [0, 1.2, 1] }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.07, duration: 0.4, ease: E }}>
                    <Check className="w-3 h-3 text-primary" />
                  </motion.div>
                  {item}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Stats 2x2 with TiltCard */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: 4,  u: "tipos de cambio",    s: "en tiempo real",     col: "text-primary",    bg: "bg-primary/8 border-primary/20"       },
              { val: 3,  u: "medios de entrada",  s: "voz · texto · foto", col: "text-violet-400", bg: "bg-violet-400/8 border-violet-400/20" },
              { val: 12, u: "meses historial",    s: "análisis completo",  col: "text-amber-400",  bg: "bg-amber-400/8 border-amber-400/20"   },
              { val: 0,  u: "formularios",        s: "cero burocracia",    col: "text-sky-400",    bg: "bg-sky-400/8 border-sky-400/20"       },
            ].map((s, i) => (
              <motion.div key={s.u}
                initial={{ opacity: 0, scale: 0.88 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.5, ease: E }}>
                <TiltCard maxTilt={10}>
                  <div className={`rounded-3xl border p-5 ${s.bg}`}>
                    <AnimatedNumber target={s.val} className={`text-4xl font-black leading-none ${s.col}`} />
                    <p className={`text-xs font-semibold mt-1 ${s.col}`}>{s.u}</p>
                    <p className="text-[11px] text-muted-foreground/55 mt-1.5">{s.s}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ── FINAL CTA — card with pulsing logo ──────────────────────────────
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="cv-auto px-5 pb-24 md:pb-36 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: E }}
          className="max-w-3xl mx-auto"
        >
          <div className="rounded-3xl border border-primary/25 bg-card overflow-hidden">
            <div className="relative p-10 sm:p-16 flex flex-col items-center text-center gap-6 overflow-hidden">
              {/* Top radial glow */}
              <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% -10%, oklch(0.72 0.19 160 / 0.2), transparent 60%)" }} />
              {/* Grid pattern */}
              <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }} />
              {/* Pulsing blur orb */}
              <motion.div
                className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-3xl"
                style={{ background: "oklch(0.72 0.19 160 / 0.15)" }}
                animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
                transition={{ duration: 4.5, repeat: Infinity }}
              />

              <div className="relative z-10">
                <motion.div
                  animate={{ scale: [1, 1.09, 1], filter: ["drop-shadow(0 0 20px oklch(0.72 0.19 160 / 0.3))", "drop-shadow(0 0 40px oklch(0.72 0.19 160 / 0.7))", "drop-shadow(0 0 20px oklch(0.72 0.19 160 / 0.3))"] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
                  <PesitoLogo size="lg" />
                </motion.div>
              </div>

              <div className="relative z-10">
                <h2 className="font-black tracking-tight text-foreground leading-tight" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
                  ¿Listo para conocer<br />a Pesito?
                </h2>
                <p className="text-muted-foreground text-sm mt-4 max-w-sm mx-auto leading-relaxed">
                  Gratis. Sin tarjeta de crédito.<br />Tu asistente financiero personal en segundos.
                </p>
              </div>

              <motion.button
                className="relative z-10 inline-flex items-center justify-center gap-2.5 bg-primary text-primary-foreground font-bold text-base px-12 py-4 rounded-full cursor-pointer overflow-hidden w-full sm:w-auto"
                onClick={() => setView("auth")}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 70px oklch(0.72 0.19 160 / 0.7), 0 8px 36px oklch(0.72 0.19 160 / 0.45)" }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "" }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12"
                  initial={{ x: "-120%" }} whileHover={{ x: "220%" }} transition={{ duration: 0.6, ease: "easeOut" }} />
                Crear cuenta gratis
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              {/* Social proof below button */}
              <p className="relative z-10 text-[11px] text-muted-foreground/50">
                Sin tarjeta · Sin compromisos · 100% gratis
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── iOS Banner ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isIOS && !isInstalled && showIOSBanner && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[env(safe-area-inset-bottom,1rem)] pt-1"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 280 }}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <PesitoLogo size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-none">Instalar Pesito</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Acceso rápido desde tu pantalla de inicio</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowIOSBanner(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Cerrar">✕</button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { step: "1", text: "Tocá el botón", highlight: "Compartir", icon: <Share className="w-3.5 h-3.5 inline ml-0.5 text-primary" /> },
                  { step: "2", text: "Elegí", highlight: '"Agregar a pantalla de inicio"', icon: null },
                  { step: "3", text: "Tocá", highlight: '"Agregar"', icon: null },
                ].map(({ step, text, highlight, icon }) => (
                  <div key={step} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0 flex items-center justify-center">{step}</span>
                    <p className="text-xs text-muted-foreground">{text} <span className="font-medium text-foreground">{highlight}</span>{icon}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 px-5 py-8 lg:px-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PesitoLogo size="sm" />
            <span className="text-sm text-muted-foreground font-medium">Pesito</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Desarrollado por</span>
            <a href="https://github.com/MarcosPiv" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer group">
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">Marcos Pividori</span>
              <Github className="w-3.5 h-3.5" />
            </a>
            <a href="https://github.com/marcospoet" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer group">
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">Marcos Poet</span>
              <Github className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>

    </div>
    </MotionConfig>
    </PerfContext.Provider>
  )
}

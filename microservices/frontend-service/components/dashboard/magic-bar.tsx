"use client"

import { useRef, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Send, StickyNote, ImagePlus, Camera,
  Mic, Loader2, DollarSign, Trash2, Settings,
  CalendarIcon, PenLine, Paperclip, Lock, FileText, ChevronLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import type { ExchangeRateType } from "@/lib/app-context"
import type { Attachment } from "./shared"

interface RateOption {
  key: ExchangeRateType
  label: string
  emoji: string
  value: number | null | undefined
}

interface MagicBarProps {
  chatOpen: boolean
  magicInput: string
  setMagicInput: (v: string) => void
  isProcessing: boolean
  processingLabel?: string
  attachments: Attachment[]
  removeAttachment: (i: number) => void
  newCurrency: "ARS" | "USD"
  setNewCurrency: React.Dispatch<React.SetStateAction<"ARS" | "USD">>
  newExRateType: ExchangeRateType
  setNewExRateType: (t: ExchangeRateType) => void
  newManualRate: string
  setNewManualRate: (v: string) => void
  observation: string
  setObservation: (v: string) => void
  showObservation: boolean
  setShowObservation: (v: boolean) => void
  newTxDate: Date | null
  setNewTxDate: (d: Date | null) => void
  showDatePicker: boolean
  setShowDatePicker: (v: boolean) => void
  rateTypeOptions: RateOption[]
  ratesLoading: boolean
  usdRate: number
  handleMagicSubmit: (e: React.FormEvent) => void
  galleryInputRef: React.RefObject<HTMLInputElement | null>
  cameraInputRef: React.RefObject<HTMLInputElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  startCamera: () => void
  isRecording: boolean
  startRecording: () => void
  stopRecording: (opts?: { cancel?: boolean; autoSubmit?: boolean }) => void
  aiError: string | null
  onManualEntry: () => void
  audioStream: MediaStream | null
}

// Canvas-based waveform — no React state updates during animation
const AudioWaveform = ({ audioStream }: { audioStream: MediaStream | null }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !audioStream) return

    // Sync canvas pixel dimensions to its rendered size
    const w = Math.max(wrap.clientWidth || 0, 60)
    const h = 24
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")!

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.65
    audioCtx.createMediaStreamSource(audioStream).connect(analyser)

    const bufLen = analyser.frequencyBinCount
    const data = new Uint8Array(bufLen)
    const BAR = 36
    const gap = 2
    const barW = Math.max(2, (w - (BAR - 1) * gap) / BAR)
    const step = Math.max(1, Math.floor(bufLen / BAR))

    const draw = () => {
      analyser.getByteFrequencyData(data)
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < BAR; i++) {
        let sum = 0
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0
        const avg = sum / step
        const pct = 0.07 + (avg / 255) * 0.93
        const bh = Math.max(3, h * pct)
        const x = i * (barW + gap)
        const y = (h - bh) / 2
        ctx.fillStyle = `rgba(52,211,153,${0.38 + (avg / 255) * 0.62})`
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, barW, bh, 1)
        else ctx.rect(x, y, barW, bh)
        ctx.fill()
      }
      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      audioCtx.close().catch(() => {})
    }
  }, [audioStream])

  return (
    <div ref={wrapRef} className="flex-1 min-w-0 h-6">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

export function MagicBar({
  chatOpen,
  magicInput,
  setMagicInput,
  isProcessing,
  attachments,
  removeAttachment,
  newCurrency,
  setNewCurrency,
  newExRateType,
  setNewExRateType,
  newManualRate,
  setNewManualRate,
  observation,
  setObservation,
  showObservation,
  setShowObservation,
  newTxDate,
  setNewTxDate,
  showDatePicker,
  setShowDatePicker,
  rateTypeOptions,
  ratesLoading,
  usdRate,
  handleMagicSubmit,
  galleryInputRef,
  cameraInputRef,
  fileInputRef,
  handleImageSelect,
  handleFileSelect,
  startCamera,
  isRecording,
  startRecording,
  stopRecording,
  aiError,
  onManualEntry,
  audioStream,
  processingLabel = "Analizando con IA...",
}: MagicBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  // Precompute preset dates for inline chips
  const presetDates = [0, 1, 2].map(days => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d
  })
  const isPresetDate = newTxDate ? presetDates.some(d => d.toDateString() === newTxDate.toDateString()) : false
  const isCustomDate = newTxDate !== null && !isPresetDate
  const [isClickMode, setIsClickMode] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragX, setDragX] = useState(0)
  const touchStartY = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } else {
      setRecordingTime(0)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  // Reset gesture state when recording stops
  useEffect(() => {
    if (!isRecording) {
      setIsClickMode(false)
      setIsLocked(false)
      setDragX(0)
      setDragY(0)
    }
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 80)}px`
  }, [magicInput])

  // `/` keyboard shortcut — focus magic bar textarea
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      textareaRef.current?.focus()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  // Derived: progress toward each threshold (0–1)
  const lockProgress = Math.min(dragY / 100, 1)
  const cancelProgress = Math.min(dragX / 100, 1)

  return (
    <div
      className={`fixed bottom-0 left-0 z-40 bg-background border-t border-border transition-[right] duration-300 ease-out ${chatOpen ? "right-0 lg:right-80 xl:right-96" : "right-0"
        }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">

        {/* Hidden file inputs */}
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} multiple />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />

        <div className="magic-border rounded-xl p-[1px]">
          <div className="bg-background rounded-[11px] px-4 py-3">

            {/* Attachment previews */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  className="flex flex-wrap gap-2 mb-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {attachments.map((att, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      {att.type === "image" ? (
                        <img src={att.url} alt={att.name} className="w-7 h-7 rounded object-cover" />
                      ) : att.type === "audio" ? (
                        <div className="flex items-center justify-center w-7 h-7 rounded bg-accent/20">
                          <Mic className="w-3.5 h-3.5 text-accent" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-7 h-7 rounded bg-primary/15">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                      <span className="max-w-20 truncate">{att.name}</span>
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        onClick={() => removeAttachment(i)}
                        aria-label={`Eliminar ${att.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* USD rate type selector */}
            <AnimatePresence>
              {newCurrency === "USD" && (
                <motion.div
                  className="mb-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {rateTypeOptions.map((opt) => {
                      const isSelected = newExRateType === opt.key
                      const hasValue = opt.value != null
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setNewExRateType(opt.key)}
                          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-border/80"
                            }`}
                        >
                          <span className="leading-none">{opt.emoji}</span>
                          <span>{opt.label}</span>
                          {opt.key !== "MANUAL" && (
                            <span className={`tabular-nums font-mono ${isSelected ? "opacity-80" : "opacity-55"}`}>
                              {hasValue
                                ? `· $${opt.value!.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                                : ratesLoading
                                  ? "· …"
                                  : ""}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Manual rate input */}
                  <AnimatePresence>
                    {newExRateType === "MANUAL" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-2"
                      >
                        <div className="flex items-center gap-2 bg-chart-5/10 border border-chart-5/25 rounded-lg px-3 py-2">
                          <DollarSign className="w-3.5 h-3.5 text-chart-5 shrink-0" />
                          <span className="text-xs text-chart-5/80 font-medium whitespace-nowrap">1 USD =</span>
                          <input
                            type="number"
                            value={newManualRate}
                            onChange={(e) => setNewManualRate(e.target.value)}
                            placeholder={usdRate.toString()}
                            className="flex-1 min-w-0 bg-transparent text-sm text-chart-5 font-mono outline-none placeholder:text-chart-5/40"
                            min={1}
                            step={50}
                            aria-label="Cotización manual"
                          />
                          <span className="text-xs text-chart-5/80 font-medium">ARS</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Observation row */}
            <AnimatePresence>
              {showObservation && (
                <motion.div
                  className="mb-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Input
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Observacion (opcional)..."
                    className="border-0 bg-secondary/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-xs rounded-lg"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attach expand menu */}
            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  className="flex gap-2 mb-3 pb-2.5 border-b border-border/40 overflow-hidden"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <button
                    type="button"
                    onClick={() => { galleryInputRef.current?.click(); setShowAttachMenu(false) }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4 text-primary" />
                    <span>Galería</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { startCamera(); setShowAttachMenu(false) }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-primary" />
                    <span>Ticket</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false) }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span>PDF</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main form */}
            <form onSubmit={handleMagicSubmit}>

              {/* Input row */}
              <div className="flex items-center gap-1.5 mb-2 relative">
                {isRecording ? (
                  /* ── Recording row ── */
                  <div className="flex-1 flex items-center min-w-0 gap-2">
                    {/* Timer + pulse dot */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                      <span className="font-mono text-sm tabular-nums">{formatTime(recordingTime)}</span>
                    </div>

                    {/* Real-time waveform (canvas-based) */}
                    <AudioWaveform audioStream={audioStream} />

                    {/* Slide-to-cancel hint — fades as user drags left */}
                    {!isClickMode && !isLocked && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: Math.max(0, 1 - cancelProgress * 1.2) }}
                        className="flex items-center gap-0.5 shrink-0 text-muted-foreground/70 pointer-events-none"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <span className="text-[10px] font-medium tracking-wide whitespace-nowrap">Cancelar</span>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-accent shrink-0" />
                    <textarea
                      ref={textareaRef}
                      value={magicInput}
                      onChange={(e) => setMagicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          e.currentTarget.form?.requestSubmit()
                        }
                      }}
                      placeholder="Pague 12000 en el super..."
                      rows={1}
                      maxLength={300}
                      className="flex-1 min-w-0 border-0 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm resize-none overflow-y-auto leading-5 py-0 max-h-[80px]"
                      disabled={isProcessing}
                    />
                  </>
                )}

                {/* Attach / Trash (locked mode) / Attach button */}
                <div className="flex items-center shrink-0 min-w-8">
                  <AnimatePresence mode="popLayout">
                    {isLocked ? (
                      <motion.button
                        key="trash-btn"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        type="button"
                        onClick={() => {
                          stopRecording({ cancel: true });
                          setIsLocked(false);
                          setIsClickMode(false);
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        aria-label="Eliminar grabación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    ) : isRecording ? (
                      /* Empty placeholder so layout doesn't shift */
                      <motion.div key="recording-spacer" className="w-8" />
                    ) : (
                      <motion.button
                        key="attach-btn"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        type="button"
                        onClick={() => setShowAttachMenu((v) => !v)}
                        className={`shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer ${showAttachMenu
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          }`}
                        aria-label="Adjuntar archivo"
                      >
                        <Paperclip className="w-4 h-4" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Buttons (Record or Send) */}
                <div className="relative flex items-center shrink-0">
                  {/* MOBILE: single slot that swaps between mic and send */}
                  <div className="flex md:hidden relative w-9 h-9 items-center justify-center">
                    {magicInput.trim().length === 0 && attachments.length === 0 ? (
                      <>
                        {/* Lock indicator — rises and highlights as dragY increases */}
                        <AnimatePresence>
                          {isRecording && !isClickMode && !isLocked && (
                            <motion.div
                              key="lock-indicator"
                              initial={{ opacity: 0, y: 0, scale: 0.6 }}
                              animate={{
                                opacity: 0.35 + lockProgress * 0.65,
                                y: -(32 + dragY * 0.7),
                                scale: 0.8 + lockProgress * 0.2,
                              }}
                              exit={{ opacity: 0, scale: 0.4, y: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 28 }}
                              className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                            >
                              <div
                                className="p-1.5 rounded-full transition-colors duration-75"
                                style={{
                                  background: lockProgress > 0.6
                                    ? "rgba(52,211,153,0.2)"
                                    : "rgba(255,255,255,0.08)",
                                }}
                              >
                                <Lock
                                  className="w-3.5 h-3.5 transition-colors duration-75"
                                  style={{
                                    color: lockProgress > 0.6
                                      ? "rgb(52,211,153)"
                                      : "rgba(255,255,255,0.45)",
                                  }}
                                />
                              </div>
                              <div
                                className="w-px mt-0.5 transition-all duration-75"
                                style={{
                                  height: Math.max(3, 10 - lockProgress * 7),
                                  background: lockProgress > 0.6
                                    ? "rgba(52,211,153,0.5)"
                                    : "rgba(255,255,255,0.2)",
                                }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <Button
                          type="button"
                          size="icon"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            if (e.pointerType === "mouse") {
                              setIsClickMode(true);
                              if (isRecording) {
                                stopRecording({ autoSubmit: true });
                                setIsLocked(false);
                              } else {
                                startRecording();
                              }
                            } else {
                              setIsClickMode(false);
                              if (isLocked) {
                                stopRecording({ autoSubmit: true });
                                setIsLocked(false);
                              } else {
                                startRecording();
                                setIsLocked(false);
                                setDragY(0);
                                setDragX(0);
                                touchStartY.current = e.clientY;
                                touchStartX.current = e.clientX;
                                e.currentTarget.setPointerCapture(e.pointerId);
                              }
                            }
                          }}
                          onPointerMove={(e) => {
                            if (e.pointerType === "mouse") return;
                            if (!isRecording || isLocked || touchStartY.current === null || touchStartX.current === null) return;

                            const deltaY = touchStartY.current - e.clientY;
                            const deltaX = touchStartX.current - e.clientX;
                            setDragY(Math.max(0, deltaY));
                            setDragX(Math.max(0, deltaX));

                            if (deltaY > 100) {
                              setIsLocked(true);
                              setDragY(0);
                              setDragX(0);
                              touchStartY.current = null;
                              touchStartX.current = null;
                            } else if (deltaX > 100) {
                              stopRecording({ cancel: true });
                              setIsLocked(false);
                              setDragY(0);
                              setDragX(0);
                              touchStartY.current = null;
                              touchStartX.current = null;
                            }
                          }}
                          onPointerUp={(e) => {
                            if (e.pointerType !== "mouse") {
                              e.currentTarget.releasePointerCapture(e.pointerId);
                              if (!isLocked) {
                                stopRecording({ autoSubmit: true });
                              }
                              setDragY(0);
                              setDragX(0);
                              touchStartY.current = null;
                              touchStartX.current = null;
                            }
                          }}
                          onPointerLeave={(e) => {
                            if (e.pointerType !== "mouse" && isRecording && !isLocked) {
                              stopRecording({ cancel: true });
                            }
                            setDragY(0);
                            setDragX(0);
                          }}
                          onPointerCancel={(e) => {
                            if (e.pointerType !== "mouse") {
                              if (!isLocked) stopRecording({ cancel: true });
                              setDragY(0);
                              setDragX(0);
                              touchStartY.current = null;
                              touchStartX.current = null;
                            }
                          }}
                          disabled={isProcessing}
                          style={{
                            transform: dragY > 0 && !isLocked
                              ? `translateY(-${dragY}px)`
                              : dragX > 0 && !isLocked
                                ? `translateX(-${dragX}px)`
                                : "none",
                            transition: dragY === 0 && dragX === 0 ? "transform 0.2s ease" : "none",
                          }}
                          className={`absolute inset-0 w-full h-full transition-colors select-none touch-none cursor-pointer z-10 ${isRecording
                            ? isLocked
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                              : "bg-destructive text-destructive-foreground hover:bg-destructive/90 scale-110 shadow-[0_0_18px_rgba(239,68,68,0.55)]"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                          aria-label={isRecording ? (isLocked ? "Enviar grabación" : "Soltar para enviar") : "Mantener para grabar"}
                        >
                          {isLocked
                            ? <Send className="w-4 h-4 ml-0.5" />
                            : isRecording
                              ? <Mic className="w-4 h-4 animate-pulse" />
                              : <Mic className="w-4 h-4" />
                          }
                        </Button>
                      </>
                    ) : (
                      /* Send button when text is entered */
                      <Button
                        type="submit"
                        size="icon"
                        className="absolute inset-0 w-full h-full bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer transition-all"
                        disabled={isProcessing}
                        aria-label="Enviar"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* DESKTOP: idle → Mic+Send; recording → Trash+Send */}
                  <div className="hidden md:flex items-center gap-1.5 shrink-0">
                    <AnimatePresence mode="popLayout">
                      {isRecording && isClickMode ? (
                        <motion.div
                          key="desktop-recording"
                          className="flex items-center gap-1.5"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Button
                            type="button"
                            size="icon"
                            onClick={() => { stopRecording({ cancel: true }); setIsClickMode(false) }}
                            className="bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer"
                            aria-label="Cancelar grabación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            onClick={() => { stopRecording({ autoSubmit: true }); setIsClickMode(false) }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-md"
                            aria-label="Enviar audio"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="desktop-idle"
                          className="flex items-center gap-1.5"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Button
                            type="button"
                            size="icon"
                            onPointerDown={(e) => {
                              e.preventDefault()
                              setIsClickMode(true)
                              startRecording()
                            }}
                            disabled={isProcessing}
                            className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                            aria-label="Grabar audio"
                          >
                            <Mic className="w-4 h-4" />
                          </Button>
                          <Button
                            type="submit"
                            size="icon"
                            disabled={isProcessing}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer"
                            aria-label="Enviar"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Extras: Fecha + Nota chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                {/* Currency toggle */}
                <button
                  type="button"
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono border transition-colors cursor-pointer ${newCurrency === "USD"
                    ? "border-chart-5/40 bg-chart-5/10 text-chart-5"
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  onClick={() => setNewCurrency((p) => (p === "ARS" ? "USD" : "ARS"))}
                  title="Cambiar moneda"
                >
                  {newCurrency}
                </button>
                {[{ label: "Hoy", days: 0 }, { label: "Ayer", days: 1 }, { label: "2 días", days: 2, hideOnMobile: true }].map(({ label, days, hideOnMobile }) => {
                  const target = presetDates[days]
                  const isActive = newTxDate?.toDateString() === target.toDateString()
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setNewTxDate(isActive ? null : target)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${hideOnMobile ? "hidden sm:inline-flex" : ""} ${isActive
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      aria-label={label}
                    >
                      {label}
                    </button>
                  )
                })}
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${isCustomDate
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      aria-label="Elegir fecha"
                    >
                      <CalendarIcon className="w-3 h-3 shrink-0" />
                      <span>
                        {isCustomDate
                          ? newTxDate!.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
                          : "Elegir"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start" side="top">
                    <Calendar
                      mode="single"
                      selected={newTxDate ?? undefined}
                      onSelect={(date) => { setNewTxDate(date ?? null); setShowDatePicker(false) }}
                      disabled={(date) => {
                        const today = new Date(); today.setHours(23, 59, 59, 999)
                        return date > today
                      }}
                      onDayClick={(_day, modifiers) => {
                        if (modifiers.disabled) {
                          toast.info("No podés registrar fechas futuras", {
                            description: "Para gastos recurrentes como suscripciones, registrá el movimiento y marcalo como Gasto fijo.",
                            duration: 4000,
                          })
                        }
                      }}
                      locale={es}
                      initialFocus
                    />
                    {newTxDate && (
                      <div className="px-3 pb-3 border-t border-border pt-2">
                        <button
                          type="button"
                          className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors cursor-pointer"
                          onClick={() => { setNewTxDate(null); setShowDatePicker(false) }}
                        >
                          Usar fecha de hoy
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <button
                  type="button"
                  onClick={() => setShowObservation(!showObservation)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${showObservation
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  aria-label="Agregar nota"
                >
                  <StickyNote className="w-3 h-3 shrink-0" />
                  <span>Nota</span>
                </button>

                {magicInput.length > 0 && (
                  <div className="ml-auto flex items-center pr-1">
                    <span className={`text-[10px] tabular-nums font-medium ${magicInput.length >= 270 ? "text-destructive" : "text-muted-foreground/60"}`}>
                      {magicInput.length}/300
                    </span>
                  </div>
                )}
              </div>

            </form>
          </div>
        </div>

        {/* Ir a carga manual */}
        <div className="flex justify-center mt-1.5">
          <button
            type="button"
            onClick={onManualEntry}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer py-1"
          >
            <PenLine className="w-3 h-3" />
            <span>Ir a carga manual</span>
          </button>
        </div>

        {/* AI error */}
        <AnimatePresence>
          {aiError && (
            <motion.div
              className="flex items-center gap-2 mt-2 text-xs text-destructive"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Settings className="w-3 h-3 shrink-0" />
              <span>{aiError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing indicator */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              className="flex items-center gap-2 mt-2 text-xs text-accent"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{processingLabel}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

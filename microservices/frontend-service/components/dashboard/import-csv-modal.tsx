"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, Wand2, Loader2, Check, ChevronDown, X, AlertCircle, FileUp } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTransactions } from "@/lib/transactions-context"
import { useSettings } from "@/lib/settings-context"
import { callAICSVMapping, type CSVMapping } from "@/lib/ai"
import { CATEGORY_ICON_MAP } from "@/components/dashboard/shared"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "upload" | "mapping" | "preview" | "done"

interface Mapping {
  dateCol: string
  descCol: string
  amountCol: string    // single signed column ("" = not used)
  debitCol: string     // separate debit column ("" = not used)
  creditCol: string    // separate credit column ("" = not used)
  dateFormat: string
  invertSign: boolean  // positive = expense (some banks)
}

interface ParsedRow {
  date: Date
  description: string
  amount: number
  type: "income" | "expense"
  category: string
  icon: string
  rowIndex: number
}

// ── CSV parsing utilities ─────────────────────────────────────────────────────
async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer)
  // If there are replacement characters, try windows-1252 (common in Argentine bank exports)
  if (utf8.includes("\uFFFD")) {
    try { return new TextDecoder("windows-1252").decode(buffer) } catch { /* ignore */ }
  }
  // Strip BOM if present
  return utf8.startsWith("\uFEFF") ? utf8.slice(1) : utf8
}

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  if (text.startsWith("\uFEFF")) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [] }

  // Detect separator
  const first = lines[0]
  const seps = [";", ",", "\t", "|"]
  const sep = seps.reduce((best, s) =>
    first.split(s).length > first.split(best).length ? s : best, ",")

  function parseLine(line: string): string[] {
    const cells: string[] = []
    let cell = "", inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cell += '"'; i++ }
        else inQ = !inQ
      } else if (ch === sep && !inQ) {
        cells.push(cell.trim().replace(/^"|"$/g, ""))
        cell = ""
      } else {
        cell += ch
      }
    }
    cells.push(cell.trim().replace(/^"|"$/g, ""))
    return cells
  }

  const allRows = lines.map(parseLine).filter(r => r.some(c => c))
  if (!allRows.length) return { headers: [], rows: [] }

  // Check if first row is headers (at least one non-numeric cell)
  const firstRow = allRows[0]
  const isHeader = firstRow.some(c => c && isNaN(parseFloat(c.replace(/[.,\s$%]/g, ""))))
  return isHeader
    ? { headers: firstRow, rows: allRows.slice(1) }
    : { headers: firstRow.map((_, i) => `Col ${i + 1}`), rows: allRows }
}

function parseDate(str: string, fmt: string): Date | null {
  if (!str?.trim()) return null
  try {
    const s = str.trim()
    if (fmt === "dd/mm/yyyy" || fmt === "dd-mm-yyyy") {
      const sep = fmt.includes("/") ? "/" : "-"
      const [d, m, y] = s.split(sep).map(Number)
      if (!d || !m || !y) return null
      const dt = new Date(y, m - 1, d)
      return isNaN(dt.getTime()) ? null : dt
    }
    if (fmt === "mm/dd/yyyy") {
      const [m, d, y] = s.split("/").map(Number)
      const dt = new Date(y, m - 1, d)
      return isNaN(dt.getTime()) ? null : dt
    }
    if (fmt === "yyyy-mm-dd") {
      const dt = new Date(s)
      return isNaN(dt.getTime()) ? null : dt
    }
    const dt = new Date(s)
    return isNaN(dt.getTime()) ? null : dt
  } catch { return null }
}

function parseAmount(str: string): number {
  if (!str?.trim()) return 0
  let s = str.trim().replace(/\s/g, "").replace(/^\$/, "")
  const neg = s.startsWith("-") || (s.startsWith("(") && s.endsWith(")"))
  s = s.replace(/[()]/g, "").replace(/^-/, "")
  let n: number
  if (s.includes(",") && s.includes(".")) {
    // Detect European vs US format
    n = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? parseFloat(s.replace(/\./g, "").replace(",", "."))  // 1.234,56
      : parseFloat(s.replace(/,/g, ""))                      // 1,234.56
  } else if (s.includes(",")) {
    const parts = s.split(",")
    n = parts.length === 2 && parts[1].length <= 2
      ? parseFloat(s.replace(",", "."))   // decimal comma: 1234,56
      : parseFloat(s.replace(/,/g, ""))   // thousands: 1,234
  } else if (s.includes(".")) {
    const parts = s.split(".")
    // If all after dot are > 2 chars, it's a thousands separator
    n = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1)
      ? parseFloat(s.replace(/\./g, ""))  // 1.234 → 1234
      : parseFloat(s)                      // 1234.56
  } else {
    n = parseFloat(s) || 0
  }
  return neg ? -n : n
}

function detectDateFormat(samples: string[]): CSVMapping["dateFormat"] {
  for (const s of samples.filter(Boolean).slice(0, 5)) {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "yyyy-mm-dd"
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [a] = s.split("/").map(Number)
      return a > 12 ? "dd/mm/yyyy" : "dd/mm/yyyy" // default Argentine
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return "dd-mm-yyyy"
  }
  return "dd/mm/yyyy"
}

function guessCategory(desc: string): { category: string; icon: string } {
  const d = desc.toLowerCase()
  if (/super|mercado|carrefour|coto|jumbo|walmart|disco|vea|dia|almacen|kiosco|panaderia|farmacia/.test(d))
    return { category: "Comida", icon: "ShoppingCart" }
  if (/taxi|uber|cabify|colectivo|subte|tren|peaje|nafta|combustible|estacion|garage/.test(d))
    return { category: "Transporte", icon: "Car" }
  if (/netflix|spotify|disney|hbo|prime|suscripcion|streaming|software|apple/.test(d))
    return { category: "Suscripciones", icon: "Code" }
  if (/gym|pilates|yoga|natacion|futbol|padel|deporte|crossfit/.test(d))
    return { category: "Deporte", icon: "Dumbbell" }
  if (/restaurant|resto|bar|cafe|pizza|empanada|sushi|delivery|pedidos|rappi|burger/.test(d))
    return { category: "Salidas", icon: "Coffee" }
  if (/sueldo|salario|haberes|cobro|honorario|freelance|ingreso|acreditacion|transferencia recib/.test(d))
    return { category: "Trabajo", icon: "ArrowDownLeft" }
  if (/medico|hospital|clinica|prepaga|obra social/.test(d))
    return { category: "Salud", icon: "Dumbbell" }
  if (/colegio|universidad|escuela|curso|libro|libreria/.test(d))
    return { category: "Educacion", icon: "Dumbbell" }
  return { category: "General", icon: "ShoppingCart" }
}

function buildRows(
  rows: string[][],
  mapping: Mapping,
): { ok: ParsedRow[]; failed: number } {
  const ok: ParsedRow[] = []
  let failed = 0
  const toIdx = (s: string) => s === "" ? -1 : parseInt(s)
  const dI = toIdx(mapping.dateCol)
  const descI = toIdx(mapping.descCol)
  const amtI = toIdx(mapping.amountCol)
  const debI = toIdx(mapping.debitCol)
  const creI = toIdx(mapping.creditCol)

  rows.forEach((row, i) => {
    const rawDate = dI >= 0 ? row[dI] : ""
    const rawDesc = descI >= 0 ? row[descI] : ""
    const date = parseDate(rawDate, mapping.dateFormat)
    if (!date || !rawDesc.trim()) { failed++; return }

    let amount = 0
    let type: "income" | "expense" = "expense"

    if (amtI >= 0) {
      amount = parseAmount(row[amtI])
      type = mapping.invertSign ? (amount >= 0 ? "expense" : "income") : (amount < 0 ? "expense" : "income")
      amount = Math.abs(amount)
    } else if (debI >= 0 || creI >= 0) {
      const deb = debI >= 0 ? Math.abs(parseAmount(row[debI])) : 0
      const cre = creI >= 0 ? Math.abs(parseAmount(row[creI])) : 0
      if (deb > 0) { amount = deb; type = "expense" }
      else if (cre > 0) { amount = cre; type = "income" }
      else { failed++; return }
    } else { failed++; return }

    if (!amount || amount < 1) { failed++; return }

    const description = rawDesc.trim().slice(0, 60)
    const { category, icon } = guessCategory(description)
    ok.push({ date, description, amount, type, category, icon, rowIndex: i })
  })
  return { ok, failed }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ColSelect({ label, value, onChange, headers, optional = false }: {
  label: string; value: string; onChange: (v: string) => void; headers: string[]; optional?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="relative flex-1">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground pr-7 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{optional ? "— no aplica —" : "— seleccionar —"}</option>
          {headers.map((h, i) => <option key={i} value={String(i)}>{h || `Col ${i + 1}`}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface ImportCsvModalProps { open: boolean; onClose: () => void }

export function ImportCsvModal({ open, onClose }: ImportCsvModalProps) {
  const { addTransaction } = useTransactions()
  const { apiKey, aiProvider } = useSettings()

  const [step, setStep] = useState<Step>("upload")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>({
    dateCol: "", descCol: "", amountCol: "", debitCol: "", creditCol: "",
    dateFormat: "dd/mm/yyyy", invertSign: false,
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [failedCount, setFailedCount] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload"); setHeaders([]); setRows([]); setParsedRows([])
    setSelected(new Set()); setFailedCount(0); setImportedCount(0)
    setMapping({ dateCol: "", descCol: "", amountCol: "", debitCol: "", creditCol: "", dateFormat: "dd/mm/yyyy", invertSign: false })
  }

  function handleClose() { reset(); onClose() }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Solo se admiten archivos .csv")
      return
    }
    const text = await readFileWithEncoding(file)
    const { headers: h, rows: r } = parseCSVText(text)
    if (!h.length || !r.length) { toast.error("No se pudo leer el archivo. Verificá que sea un CSV válido."); return }
    setHeaders(h)
    setRows(r)
    // Auto-detect date format from first non-empty column
    const probableDateCol = h.findIndex(c => /fecha|date|dia|día/i.test(c))
    if (probableDateCol >= 0) {
      const samples = r.slice(0, 5).map(row => row[probableDateCol]).filter(Boolean)
      const fmt = detectDateFormat(samples)
      setMapping(m => ({ ...m, dateFormat: fmt, dateCol: String(probableDateCol) }))
    }
    setStep("mapping")
  }

  async function handleDetectWithAI() {
    if (!apiKey?.trim()) { toast.error("Configurá tu API key en Configuración para usar la detección automática."); return }
    setAiLoading(true)
    try {
      const result = await callAICSVMapping(aiProvider, headers, rows.slice(0, 3))
      if (!result) { toast.error("La IA no pudo identificar las columnas. Mapeá manualmente."); return }
      setMapping(m => ({
        ...m,
        dateCol: String(result.dateCol),
        descCol: String(result.descCol),
        amountCol: result.amountCol !== null ? String(result.amountCol) : "",
        debitCol: result.debitCol !== null ? String(result.debitCol) : "",
        creditCol: result.creditCol !== null ? String(result.creditCol) : "",
        dateFormat: result.dateFormat,
      }))
      toast.success("Columnas detectadas")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al detectar columnas")
    } finally {
      setAiLoading(false)
    }
  }

  function handlePreview() {
    if (!mapping.dateCol || !mapping.descCol) {
      toast.error("Seleccioná al menos la columna de Fecha y Descripción.")
      return
    }
    if (!mapping.amountCol && !mapping.debitCol && !mapping.creditCol) {
      toast.error("Seleccioná al menos una columna de monto.")
      return
    }
    const { ok, failed } = buildRows(rows, mapping)
    if (!ok.length) { toast.error("No se encontraron transacciones válidas en el archivo."); return }
    setParsedRows(ok)
    setFailedCount(failed)
    setSelected(new Set(ok.map((_, i) => i)))
    setStep("preview")
  }

  async function handleImport() {
    const toImport = parsedRows.filter((_, i) => selected.has(i))
    if (!toImport.length) { toast.error("Seleccioná al menos una transacción."); return }
    setImporting(true)
    let count = 0
    for (const tx of toImport) {
      await addTransaction({
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        icon: tx.icon,
        date: tx.date,
        currency: "ARS",
      })
      count++
    }
    setImportedCount(count)
    setImporting(false)
    setStep("done")
  }

  const toggleAll = () => {
    setSelected(s => s.size === parsedRows.length ? new Set() : new Set(parsedRows.map((_, i) => i)))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileUp className="w-4 h-4 text-primary" />
            Importar desde CSV
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-2">
            {(["upload", "mapping", "preview", "done"] as Step[]).map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
                step === "done" || (["upload","mapping","preview"].indexOf(step) >= i)
                  ? "bg-primary" : "bg-border"
              }`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Upload ─────────────────────────────────────── */}
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-5 flex flex-col gap-4"
              >
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Arrastrá o clickeá para subir</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Archivo .csv · hasta 5MB</p>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Compatible con Galicia · BBVA · Santander · Naranja X · Mercado Pago · y más</p>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Mapping ────────────────────────────────────── */}
            {step === "mapping" && (
              <motion.div
                key="mapping"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-5 flex flex-col gap-4"
              >
                {/* Preview table */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Vista previa ({rows.length} filas)</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="text-[10px] w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          {headers.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap max-w-[100px] truncate">{h || `Col ${i+1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="border-t border-border/50">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1.5 text-foreground whitespace-nowrap max-w-[100px] truncate">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI detect button */}
                {apiKey?.trim() && (
                  <button
                    type="button"
                    onClick={handleDetectWithAI}
                    disabled={aiLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors disabled:opacity-50 self-start cursor-pointer"
                  >
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Detectar columnas con IA
                  </button>
                )}

                {/* Column mapping */}
                <div className="flex flex-col gap-2.5">
                  <ColSelect label="Fecha *" value={mapping.dateCol} onChange={v => setMapping(m => ({ ...m, dateCol: v }))} headers={headers} />
                  <ColSelect label="Descripción *" value={mapping.descCol} onChange={v => setMapping(m => ({ ...m, descCol: v }))} headers={headers} />
                  <ColSelect label="Monto (firmado)" value={mapping.amountCol} onChange={v => setMapping(m => ({ ...m, amountCol: v }))} headers={headers} optional />
                  <ColSelect label="Débito / Egreso" value={mapping.debitCol} onChange={v => setMapping(m => ({ ...m, debitCol: v }))} headers={headers} optional />
                  <ColSelect label="Crédito / Ingreso" value={mapping.creditCol} onChange={v => setMapping(m => ({ ...m, creditCol: v }))} headers={headers} optional />
                </div>

                {/* Date format + invert sign */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">Formato fecha</span>
                    <div className="relative flex-1">
                      <select
                        value={mapping.dateFormat}
                        onChange={e => setMapping(m => ({ ...m, dateFormat: e.target.value }))}
                        className="w-full appearance-none bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground pr-7 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="dd/mm/yyyy">dd/mm/yyyy (Argentina)</option>
                        <option value="yyyy-mm-dd">yyyy-mm-dd (ISO)</option>
                        <option value="mm/dd/yyyy">mm/dd/yyyy (EE.UU.)</option>
                        <option value="dd-mm-yyyy">dd-mm-yyyy</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  {mapping.amountCol !== "" && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mapping.invertSign}
                        onChange={e => setMapping(m => ({ ...m, invertSign: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">Invertir signo (positivo = gasto)</span>
                    </label>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setStep("upload")} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                    Atrás
                  </button>
                  <button type="button" onClick={handlePreview} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer">
                    Ver transacciones →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Preview ────────────────────────────────────── */}
            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex flex-col"
              >
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-card z-10">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleAll} className="text-[11px] text-primary hover:underline cursor-pointer">
                      {selected.size === parsedRows.length ? "Deseleccionar todo" : "Seleccionar todo"}
                    </button>
                    <span className="text-[11px] text-muted-foreground">({selected.size}/{parsedRows.length})</span>
                  </div>
                  {failedCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-500">
                      <AlertCircle className="w-3 h-3" />
                      {failedCount} filas ignoradas
                    </div>
                  )}
                </div>

                {/* Transaction list */}
                <div className="divide-y divide-border/50">
                  {parsedRows.map((tx, i) => (
                    <label key={i} className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${selected.has(i) ? "" : "opacity-50"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(i) : n.delete(i); return n })}
                        className="w-3.5 h-3.5 accent-primary shrink-0"
                      />
                      <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: tx.type === "income" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)" }}>
                        {tx.type === "income" ? "+" : "−"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {tx.date.toLocaleDateString("es-AR")} · {tx.category}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${tx.type === "income" ? "text-primary" : "text-foreground"}`}>
                        ${tx.amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 p-5 border-t border-border sticky bottom-0 bg-card">
                  <button type="button" onClick={() => setStep("mapping")} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || !selected.size}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importando...</> : `Importar ${selected.size} transacciones`}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Done ───────────────────────────────────────── */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="p-8 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                  <Check className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{importedCount} transacciones importadas</p>
                  <p className="text-sm text-muted-foreground mt-1">Aparecen en tu dashboard ahora mismo.</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Listo
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}

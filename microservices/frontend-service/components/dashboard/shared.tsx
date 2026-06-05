import type { LucideIcon } from "lucide-react"
import { ShoppingCart, Dumbbell, Code, Car, Coffee, ArrowDownLeft, GraduationCap, Heart, Briefcase, UtensilsCrossed, Tag } from "lucide-react"

export const iconMap: Record<string, LucideIcon> = {
  ShoppingCart,
  Dumbbell,
  Code,
  Car,
  Coffee,
  ArrowDownLeft,
  GraduationCap,
  Heart,
  Briefcase,
  UtensilsCrossed,
  Tag,
}

export const VALID_CATEGORIES = [
  "Comida", "Supermercado", "Transporte", "Salidas", "Suscripciones",
  "Deporte", "Educacion", "Salud", "Trabajo", "General",
]

export const CATEGORY_ICON_MAP: Record<string, string> = {
  Comida: "UtensilsCrossed",
  Supermercado: "ShoppingCart",
  Transporte: "Car",
  Salidas: "Coffee",
  Suscripciones: "Code",
  Deporte: "Dumbbell",
  Educacion: "GraduationCap",
  Salud: "Heart",
  Trabajo: "Briefcase",
  General: "Tag",
}

export const ONBOARDING_KEY = "bb_onboarding_v1"

// ── Payment accounts ─────────────────────────────────────────────────────────

export type PaymentAccount = {
  id: string
  name: string
  category: string
  keywords: string[]
}

export const PAYMENT_ACCOUNTS: PaymentAccount[] = [
  // Billeteras Virtuales
  { id: "mercado-pago",  name: "Mercado Pago",  category: "Billetera Virtual",  keywords: ["mercado pago","mercadopago","mercadito","mp "] },
  { id: "uala",          name: "Ualá",           category: "Billetera Virtual",  keywords: ["ualá","uala"] },
  { id: "naranja-x",     name: "Naranja X",      category: "Billetera Virtual",  keywords: ["naranja x","naranjax","naranja"] },
  { id: "personal-pay",  name: "Personal Pay",   category: "Billetera Virtual",  keywords: ["personal pay","personalpay"] },
  { id: "modo",          name: "MODO",           category: "Billetera Virtual",  keywords: ["modo"] },
  { id: "prex",          name: "Prex Argentina", category: "Billetera Virtual",  keywords: ["prex"] },
  { id: "claro-pay",     name: "Claro Pay",      category: "Billetera Virtual",  keywords: ["claro pay","claropay"] },
  { id: "astropay",      name: "Astropay",       category: "Billetera Virtual",  keywords: ["astropay","astro pay"] },
  { id: "moni",          name: "Moni",           category: "Billetera Virtual",  keywords: ["moni"] },
  { id: "pluspagos",     name: "Pluspagos",      category: "Billetera Virtual",  keywords: ["pluspagos","plus pagos"] },
  // Cripto / Inversión
  { id: "lemon",         name: "Lemon Cash",          category: "Cripto/Inversión", keywords: ["lemon","lemon cash"] },
  { id: "belo",          name: "belo",                category: "Cripto/Inversión", keywords: ["belo"] },
  { id: "fiwind",        name: "Fiwind",              category: "Cripto/Inversión", keywords: ["fiwind"] },
  { id: "buenbit",       name: "Buenbit",             category: "Cripto/Inversión", keywords: ["buenbit","buen bit"] },
  { id: "ripio",         name: "Ripio",               category: "Cripto/Inversión", keywords: ["ripio"] },
  { id: "bitso",         name: "Bitso",               category: "Cripto/Inversión", keywords: ["bitso"] },
  { id: "satoshi-tango", name: "SatoshiTango",        category: "Cripto/Inversión", keywords: ["satoshitango","satoshi tango","satoshi"] },
  { id: "cocos",         name: "Cocos Capital",       category: "Cripto/Inversión", keywords: ["cocos","cocos capital"] },
  { id: "ieb",           name: "IEB+",                category: "Cripto/Inversión", keywords: ["ieb+","ieb "] },
  { id: "lb-finanzas",   name: "LB Finanzas",         category: "Cripto/Inversión", keywords: ["lb finanzas"] },
  { id: "n1u",           name: "n1u",                 category: "Cripto/Inversión", keywords: ["n1u"] },
  { id: "iol",           name: "IOL (InvertirOnline)", category: "Cripto/Inversión", keywords: ["iol","invertironline","invertir online"] },
  { id: "banza",         name: "Banza",               category: "Cripto/Inversión", keywords: ["banza"] },
  { id: "balanz",        name: "Balanz",              category: "Cripto/Inversión", keywords: ["balanz"] },
  { id: "bull-market",   name: "Bull Market Brokers", category: "Cripto/Inversión", keywords: ["bull market","bullmarket"] },
  // Bancos Digitales
  { id: "brubank",       name: "Brubank",        category: "Banco Digital", keywords: ["brubank"] },
  { id: "reba",          name: "Reba",           category: "Banco Digital", keywords: ["reba"] },
  { id: "openbank",      name: "Openbank",       category: "Banco Digital", keywords: ["openbank","open bank"] },
  { id: "banco-del-sol", name: "Banco del Sol",  category: "Banco Digital", keywords: ["banco del sol","bancosol"] },
  // Bancos Privados
  { id: "galicia",       name: "Banco Galicia",     category: "Banco Privado", keywords: ["galicia","de galicia"] },
  { id: "santander",     name: "Banco Santander",   category: "Banco Privado", keywords: ["santander"] },
  { id: "bbva",          name: "BBVA",              category: "Banco Privado", keywords: ["bbva","frances","francés"] },
  { id: "macro",         name: "Banco Macro",       category: "Banco Privado", keywords: ["macro","de macro"] },
  { id: "credicoop",     name: "Banco Credicoop",   category: "Banco Privado", keywords: ["credicoop"] },
  { id: "patagonia",     name: "Banco Patagonia",   category: "Banco Privado", keywords: ["patagonia","de patagonia"] },
  { id: "supervielle",   name: "Banco Supervielle", category: "Banco Privado", keywords: ["supervielle"] },
  { id: "icbc",          name: "ICBC",              category: "Banco Privado", keywords: ["icbc"] },
  { id: "hipotecario",   name: "Banco Hipotecario", category: "Banco Privado", keywords: ["hipotecario"] },
  { id: "comafi",        name: "Banco Comafi",      category: "Banco Privado", keywords: ["comafi"] },
  { id: "piano",         name: "Banco Piano",       category: "Banco Privado", keywords: ["piano","banco piano"] },
  { id: "columbia",      name: "Banco Columbia",    category: "Banco Privado", keywords: ["columbia","banco columbia"] },
  { id: "bica",          name: "Banco Bica",        category: "Banco Privado", keywords: ["bica"] },
  { id: "roela",         name: "Banco Roela",       category: "Banco Privado", keywords: ["roela"] },
  // Bancos Públicos
  { id: "bna",           name: "Banco Nación (BNA+)",            category: "Banco Público", keywords: ["bna","banco nacion","banco de la nacion","nacion "] },
  { id: "bapro",         name: "Banco Provincia (Cuenta DNI)",   category: "Banco Público", keywords: ["bapro","banco provincia","cuenta dni","provincia "] },
  { id: "banco-ciudad",  name: "Banco Ciudad (Buepp)",           category: "Banco Público", keywords: ["banco ciudad","buepp"] },
  { id: "bancor",        name: "Banco de Córdoba",               category: "Banco Público", keywords: ["bancor","banco de cordoba","banco córdoba"] },
  { id: "bersa",         name: "Banco Entre Ríos",               category: "Banco Público", keywords: ["bersa","banco entre rios","entre rios "] },
  { id: "nuevo-banco-santa-fe", name: "Nuevo Banco Santa Fe",   category: "Banco Público", keywords: ["nuevo banco santa fe","nbsf","santa fe "] },
  // Efectivo
  { id: "efectivo",      name: "Efectivo",     category: "Efectivo", keywords: ["efectivo","cash","en mano","plata en mano","en efectivo"] },
]

export const ACCOUNT_CATEGORIES = [
  "Billetera Virtual", "Cripto/Inversión", "Banco Digital", "Banco Privado", "Banco Público", "Efectivo",
]

/** Client-side keyword detection — returns account name or undefined */
export function detectAccountFromText(text: string): string | undefined {
  const lower = " " + text.toLowerCase() + " "
  for (const acc of PAYMENT_ACCOUNTS) {
    if (acc.keywords.some(kw => lower.includes(" " + kw) || lower.includes(kw + " ") || lower.includes(kw + ","))) {
      return acc.name
    }
  }
  return undefined
}

export interface ChatMessage {
  role: "bot" | "user"
  text: string
}

export interface Attachment {
  type: "image" | "audio" | "file"
  name: string
  url: string
  file: File
}

export function formatDate(d: Date, type?: "income" | "expense"): string {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const dStart = new Date(d); dStart.setHours(0, 0, 0, 0)
  const diff = Math.round((todayStart.getTime() - dStart.getTime()) / 86400000)
  if (diff < 0) {
    const dateStr = dStart.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
    if (type === "income") return `Se cobrará el ${dateStr}`
    return `Se debitará el ${dateStr}`
  }
  if (diff === 0) return "Hoy"
  if (diff === 1) return "Ayer"
  if (diff < 7) return `Hace ${diff} días`
  return dStart.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "")
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function formatCurrency(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000_000) return `$ ${(abs / 1_000_000_000_000).toFixed(1)}T ARS`
  if (abs >= 1_000_000_000)     return `$ ${(abs / 1_000_000_000).toFixed(1)}B ARS`
  return `$ ${abs.toLocaleString("es-AR")} ARS`
}

export function compressImage(file: File, maxPx = 1200, quality = 0.78): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("Canvas not supported")); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Compression failed")),
        "image/jpeg",
        quality,
      )
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

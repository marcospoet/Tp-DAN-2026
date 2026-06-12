import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Fecha local en formato "YYYY-MM-DD".
 *  NO usar `new Date().toISOString().split("T")[0]` para "hoy": toISOString()
 *  devuelve la fecha UTC — en Argentina (UTC-3), después de las 21:00 eso ya
 *  es el día siguiente y las transacciones quedan fechadas a futuro. */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

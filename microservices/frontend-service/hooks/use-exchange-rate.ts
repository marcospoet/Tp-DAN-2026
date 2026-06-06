"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getToken } from "@/lib/api-client"


export interface DolarRate {
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

export interface ExchangeRates {
  blue: DolarRate | null
  oficial: DolarRate | null
  tarjeta: DolarRate | null
  mep: DolarRate | null
}

interface UseExchangeRateOptions {
  enabled: boolean
  refreshInterval?: number // ms, default 5 minutes
}

interface UseExchangeRateReturn {
  rates: ExchangeRates
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => void
}

const EMPTY_RATES: ExchangeRates = {
  blue: null,
  oficial: null,
  tarjeta: null,
  mep: null,
}

const RATE_NAMES: Record<string, string> = {
  blue: "Blue",
  oficial: "Oficial",
  tarjeta: "Tarjeta",
  mep: "MEP",
}

interface BackendRate {
  type: string
  buyPrice: number
  sellPrice: number
  date: string
}

export function useExchangeRate({
  enabled,
  refreshInterval = 5 * 60 * 1000,
}: UseExchangeRateOptions): UseExchangeRateReturn {
  const [rates, setRates] = useState<ExchangeRates>(EMPTY_RATES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRates = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    try {
      const token = getToken()
      const res = await fetch("/api/rates", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)

      const data: BackendRate[] = await res.json()

      const next: ExchangeRates = { ...EMPTY_RATES }

      for (const item of data) {
        const key = item.type.toLowerCase() as keyof ExchangeRates
        if (key in next) {
          next[key] = {
            nombre: RATE_NAMES[key] ?? item.type,
            compra: Number(item.buyPrice),
            venta: Number(item.sellPrice),
            fechaActualizacion: item.date,
          }
        }
      }

      setRates(next)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al obtener cotizaciones")
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setRates(EMPTY_RATES)
      setError(null)
      return
    }

    fetchRates()

    intervalRef.current = setInterval(fetchRates, refreshInterval)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, fetchRates, refreshInterval])

  return { rates, loading, error, lastUpdated, refresh: fetchRates }
}

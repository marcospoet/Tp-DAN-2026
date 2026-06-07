const API_BASE = ""
export const TOKEN_KEY = "bb_jwt"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY)
}

// Rutas de IA son inherentemente lentas; el resto tiene 15s.
const AI_TIMEOUT_MS = 32_000
const DEFAULT_TIMEOUT_MS = 15_000

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined ?? {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const timeoutMs = path.startsWith("/api/ai") ? AI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const body = await res.json()
        message = body.detail ?? body.message ?? body.error ?? message
      } catch { /* ignore parse error */ }
      const err = new Error(message)
      ;(err as Error & { status: number }).status = res.status
      throw err
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      const timeoutErr = new Error("La solicitud tardó demasiado. Verificá tu conexión e intentá de nuevo.")
      ;(timeoutErr as Error & { status: number }).status = 504
      throw timeoutErr
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

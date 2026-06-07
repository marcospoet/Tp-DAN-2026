import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080"

// Rutas de IA pueden tardar hasta 35s; el resto usa 15s.
const AI_TIMEOUT_MS = 35_000
const DEFAULT_TIMEOUT_MS = 15_000

function getTimeoutMs(pathname: string): number {
  return pathname.startsWith("/api/ai") ? AI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl
  const target = `${BACKEND_URL}${pathname}${search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!["host", "connection", "transfer-encoding", "origin", "referer"].includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : req.body

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs(pathname))

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      // @ts-expect-error — Node fetch duplex required for streaming body
      duplex: "half",
    })

    const resHeaders = new Headers()
    upstream.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        resHeaders.set(key, value)
      }
    })

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    })
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "El servidor tardó demasiado en responder. Intentá de nuevo." }, { status: 504 })
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy

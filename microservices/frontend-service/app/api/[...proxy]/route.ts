import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080"

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

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
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
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy

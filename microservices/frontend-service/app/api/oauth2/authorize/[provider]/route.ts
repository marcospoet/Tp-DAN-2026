import { type NextRequest, NextResponse } from "next/server"
import http from "node:http"
import https from "node:https"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080"

// Ruta dedicada para el inicio del flujo OAuth2.
// El proxy generico [...proxy] usa fetch() que sigue redirects automaticamente;
// aqui usamos node:http directamente para capturar el 302 y reenviarlo al browser.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const target = new URL(`${BACKEND_URL}/oauth2/authorize/${provider}`)

  return new Promise<NextResponse>((resolve) => {
    const mod = target.protocol === "https:" ? https : http
    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search,
      method: "GET",
    }

    const req = mod.request(options, (res) => {
      const location = Array.isArray(res.headers.location)
        ? res.headers.location[0]
        : res.headers.location

      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location) {
        resolve(NextResponse.redirect(location, { status: res.statusCode }))
      } else {
        resolve(NextResponse.json({ error: "OAuth2 no configurado" }, { status: 503 }))
      }
    })

    req.on("error", () => {
      resolve(NextResponse.json({ error: "Backend no disponible" }, { status: 502 }))
    })

    req.end()
  })
}

"use client"

import { useEffect, useState } from "react"
import { getToken } from "@/lib/api-client"
import { FileText, ZoomIn, ExternalLink } from "lucide-react"

export function ReceiptImage({ txId }: { txId: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<string>("image/jpeg")
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [imgReady, setImgReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    setImgReady(false)
    const token = getToken()
    fetch(`/api/transactions/${txId}/receipt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error()
        const ct = res.headers.get("Content-Type") ?? "image/jpeg"
        setContentType(ct)
        return res.blob()
      })
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [txId])

  if (loading) {
    return <div className="h-40 animate-pulse bg-secondary" />
  }
  if (error || !blobUrl) return null

  const isPdf = contentType.includes("pdf")

  if (isPdf) {
    return (
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/80 transition-colors"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 shrink-0">
          <FileText className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Comprobante PDF</p>
          <p className="text-xs text-muted-foreground">Toca para abrir</p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
      </a>
    )
  }

  return (
    <a
      href={blobUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block group/receipt cursor-zoom-in bg-black/5"
    >
      <img
        src={blobUrl}
        alt="Comprobante"
        className={`block w-full max-h-64 object-contain transition-opacity duration-300 ${imgReady ? "opacity-100" : "opacity-0 min-h-40"}`}
        onLoad={() => setImgReady(true)}
        onError={() => setError(true)}
      />
      {!imgReady && (
        <div className="absolute inset-0 animate-pulse bg-secondary" />
      )}
      {imgReady && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/receipt:opacity-100 transition-opacity duration-200 bg-black/30">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-xs font-medium text-white backdrop-blur-sm">
            <ZoomIn className="w-3.5 h-3.5" />
            Ampliar
          </span>
        </div>
      )}
    </a>
  )
}

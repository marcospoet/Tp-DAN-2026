"use client"

// Receipt display is pending Phase E (MinIO migration)
export function ReceiptImage({ path }: { path: string }) {
  void path
  return (
    <p className="text-xs text-muted-foreground/60 italic mb-2">
      Comprobantes disponibles próximamente.
    </p>
  )
}

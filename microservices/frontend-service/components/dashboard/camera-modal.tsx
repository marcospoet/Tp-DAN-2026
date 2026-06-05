"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera } from "lucide-react"

interface CameraModalProps {
  showCamera: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  streamRef: React.MutableRefObject<MediaStream | null>
  stopCamera: () => void
  capturePhoto: () => void
}

export function CameraModal({
  showCamera,
  videoRef,
  canvasRef,
  streamRef,
  stopCamera,
  capturePhoto,
}: CameraModalProps) {
  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [showCamera, videoRef, streamRef])

  return (
    <AnimatePresence>
      {showCamera && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-5 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <p className="text-white/60 text-sm tracking-wide">
            Apunta la cámara al ticket o factura
          </p>

          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
            />
            {/* viewfinder corners */}
            <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/30" />
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-medium hover:bg-white/25 transition-colors cursor-pointer"
              onClick={stopCamera}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
              onClick={capturePhoto}
            >
              <Camera className="w-4 h-4" />
              Capturar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

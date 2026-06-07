"use client"

import { useState, useEffect } from "react"

/** Returns `true` when the browser is likely running without GPU acceleration
 *  (hardware acceleration disabled, software renderer, or user prefers reduced motion).
 *  Use this to disable expensive visual effects like blur filters, 3-D transforms,
 *  and continuous rAF loops that cause jank on CPU-only rendering paths.
 */
export function usePerformanceMode(): boolean {
  const [lowPerf, setLowPerf] = useState(false)

  useEffect(() => {
    // 1. Respect user's accessibility preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLowPerf(true)
      return
    }

    // 2. Mobile devices (touch + small screen) — GPU es real pero la CPU y el ancho
    //    de banda de memoria son mucho más limitados que en desktop. Las animaciones
    //    pesadas (SVG filters, spring physics, marquees) causan jank notorio en mobile.
    if (window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches) {
      setLowPerf(true)
      return
    }

    // 3. Detect software (CPU-only) WebGL renderer.
    //    When Chrome's "Use hardware acceleration when available" is OFF,
    //    WebGL falls back to SwiftShader (software renderer).
    try {
      const canvas = document.createElement("canvas")
      const gl = (
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl")
      ) as WebGLRenderingContext | null

      if (!gl) {
        // No WebGL at all → definitely CPU-only
        setLowPerf(true)
        return
      }

      const ext = gl.getExtension("WEBGL_debug_renderer_info")
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
        // SwiftShader (Chrome SW), llvmpipe / softpipe (Mesa SW), Microsoft Basic Render Driver
        if (/swiftshader|llvmpipe|softpipe|virgl|microsoft basic render/i.test(renderer)) {
          setLowPerf(true)
          return
        }
      }
    } catch {
      // ignore detection errors — assume GPU is fine
    }
  }, [])

  return lowPerf
}

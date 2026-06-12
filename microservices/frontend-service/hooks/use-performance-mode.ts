"use client"

import { useState, useEffect } from "react"

/** Performance tier for visual effects:
 *  - "full": desktop with hardware acceleration — all effects (blur filters,
 *    SVG gooey morph, 3-D tilt, cursor spotlight, springs).
 *  - "lite": mobile devices — only compositor-cheap animations (transform/
 *    opacity: entrance fades, counters, CSS marquee, floating coins). Blur
 *    filters, SVG filters and pointer-driven effects are skipped.
 *  - "off": user prefers reduced motion, or the browser is rendering on CPU
 *    (SwiftShader / llvmpipe / no WebGL) — no continuous animations at all.
 */
export type PerfTier = "full" | "lite" | "off"

export function usePerformanceTier(): PerfTier {
  const [tier, setTier] = useState<PerfTier>("full")

  useEffect(() => {
    // 1. Respect user's accessibility preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTier("off")
      return
    }

    // 2. Detect software (CPU-only) WebGL renderer.
    //    When Chrome's "Use hardware acceleration when available" is OFF,
    //    WebGL falls back to SwiftShader (software renderer). Even transform
    //    animations jank there, so everything goes off.
    try {
      const canvas = document.createElement("canvas")
      const gl = (
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl")
      ) as WebGLRenderingContext | null

      if (!gl) {
        setTier("off")
        return
      }

      const ext = gl.getExtension("WEBGL_debug_renderer_info")
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
        // SwiftShader (Chrome SW), llvmpipe / softpipe (Mesa SW), Microsoft Basic Render Driver
        if (/swiftshader|llvmpipe|softpipe|virgl|microsoft basic render/i.test(renderer)) {
          setTier("off")
          return
        }
      }
    } catch {
      // ignore detection errors — assume GPU is fine
    }

    // 3. Mobile devices (touch + small screen) — GPU es real pero la CPU y el
    //    ancho de banda de memoria son más limitados que en desktop. Las
    //    animaciones transform/opacity corren en el compositor y son baratas;
    //    lo que causa jank son los blur filters, SVG filters y spring physics.
    if (window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches) {
      setTier("lite")
      return
    }

    setTier("full")
  }, [])

  return tier
}

/** Legacy boolean API: `true` when any effect reduction applies (tier !== "full"). */
export function usePerformanceMode(): boolean {
  return usePerformanceTier() !== "full"
}

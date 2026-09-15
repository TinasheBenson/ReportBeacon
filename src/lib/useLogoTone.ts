/**
 * Detect whether an uploaded logo is mostly light or mostly dark, so the UI can
 * sit it on a contrasting plate. A white/light logo needs a dark plate; a dark
 * logo needs a light one. Without this, a light logo disappears on a white plate
 * (and a dark logo on a dark one). Samples the non-transparent pixels' average
 * luminance on a small offscreen canvas.
 */
import { useEffect, useState } from 'react'

export type LogoTone = 'light' | 'dark' | null

export function useLogoTone(logo: string | null): LogoTone {
  const [tone, setTone] = useState<LogoTone>(null)
  useEffect(() => {
    if (!logo) { setTone(null); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      try {
        const w = Math.max(1, Math.min(72, img.naturalWidth || 72))
        const h = Math.max(1, Math.min(72, img.naturalHeight || 72))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) { setTone('dark'); return }
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        let lum = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 24) continue // skip near-transparent pixels
          lum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
          count++
        }
        const avg = count ? lum / count : 255
        setTone(avg > 140 ? 'light' : 'dark')
      } catch {
        setTone('dark') // canvas blocked (tainted): assume a dark logo, white plate
      }
    }
    img.onerror = () => { if (!cancelled) setTone('dark') }
    img.src = logo
    return () => { cancelled = true }
  }, [logo])
  return tone
}

/** The plate colour behind a logo of this tone. Light logo → dark plate; dark
 *  (or unknown) logo → white plate. */
export function logoPlate(tone: LogoTone): string {
  return tone === 'light' ? '#15161c' : '#ffffff'
}

/**
 * Auto-crop the transparent margin from an uploaded logo.
 *
 * Most logo files carry a large transparent border baked into the image. When
 * the UI sizes the image to a fixed height, that whole padded canvas is fitted
 * into the box, so the visible mark shrinks to a fraction of the space. CSS
 * can't crop padding that lives inside the file — so we do it on a canvas:
 * find the bounding box of the non-transparent pixels and re-export just that.
 * A logo with an opaque (non-transparent) background can't be alpha-trimmed, so
 * it's returned unchanged.
 */
import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

export function trimLogo(src: string): Promise<string> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve) => {
    const done = (out: string) => { cache.set(src, out); resolve(out) }
    const img = new Image()
    img.onload = () => {
      try {
        const nw = img.naturalWidth || img.width
        const nh = img.naturalHeight || img.height
        if (!nw || !nh) return done(src)
        // Draw at a decent resolution so a small source stays crisp after crop.
        const scale = Math.min(4, Math.max(1, 320 / Math.max(nw, nh)))
        const cw = Math.round(nw * scale), ch = Math.round(nh * scale)
        const c = document.createElement('canvas')
        c.width = cw; c.height = ch
        const ctx = c.getContext('2d')
        if (!ctx) return done(src)
        ctx.drawImage(img, 0, 0, cw, ch)
        const { data } = ctx.getImageData(0, 0, cw, ch)
        let minX = cw, minY = ch, maxX = -1, maxY = -1
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            if (data[(y * cw + x) * 4 + 3] > 16) {
              if (x < minX) minX = x; if (x > maxX) maxX = x
              if (y < minY) minY = y; if (y > maxY) maxY = y
            }
          }
        }
        if (maxX < 0) return done(src) // fully transparent, or opaque bg: leave it
        const pad = Math.round(Math.max(cw, ch) * 0.03)
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
        maxX = Math.min(cw - 1, maxX + pad); maxY = Math.min(ch - 1, maxY + pad)
        const bw = maxX - minX + 1, bh = maxY - minY + 1
        if (bw >= cw - 2 && bh >= ch - 2) return done(src) // nothing to trim
        const out = document.createElement('canvas')
        out.width = bw; out.height = bh
        out.getContext('2d')!.drawImage(c, minX, minY, bw, bh, 0, 0, bw, bh)
        done(out.toDataURL('image/png'))
      } catch {
        done(src) // canvas blocked
      }
    }
    img.onerror = () => done(src)
    img.src = src
  })
}

/** The logo with its transparent margin cropped, so it fills its box. Returns
 *  the original until the crop resolves (one async pass, then cached). */
export function useTrimmedLogo(logo: string | null): string | null {
  const [src, setSrc] = useState<string | null>(() => (logo ? cache.get(logo) ?? logo : null))
  useEffect(() => {
    if (!logo) { setSrc(null); return }
    const hit = cache.get(logo)
    if (hit) { setSrc(hit); return }
    let cancelled = false
    setSrc(logo)
    trimLogo(logo).then((r) => { if (!cancelled) setSrc(r) })
    return () => { cancelled = true }
  }, [logo])
  return src
}

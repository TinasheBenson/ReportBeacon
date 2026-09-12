/** Platform brand marks for the Social face.
 *
 *  Each platform renders as its own recognisable, colourful tile — Facebook's
 *  blue "f", Instagram's gradient camera, TikTok's chromatic note, LinkedIn's
 *  blue "in" — rather than a flat lettered badge. These are original SVG
 *  renditions drawn on a 24-grid, sized by the `size` prop, so they scale
 *  crisply everywhere they appear (overview table, channel rows, post cards,
 *  reports, integrations). */
import { useId } from 'react'
import type { SocialPlatformId } from '@/lib/social'

const LABEL: Record<SocialPlatformId, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn',
}

export function PlatformLogo({ platform, size = 22, rounded = true, className = '' }: {
  platform: SocialPlatformId; size?: number; rounded?: boolean; className?: string
}) {
  const uid = useId().replace(/[:]/g, '')
  const rx = rounded ? 6 : 0
  const common = { width: size, height: size, viewBox: '0 0 24 24', role: 'img', 'aria-label': LABEL[platform], className } as const

  if (platform === 'facebook') {
    return (
      <svg {...common}>
        <rect width="24" height="24" rx={rx} fill="#1877f2" />
        <path d="M15.4 12.6l.46-2.95h-2.83V7.73c0-.81.4-1.6 1.67-1.6h1.29V3.62s-1.17-.2-2.29-.2c-2.34 0-3.86 1.41-3.86 3.97v2.26H7.24v2.95h2.59v7.14a10.3 10.3 0 0 0 3.2 0v-7.14h2.37z" fill="#fff" />
      </svg>
    )
  }
  if (platform === 'instagram') {
    const g = `ig${uid}`
    return (
      <svg {...common}>
        <defs>
          <radialGradient id={g} cx="28%" cy="108%" r="142%">
            <stop offset="0" stopColor="#ffd776" />
            <stop offset="0.26" stopColor="#fa9234" />
            <stop offset="0.5" stopColor="#ed4a5f" />
            <stop offset="0.67" stopColor="#d62976" />
            <stop offset="1" stopColor="#5b4fe9" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx={rx} fill={`url(#${g})`} />
        <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="4.1" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16.2" cy="7.9" r="1.15" fill="#fff" />
      </svg>
    )
  }
  if (platform === 'tiktok') {
    // Chromatic note: cyan + magenta offsets under a white glyph.
    const note = 'M16.55 3c.28 2.06 1.47 3.6 3.45 3.84v2.41c-1.23 0-2.38-.31-3.45-.92v5.72c0 3.34-2.74 5.94-6.04 5.43-2.46-.38-4.3-2.5-4.08-5.06.2-2.46 2.37-4.28 4.82-4.06v2.47c-.32-.1-.66-.16-1.02-.16-1.32 0-2.33 1.13-2.12 2.46.14 1.07 1.11 1.9 2.19 1.92 1.3.03 2.37-1.01 2.37-2.31V3h3.45z'
    return (
      <svg {...common}>
        <rect width="24" height="24" rx={rx} fill="#010101" />
        <path d={note} fill="#25f4ee" transform="translate(-0.7,0.4)" />
        <path d={note} fill="#fe2c55" transform="translate(0.7,-0.4)" />
        <path d={note} fill="#fff" />
      </svg>
    )
  }
  // linkedin
  return (
    <svg {...common}>
      <rect width="24" height="24" rx={rx} fill="#0a66c2" />
      <circle cx="7" cy="7.1" r="1.5" fill="#fff" />
      <rect x="5.7" y="9.9" width="2.6" height="8.2" rx="0.3" fill="#fff" />
      <path d="M10.4 9.9h2.5v1.14c.37-.63 1.2-1.34 2.64-1.34 2.02 0 3.26 1.27 3.26 3.74V18.1h-2.6v-4.2c0-1.11-.45-1.87-1.5-1.87-.82 0-1.25.55-1.46 1.08-.08.19-.09.46-.09.73v4.26h-2.6s.03-7.3 0-8.21z" fill="#fff" />
    </svg>
  )
}

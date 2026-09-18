/**
 * Says where the numbers on screen came from.
 *
 * Seeded and demo data look exactly like real data once it is rendered, which
 * is precisely why it has to be labelled: a stand-in figure that reads as a
 * real one is how a client report goes out wrong.
 */
import { CircleOff, Radio, FlaskConical } from 'lucide-react'
import type { SocialSource } from '@/context/social'

const MAP: Record<SocialSource, { label: string; title: string; icon: typeof Radio; color: string; bg: string }> = {
  live: {
    label: 'Live',
    title: 'Pulled from the Meta Graph API for your connected accounts.',
    icon: Radio, color: 'var(--st-good)', bg: 'color-mix(in srgb, var(--st-good) 12%, transparent)',
  },
  empty: {
    label: 'No data',
    title: 'Nothing has been pulled yet. Connect an account, or if one is connected, open the setup check to see why its last sync returned nothing.',
    icon: CircleOff, color: 'var(--st-warn)', bg: 'color-mix(in srgb, var(--st-warn) 14%, transparent)',
  },
  demo: {
    label: 'Showcase',
    title: 'Sample roster shown to signed-out visitors. Sign in to see your own connected accounts.',
    icon: FlaskConical, color: 'var(--muted)', bg: 'var(--surface-2)',
  },
}

export function SourceBadge({ source, className = '' }: { source: SocialSource; className?: string }) {
  const s = MAP[source]
  const Icon = s.icon
  return (
    <span
      title={s.title}
      className={`inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-[11px] font-semibold ${className}`}
      style={{ color: s.color, background: s.bg }}
    >
      <Icon size={12} />
      {s.label}
    </span>
  )
}

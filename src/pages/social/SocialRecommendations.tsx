/** Social recommendations across the roster — what to post, when, and where. */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { X, CalendarClock, Clapperboard, Clock, MessageCircle, TrendingUp } from 'lucide-react'
import { socialRecsForMany, type SocialRec } from '@/lib/social'
import { useSocial } from '@/context/social'
import { Card, Button } from '@/components/ui/kit'

const ICON: Record<SocialRec['category'], typeof Clock> = {
  cadence: CalendarClock, format: Clapperboard, timing: Clock, engagement: MessageCircle, growth: TrendingUp,
}
const CAT_LABEL: Record<SocialRec['category'], string> = { cadence: 'Cadence', format: 'Format', timing: 'Timing', engagement: 'Engagement', growth: 'Growth' }

export default function SocialRecommendations() {
  const { accounts } = useSocial()
  const all = socialRecsForMany(accounts)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = all.filter((r) => !dismissed.has(r.id))

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] text-[var(--ink-2)] max-w-[620px]">Prioritised across every account, weighted toward what moves reach and engagement. Built from each account's own post history.</p>
      <div className="text-[12px] text-[var(--muted)]">{visible.length} suggestion{visible.length === 1 ? '' : 's'} · built-in engine</div>

      {visible.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[var(--muted)]">Nothing outstanding. Every account is on a healthy cadence.</Card>
      ) : (
        <motion.div layout className="grid md:grid-cols-2 gap-3.5">
          <AnimatePresence mode="popLayout">
            {visible.map((r) => {
              const Icon = ICON[r.category]
              return (
                <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
                  <Card className="p-4 h-full flex flex-col gap-2.5 lift">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-[8px] grid place-items-center flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}><Icon size={15} /></span>
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{CAT_LABEL[r.category]}</span>
                      <span className="ml-auto text-[11px] font-semibold capitalize" style={{ color: r.priority === 'high' ? 'var(--st-serious)' : r.priority === 'medium' ? 'var(--st-warn)' : 'var(--muted)' }}>{r.priority}</span>
                      <button onClick={() => setDismissed((d) => new Set(d).add(r.id))} aria-label="Dismiss" className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors -mr-1"><X size={15} /></button>
                    </div>
                    <div><div className="text-[13.5px] font-semibold leading-snug">{r.title}</div><div className="text-[11px] text-[var(--muted)] mt-0.5">{r.accountName}</div></div>
                    <p className="text-[12.5px] text-[var(--ink-2)] leading-relaxed">{r.rationale}</p>
                    <div className="text-[12px] font-medium mt-auto pt-1" style={{ color: 'var(--good)' }}>{r.impact}</div>
                    <div><Button className="press" onClick={() => toast.success('Added to plan', { description: r.title })}>{r.action}</Button></div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

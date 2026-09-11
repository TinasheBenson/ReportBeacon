/**
 * Recommendations surface. Built-in rule engine by default; if an OpenRouter
 * key is saved, "Generate with <model>" swaps in live model output, falling
 * back to the rule engine on any error.
 */
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Sparkles, X, ArrowRight, Lightbulb, Wallet, Wrench, Star, Search, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { useApp } from '@/context/app'
import type { Account } from '@/lib/data'
import { recommendationsForMany, CATEGORY_LABEL, type Recommendation, type RecCategory } from '@/lib/recommend'
import { generateLive, MODELS } from '@/lib/llm'
import { Card, Button, PriorityDot } from '@/components/ui/kit'

const CAT_ICON: Record<RecCategory, typeof Wallet> = {
  budget: Wallet, optimize: Wrench, reputation: Star, seo: Search, ops: Wrench,
}

export function RecommendationsPanel({ accounts, showAccount = true }: { accounts: Account[]; showAccount?: boolean }) {
  const { ai } = useApp()
  const ruleRecs = useMemo(() => recommendationsForMany(accounts), [accounts])
  const [recs, setRecs] = useState<Recommendation[]>(ruleRecs)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  // Reset when the scope changes.
  const scopeKey = accounts.map((a) => a.id).join(',')
  const scopeRef = useRef(scopeKey)
  scopeRef.current = scopeKey
  const [lastScope, setLastScope] = useState(scopeKey)
  if (scopeKey !== lastScope) {
    setLastScope(scopeKey)
    setRecs(ruleRecs)
    setDismissed(new Set())
  }

  const model = MODELS.find((m) => m.id === ai.model)
  const visible = recs.filter((r) => !dismissed.has(r.id))

  async function generate() {
    if (!ai.key) return
    const startedScope = scopeKey
    setGenerating(true)
    try {
      const results = await Promise.allSettled(accounts.map((a) => generateLive(a, ai)))
      // Scope changed while the request was in flight — drop these stale results.
      if (scopeRef.current !== startedScope) return
      const next: Recommendation[] = []
      let ok = 0, failed = 0
      results.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value.length) { next.push(...res.value); ok++ }
        else { next.push(...recommendationsForMany([accounts[i]])); failed++ }
      })
      setRecs(next)
      setDismissed(new Set())
      if (ok && !failed) toast.success(`Generated with ${model?.label ?? 'model'}`)
      else if (ok && failed) toast.warning(`${ok} generated, ${failed} used the built-in engine`)
      else toast.error('Live generation failed, showing built-in recommendations')
    } catch (e) {
      toast.error('Live generation failed', { description: e instanceof Error ? e.message : undefined })
      setRecs(ruleRecs)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12px] text-[var(--muted)]">
          {visible.length} suggestion{visible.length === 1 ? '' : 's'} ·{' '}
          {visible.some((r) => r.source === 'model') ? `by ${model?.label}` : 'built-in engine'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {ai.key ? (
            <Button variant="primary" onClick={generate} disabled={generating}>
              {generating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {generating ? 'Generating…' : `Generate with ${model?.label ?? 'model'}`}
            </Button>
          ) : (
            <Link to="/app/integrations" className="text-[12.5px] font-semibold text-[var(--accent)] inline-flex items-center gap-1">
              <Sparkles size={14} /> Connect a model for AI suggestions <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[var(--muted)]">
          <Lightbulb size={20} className="mx-auto mb-2 opacity-60" />
          No open recommendations. Everything here is on track.
        </Card>
      ) : (
        <motion.div layout className="grid md:grid-cols-2 gap-3.5">
          <AnimatePresence mode="popLayout">
            {visible.map((r) => (
              <RecommendationCard
                key={r.id}
                rec={r}
                showAccount={showAccount}
                onDismiss={() => setDismissed((d) => new Set(d).add(r.id))}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

export function RecommendationCard({ rec, showAccount = true, onDismiss }: { rec: Recommendation; showAccount?: boolean; onDismiss?: () => void }) {
  const Icon = CAT_ICON[rec.category]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="p-4 h-full flex flex-col gap-2.5 lift">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-[8px] grid place-items-center flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
            <Icon size={15} />
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{CATEGORY_LABEL[rec.category]}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: rec.priority === 'high' ? 'var(--st-serious)' : rec.priority === 'medium' ? 'var(--st-warn)' : 'var(--muted)' }}>
            <PriorityDot priority={rec.priority} />{rec.priority}
          </span>
          {onDismiss && (
            <button onClick={onDismiss} aria-label="Dismiss" className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors -mr-1"><X size={15} /></button>
          )}
        </div>
        <div>
          <div className="text-[13.5px] font-semibold leading-snug">{rec.title}</div>
          {showAccount && <div className="text-[11px] text-[var(--muted)] mt-0.5">{rec.accountName}</div>}
        </div>
        <p className="text-[12.5px] text-[var(--ink-2)] leading-relaxed">{rec.rationale}</p>
        <div className="text-[12px] font-medium mt-auto pt-1" style={{ color: 'var(--good)' }}>{rec.impact}</div>
        <div className="flex items-center gap-2 pt-1">
          <Button className="press" onClick={() => toast.success('Added to plan', { description: rec.title })}>{rec.action}</Button>
          {rec.source === 'model' && <span className="text-[10.5px] text-[var(--muted)] inline-flex items-center gap-1"><Sparkles size={11} /> model</span>}
        </div>
      </Card>
    </motion.div>
  )
}

/** Alert rules (admin): the engine behind the Alerts page. Create, tune, pause
 *  or delete the rules that decide when an account raises an alert. */
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, X } from 'lucide-react'
import { useWorkspace } from '@/context/workspace'
import {
  RULE_TYPES, RULE_TYPE_LABEL, TIERS, TIER_LABEL, METRIC_LABEL,
  THRESHOLD_METRICS, WOW_METRICS, describeRule, newRuleId,
  type RuleType, type Tier, type MetricKey,
} from '@/lib/alerts'
import { Card, Button, Toggle, Segmented } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

const input = 'w-full bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]'

interface Form {
  name: string; ruleType: RuleType; scope: string; severity: Tier
  metric: MetricKey; operator: 'gt' | 'lt'; threshold: string
  direction: 'up' | 'down'; changePct: string; warn: string; critical: string
}
const BLANK: Form = {
  name: '', ruleType: 'absolute_threshold', scope: 'all', severity: 'medium',
  metric: 'cpl', operator: 'gt', threshold: '60',
  direction: 'up', changePct: '10', warn: '100', critical: '112',
}

export default function AlertRules() {
  const { isAdmin, alertRules, clients, addAlertRule, updateAlertRule, deleteAlertRule } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [f, setForm] = useState<Form>(BLANK)
  const set = (p: Partial<Form>) => setForm((prev) => ({ ...prev, ...p }))

  if (!isAdmin) {
    return <Card className="p-10 text-center text-[13px] text-[var(--muted)] max-w-[520px]">Alert rules are managed by the agency owner.</Card>
  }

  function create() {
    const config =
      f.ruleType === 'absolute_threshold' ? { metric: f.metric, operator: f.operator, threshold: Number(f.threshold) || 0 }
      : f.ruleType === 'wow_change' ? { metric: f.metric, direction: f.direction, changePct: Number(f.changePct) || 0 }
      : f.ruleType === 'budget_pacing' ? { warn: Number(f.warn) || 100, critical: Number(f.critical) || 112 }
      : {}
    addAlertRule({
      id: newRuleId(),
      name: f.name.trim() || RULE_TYPE_LABEL[f.ruleType],
      scope: f.scope, ruleType: f.ruleType, config, severity: f.severity,
      active: true, createdAt: new Date().toISOString(),
    })
    toast.success('Rule added', { description: f.name.trim() || RULE_TYPE_LABEL[f.ruleType] })
    setForm(BLANK); setOpen(false)
  }

  return (
    <Reveal className="flex flex-col gap-4 max-w-[820px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--ink-2)] max-w-[560px]">Rules decide when an account raises an alert. Pause one to silence it without losing it; alerts it already raised keep their status.</p>
        {!open && <Button variant="primary" onClick={() => setOpen(true)}><Plus size={15} /> New rule</Button>}
      </div>

      {open && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-bold">New alert rule</div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={16} /></button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Name</label>
              <input className={`${input} mt-2`} value={f.name} placeholder={RULE_TYPE_LABEL[f.ruleType]} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <label className="eyebrow">Applies to</label>
              <select className={`${input} mt-2`} value={f.scope} onChange={(e) => set({ scope: e.target.value })}>
                <option value="all">Every client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="eyebrow">Rule type</label>
            <div className="mt-2">
              <Segmented value={f.ruleType} onChange={(v) => set({ ruleType: v })} options={RULE_TYPES.map((t) => ({ value: t, label: RULE_TYPE_LABEL[t] }))} className="flex-wrap" />
            </div>
          </div>

          {/* type-specific config */}
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            {f.ruleType === 'absolute_threshold' && <>
              <Field label="Metric"><select className={input} value={f.metric} onChange={(e) => set({ metric: e.target.value as MetricKey })}>{THRESHOLD_METRICS.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</select></Field>
              <Field label="Condition"><select className={input} value={f.operator} onChange={(e) => set({ operator: e.target.value as 'gt' | 'lt' })}><option value="gt">Goes over</option><option value="lt">Drops under</option></select></Field>
              <Field label="Threshold"><input className={input} type="number" value={f.threshold} onChange={(e) => set({ threshold: e.target.value })} /></Field>
            </>}
            {f.ruleType === 'wow_change' && <>
              <Field label="Metric"><select className={input} value={f.metric} onChange={(e) => set({ metric: e.target.value as MetricKey })}>{WOW_METRICS.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</select></Field>
              <Field label="Direction"><select className={input} value={f.direction} onChange={(e) => set({ direction: e.target.value as 'up' | 'down' })}><option value="up">Moves up</option><option value="down">Moves down</option></select></Field>
              <Field label="More than (%)"><input className={input} type="number" value={f.changePct} onChange={(e) => set({ changePct: e.target.value })} /></Field>
            </>}
            {f.ruleType === 'budget_pacing' && <>
              <Field label="Warn at (%)"><input className={input} type="number" value={f.warn} onChange={(e) => set({ warn: e.target.value })} /></Field>
              <Field label="Escalate at (%)"><input className={input} type="number" value={f.critical} onChange={(e) => set({ critical: e.target.value })} /></Field>
            </>}
            {f.ruleType === 'missing_data' && (
              <div className="sm:col-span-3 text-[12.5px] text-[var(--muted)]">Fires when any connected platform stops syncing. No threshold to set.</div>
            )}
            <Field label="Severity"><select className={input} value={f.severity} onChange={(e) => set({ severity: e.target.value as Tier })}>{TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select></Field>
          </div>

          <div className="mt-5 flex gap-2.5">
            <Button variant="primary" onClick={create}><Plus size={15} /> Add rule</Button>
            <Button onClick={() => { setOpen(false); setForm(BLANK) }}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-[var(--line)]">
        {alertRules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold">{r.name}</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)] px-1.5 py-0.5 rounded border border-[var(--line-2)]">{RULE_TYPE_LABEL[r.ruleType]}</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: r.severity === 'critical' || r.severity === 'high' ? 'var(--st-serious)' : r.severity === 'medium' ? 'var(--st-warn)' : 'var(--muted)' }}>{TIER_LABEL[r.severity]}</span>
              </div>
              <div className="text-[11.5px] text-[var(--ink-2)] mt-0.5">{describeRule(r)}</div>
            </div>
            <Toggle on={r.active} onChange={(v) => { updateAlertRule(r.id, { active: v }); toast.success(v ? 'Rule activated' : 'Rule paused', { description: r.name }) }} label={`${r.name} active`} />
            <button onClick={() => { deleteAlertRule(r.id); toast.success('Rule deleted', { description: r.name }) }} aria-label="Delete rule"
              className="w-8 h-8 grid place-items-center rounded-[7px] text-[var(--muted)] hover:text-[var(--st-critical)] hover:bg-[var(--surface-2)] transition-colors"><Trash2 size={15} /></button>
          </div>
        ))}
        {alertRules.length === 0 && <div className="p-10 text-center text-[13px] text-[var(--muted)]">No rules yet. Add one to start raising alerts.</div>}
      </Card>
    </Reveal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="eyebrow">{label}</label><div className="mt-2">{children}</div></div>
}

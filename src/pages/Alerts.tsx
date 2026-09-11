/** Alerts: rule-driven exceptions across the roster, with a lifecycle.
 *  Alerts are produced by the alert-rules engine (Alert rules, admin) and can
 *  be acknowledged and resolved. Most severe first. */
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ArrowRight, Check, CheckCheck, RotateCcw } from 'lucide-react'
import { useWorkspace, type LiveAlert } from '@/context/workspace'
import { type Severity } from '@/lib/data'
import { Card, SeverityDot, Chip, Button, Segmented } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

const SEV_LABEL: Record<Severity, string> = { serious: 'At risk', warning: 'Watch', info: 'Info' }
const chipTone = (s: Severity): 'serious' | 'warn' | 'neutral' => (s === 'serious' ? 'serious' : s === 'warning' ? 'warn' : 'neutral')

export default function Alerts() {
  const { me, accountsForSeat, alerts, setAlertStatus, canWrite } = useWorkspace()
  const scope = me ? accountsForSeat(me) : []
  const all = alerts(scope)
  const [view, setView] = useState<'open' | 'resolved'>('open')

  const open = all.filter((a) => a.status !== 'resolved')
  const resolved = all.filter((a) => a.status === 'resolved')
  const groups: Severity[] = ['serious', 'warning', 'info']

  function act(al: LiveAlert, status: 'acknowledged' | 'resolved' | 'open') {
    setAlertStatus(al.id, status)
    const msg = status === 'resolved' ? 'Alert resolved' : status === 'acknowledged' ? 'Alert acknowledged' : 'Alert reopened'
    toast.success(msg, { description: `${al.title} · ${al.accountName}` })
  }

  return (
    <Reveal className="flex flex-col gap-5 max-w-[880px]">
      <div className="flex items-center gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: 'open', label: `Open${open.length ? ` · ${open.length}` : ''}` }, { value: 'resolved', label: `Resolved${resolved.length ? ` · ${resolved.length}` : ''}` }]}
        />
        <span className="text-[12px] text-[var(--muted)]">Rules are managed on <Link to="/app/alert-rules" className="text-[var(--accent)] font-medium">Alert rules</Link>.</span>
      </div>

      {view === 'open' ? (
        <>
          {groups.map((sev) => {
            const items = open.filter((a) => a.severity === sev)
            if (items.length === 0) return null
            return (
              <section key={sev}>
                <div className="flex items-center gap-2 mb-3">
                  <SeverityDot severity={sev} />
                  <h2 className="text-[14px] font-bold">{SEV_LABEL[sev]}</h2>
                  <span className="text-[12px] text-[var(--muted)]">{items.length}</span>
                </div>
                <Card className="divide-y divide-[var(--line)]">
                  {items.map((al) => <AlertRow key={al.id} al={al} onAct={act} canWrite={canWrite} />)}
                </Card>
              </section>
            )
          })}
          {open.length === 0 && <Card className="p-10 text-center text-[13px] text-[var(--muted)]">No open alerts. Every account is on track.</Card>}
        </>
      ) : (
        <Card className="divide-y divide-[var(--line)]">
          {resolved.map((al) => <AlertRow key={al.id} al={al} onAct={act} canWrite={canWrite} />)}
          {resolved.length === 0 && <div className="p-10 text-center text-[13px] text-[var(--muted)]">Nothing resolved yet.</div>}
        </Card>
      )}
    </Reveal>
  )
}

function AlertRow({ al, onAct, canWrite }: { al: LiveAlert; onAct: (a: LiveAlert, s: 'acknowledged' | 'resolved' | 'open') => void; canWrite: boolean }) {
  const resolved = al.status === 'resolved'
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${resolved ? 'opacity-70' : ''}`}>
      <div className="min-w-0 flex-1">
        <Link to={`/app/accounts/${al.accountId}`} className="text-[13px] font-semibold hover:text-[var(--accent)] transition-colors">{al.title}</Link>
        <div className="text-[11.5px] text-[var(--ink-2)]">{al.detail}</div>
      </div>
      <span className="text-[11.5px] font-medium text-[var(--ink-2)] whitespace-nowrap hidden md:block">{al.accountName}</span>
      {al.status === 'acknowledged' && <Chip tone="neutral">Acknowledged</Chip>}
      <Chip tone={chipTone(al.severity)}>{al.tag}</Chip>
      <div className="flex items-center gap-1.5 flex-none">
        {canWrite && al.status === 'open' && (
          <button onClick={() => onAct(al, 'acknowledged')} title="Acknowledge" aria-label="Acknowledge"
            className="w-7 h-7 grid place-items-center rounded-[7px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"><Check size={15} /></button>
        )}
        {canWrite && (!resolved ? (
          <Button className="py-1 px-2 text-[11px]" onClick={() => onAct(al, 'resolved')}><CheckCheck size={13} /> Resolve</Button>
        ) : (
          <Button className="py-1 px-2 text-[11px]" onClick={() => onAct(al, 'open')}><RotateCcw size={13} /> Reopen</Button>
        ))}
        <Link to={`/app/accounts/${al.accountId}`} className="w-7 h-7 grid place-items-center text-[var(--muted)] hover:text-[var(--ink)]" aria-label="Open account"><ArrowRight size={15} /></Link>
      </div>
    </div>
  )
}

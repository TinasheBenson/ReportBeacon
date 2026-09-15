/**
 * Reports: assemble a client-branded, print-ready report for one account.
 * "Export PDF" runs the browser's print-to-PDF against a clean sheet (app
 * chrome hidden by the print stylesheet). Formatted per client, with the
 * real reporting-period dates for the selected range.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Printer, Check, CalendarClock } from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace, nextSend, type Freq } from '@/context/workspace'
import { metricsFor, pacing, RANGES, type Account, type RangeId } from '@/lib/data'
import { money, money2, num, compact } from '@/lib/format'
import { Card, Button, Toggle, Segmented } from '@/components/ui/kit'
import { useLogoTone } from '@/lib/useLogoTone'

type SectionKey = 'headline' | 'channels' | 'google' | 'search' | 'summary'
const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'headline', label: 'Headline results', hint: 'Leads, cost per lead, spend' },
  { key: 'channels', label: 'Channel performance', hint: 'Spend and leads per channel' },
  { key: 'google', label: 'Google presence', hint: 'Reviews, rating, map actions' },
  { key: 'search', label: 'Search visibility', hint: 'Keyword movement' },
  { key: 'summary', label: 'Summary & next steps', hint: 'Written recap' },
]

const FREQ_OPTS: { value: Freq; label: string }[] = [
  { value: 'off', label: 'Off' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' },
]

// --- date helpers -----------------------------------------------------------
function fmt(d: Date, withYear = true): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) })
}
function reportingPeriod(range: RangeId): { period: string; compared: string; preparedOn: string } {
  const to = new Date()
  const from = new Date(to)
  let compared = ''
  if (range === '7d') { from.setDate(to.getDate() - 6); compared = 'previous 7 days' }
  else if (range === '30d') { from.setDate(to.getDate() - 29); compared = 'previous 30 days' }
  else { from.setDate(1); compared = 'same days last month' }
  const sameYear = from.getFullYear() === to.getFullYear()
  return { period: `${fmt(from, !sameYear)} – ${fmt(to)}`, compared, preparedOn: fmt(to) }
}

export default function Reports() {
  const [params] = useSearchParams()
  const { range, setRange } = useApp()
  const { me, accountsForSeat, getClient, brand, brandMonogram, schedules, setSchedule, canWrite } = useWorkspace()
  const logoPlated = useLogoTone(brand.logo) === 'light'
  const scope = me ? accountsForSeat(me) : []
  const paramAcct = params.get('account') || ''
  const initial = scope.some((a) => a.id === paramAcct) ? paramAcct : (scope[0]?.id ?? '')
  const [accountId, setAccountId] = useState(initial)
  const [title, setTitle] = useState('Performance report')
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ headline: true, channels: true, google: true, search: true, summary: true })

  const account = getClient(accountId) ?? scope[0]
  const m = useMemo(() => (account ? metricsFor(account, range) : null), [account, range])
  const dates = useMemo(() => reportingPeriod(range), [range])

  if (!account || !m) {
    return <Card className="p-10 text-center text-[13px] text-[var(--muted)] max-w-[520px]">No clients to report on yet. Import a client from Integrations first.</Card>
  }
  const p = pacing(account)
  const active = SECTIONS.filter((s) => sections[s.key])
  const rangeLabel = RANGES.find((r) => r.id === range)!.label
  const schedule = schedules[account.id] ?? { freq: 'off' as Freq, recipient: '' }

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 no-print">
        <Card className="p-4">
          <div className="text-[13px] font-bold mb-3">Report setup</div>

          <label className="eyebrow">Client</label>
          <div className="mt-2 mb-4 flex flex-col gap-1.5">
            {scope.map((a) => (
              <button key={a.id} onClick={() => setAccountId(a.id)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left transition-colors border ${a.id === accountId ? 'bg-[var(--accent-weak)] border-[color-mix(in_srgb,var(--accent)_22%,transparent)]' : 'border-transparent hover:bg-[var(--surface-2)]'}`}>
                <span className="w-6 h-6 rounded-[6px] grid place-items-center mono text-[10px] font-bold text-white flex-none" style={{ background: a.color }}>{a.mark}</span>
                <span className={`text-[13px] font-medium ${a.id === accountId ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{a.name}</span>
              </button>
            ))}
          </div>

          <label className="eyebrow">Report title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-2 mb-4 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />

          <label className="eyebrow">Date range</label>
          <div className="mt-2 mb-1.5">
            <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} className="w-full" />
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mb-4">{dates.period}</div>

          <label className="eyebrow">Sections</label>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {SECTIONS.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">{s.label}</div>
                  <div className="text-[11px] text-[var(--muted)]">{s.hint}</div>
                </div>
                <Toggle on={sections[s.key]} onChange={(v) => setSections((prev) => ({ ...prev, [s.key]: v }))} label={s.label} />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2.5">
          <Button variant="primary" className="flex-1 justify-center" disabled={active.length === 0} onClick={() => window.print()}><Printer size={15} /> Export PDF</Button>
          <Button className="flex-1 justify-center" onClick={() => toast.success('Marked reviewed', { description: `${account.name} · ${rangeLabel}` })}><Check size={15} /> Mark reviewed</Button>
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={15} className="text-[var(--accent)]" />
            <div className="text-[13px] font-bold">Automatic delivery</div>
          </div>
          <p className="text-[11.5px] text-[var(--muted)] mb-3">Send this report to {account.name} on a schedule. No more building it by hand.</p>

          {canWrite ? (<>
            <label className="eyebrow">Frequency</label>
            <div className="mt-2 mb-3.5">
              <Segmented
                value={schedule.freq}
                onChange={(v) => { setSchedule(account.id, { ...schedule, freq: v }); toast.success(v === 'off' ? 'Automatic delivery turned off' : `Scheduled ${v}`, { description: v === 'off' ? account.name : `${account.name} · next ${fmt(nextSend(v))}` }) }}
                options={FREQ_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                className="w-full"
              />
            </div>

            <label className="eyebrow">Send to</label>
            <input
              type="email"
              value={schedule.recipient}
              onChange={(e) => setSchedule(account.id, { ...schedule, recipient: e.target.value })}
              placeholder="client@email.com"
              className="w-full mt-2 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />

            {schedule.freq !== 'off' && (
              <div className="mt-3 flex items-center gap-2 text-[11.5px] text-[var(--ink-2)] bg-[var(--accent-weak)] rounded-[8px] px-3 py-2">
                <CalendarClock size={13} className="text-[var(--accent)] flex-none" />
                Next send <b className="text-[var(--ink)]">{fmt(nextSend(schedule.freq))}</b>{schedule.recipient ? <> to {schedule.recipient}</> : null}
              </div>
            )}
          </>) : (
            <div className="text-[12px] text-[var(--ink-2)]">
              {schedule.freq === 'off'
                ? <>No automatic delivery set. <span className="text-[var(--muted)]">Read-only — an account manager sets this.</span></>
                : <>Sends <b>{schedule.freq}</b>{schedule.recipient ? <> to {schedule.recipient}</> : null}, next {fmt(nextSend(schedule.freq))}. <span className="text-[var(--muted)]">Read-only.</span></>}
            </div>
          )}
        </Card>
      </div>

      {/* Sheet */}
      <Card className="print-sheet overflow-hidden" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}>
        {/* Branded header */}
        <div className="h-1.5" style={{ background: account.color }} />
        <div className="p-7 md:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)] mb-3">
                {brand.logo
                  ? <img src={brand.logo} alt={brand.agencyName} style={logoPlated ? { background: '#15161c' } : undefined} className={`h-[30px] max-w-[180px] object-contain object-left ${logoPlated ? 'rounded-[8px] px-2 py-1' : ''}`} />
                  : <><span className="w-[22px] h-[22px] rounded-[6px] grid place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{brandMonogram}</span><span className="font-semibold">{brand.agencyName}</span></>}
              </div>
              <div className="eyebrow" style={{ color: account.color }}>{account.trade} · {account.location}</div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight mt-1">{title}</h1>
              <div className="text-[15px] font-semibold text-[var(--ink-2)] mt-1">{account.name}</div>
            </div>
            <div className="w-16 h-16 rounded-[14px] grid place-items-center mono font-bold text-[19px] text-white flex-none" style={{ background: account.color }}>{account.mark}</div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[var(--line)]">
            <Meta label="Prepared for" value={account.name} />
            <Meta label="Reporting period" value={dates.period} />
            <Meta label="Compared to" value={dates.compared} />
            <Meta label="Prepared by" value={brand.agencyName} />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-7 mt-8">
            {sections.headline && (
              <Section n={sectionNo(active, 'headline')} title="Headline results" color={account.color}>
                <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed mb-4">
                  {account.name} generated <b className="text-[var(--ink)]">{num(m.leads)}</b> leads at <b className="text-[var(--ink)]">{money2(m.cpl)}</b> each over this period, on <b className="text-[var(--ink)]">{money(m.spend)}</b> of ad spend.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Mini label="Leads" value={num(m.leads)} delta={m.leadsDelta} note={dates.compared} />
                  <Mini label="Cost / lead" value={money2(m.cpl)} delta={m.cplDelta} lowerIsBetter note={dates.compared} />
                  <Mini label="Ad spend" value={money(m.spend)} delta={m.spendDelta} lowerIsBetter note={dates.compared} />
                </div>
              </Section>
            )}

            {sections.channels && (
              <Section n={sectionNo(active, 'channels')} title="Channel performance" color={account.color}>
                <ChannelTable account={account} />
              </Section>
            )}

            {sections.google && (
              <Section n={sectionNo(active, 'google')} title="Google Business Profile" color={account.color}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Mini label="Rating" value={account.gbp.rating.toFixed(1) + ' ★'} />
                  <Mini label="Reviews" value={num(account.gbp.reviews)} note={`+${account.gbp.reviewDelta} this period`} />
                  <Mini label="Profile views" value={compact(account.gbp.views)} />
                  <Mini label="Direction requests" value={num(account.gbp.directions)} />
                </div>
              </Section>
            )}

            {sections.search && (
              <Section n={sectionNo(active, 'search')} title="Search visibility" color={account.color}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Mini label="Visibility score" value={account.semrush.visibility.toFixed(1) + '%'} delta={account.semrush.visibilityDelta} note={dates.compared} />
                  <Mini label="Keywords tracked" value={num(account.semrush.keywords)} />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">Biggest climbers</div>
                <div className="flex flex-col gap-1.5">
                  {account.semrush.gaining.slice(0, 3).map((mv) => (
                    <div key={mv.term} className="flex items-center justify-between text-[12.5px] bg-[var(--surface-2)] border border-[var(--line)] rounded-[7px] px-3 py-2">
                      <span>{mv.term}</span>
                      <span className="mono font-semibold" style={{ color: 'var(--good)' }}>#{mv.from} → #{mv.to}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {sections.summary && (
              <Section n={sectionNo(active, 'summary')} title="Summary & next steps" color={account.color}>
                <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)] mb-3">
                  Spend is at <b className="text-[var(--ink)]">{p.pct}%</b> of the {money(account.budget)} monthly budget. Cost per lead {m.cplDelta <= 0 ? 'improved' : 'rose'} {Math.abs(m.cplDelta).toFixed(1)}% against the {dates.compared}.
                </p>
                <ul className="flex flex-col gap-2">
                  {[
                    `Shift budget toward the lowest cost-per-lead channels next period.`,
                    `Push the climbing keywords onto page one with a content refresh.`,
                    `Hold spend pacing near budget through month end.`,
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--ink-2)]">
                      <span className="mt-0.5 w-4 h-4 rounded-full grid place-items-center flex-none text-[10px] font-bold text-white" style={{ background: account.color }}>{i + 1}</span>{t}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {active.length === 0 && <p className="text-[13px] text-[var(--muted)] py-8 text-center">Turn on a section to build the report.</p>}
          </div>

          <div className="border-t border-[var(--line)] mt-8 pt-4 flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span>{account.name} · {dates.period}</span>
            <span>Prepared by {brand.agencyName} · Confidential</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

function sectionNo(active: { key: SectionKey }[], key: SectionKey): number {
  return active.findIndex((s) => s.key === key) + 1
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{label}</div>
      <div className="text-[13px] font-medium text-[var(--ink)] mt-0.5">{value}</div>
    </div>
  )
}

function Section({ n, title, children, color }: { n: number; title: string; children: React.ReactNode; color: string }) {
  return (
    <section className="break-inside-avoid">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="mono text-[12px] font-bold w-6 h-6 rounded-[7px] grid place-items-center flex-none" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{n}</span>
        <h2 className="text-[16px] font-bold tracking-[-0.01em]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Mini({ label, value, delta, lowerIsBetter, note }: { label: string; value: string; delta?: number; lowerIsBetter?: boolean; note?: string }) {
  const good = delta === undefined ? true : lowerIsBetter ? delta < 0 : delta > 0
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] p-3.5">
      <div className="text-[10.5px] text-[var(--muted)] uppercase tracking-wide">{label}</div>
      <div className="mono text-[20px] font-semibold mt-1 leading-none">{value}</div>
      {delta !== undefined && (
        <div className="mono text-[11px] font-semibold mt-1.5" style={{ color: good ? 'var(--good)' : 'var(--bad)' }}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% <span className="text-[var(--muted)] font-normal">vs {note}</span>
        </div>
      )}
    </div>
  )
}

function ChannelTable({ account }: { account: Account }) {
  const rows = [
    { name: 'Local Services Ads', spend: Math.round(account.lsa.leads * account.lsa.cpl), leads: account.lsa.leads, cpl: account.lsa.cpl },
    { name: 'Google Ads', spend: account.googleAds.spend, leads: account.googleAds.conversions, cpl: account.googleAds.costPerConv },
    { name: 'Meta Ads', spend: account.meta.spend, leads: account.meta.results, cpl: account.meta.costPerResult },
  ]
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0)
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] min-w-[440px]">
        <thead>
          <tr className="border-b border-[var(--line-2)]">
            <th className="text-left py-2 font-semibold text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Channel</th>
            <th className="text-right py-2 font-semibold text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Spend</th>
            <th className="text-right py-2 font-semibold text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Leads</th>
            <th className="text-right py-2 font-semibold text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Cost / lead</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-[var(--line)]">
              <td className="py-2.5 font-medium">{r.name}</td>
              <td className="py-2.5 text-right mono">{money(r.spend)}</td>
              <td className="py-2.5 text-right mono">{num(r.leads)}</td>
              <td className="py-2.5 text-right mono">{money2(r.cpl)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2.5">Blended</td>
            <td className="py-2.5 text-right mono">{money(totalSpend)}</td>
            <td className="py-2.5 text-right mono">{num(totalLeads)}</td>
            <td className="py-2.5 text-right mono">{totalLeads > 0 ? money2(totalSpend / totalLeads) : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Social performance report: a client-branded, print-ready social report with
 *  the same delivery scheduling as the performance side. */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Printer, Check, CalendarClock } from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace, nextSend, type Freq } from '@/context/workspace'
import { RANGES, type RangeId } from '@/lib/data'
import { ClientMark } from '@/components/ClientMark'
import { socialMetrics, socialRecsFor, socialPlatform, POST_TYPE_LABEL } from '@/lib/social'
import { useSocial } from '@/context/social'
import { compact } from '@/lib/format'
import { Card, Button, Toggle, Segmented } from '@/components/ui/kit'
import { PlatformLogo } from '@/components/social/PlatformLogo'
import { useTrimmedLogo } from '@/lib/logo'

type SectionKey = 'headline' | 'channels' | 'posts' | 'summary'
const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'headline', label: 'Headline results', hint: 'Followers, reach, engagement' },
  { key: 'channels', label: 'Channel performance', hint: 'Per-platform breakdown' },
  { key: 'posts', label: 'Top posts', hint: 'What performed best' },
  { key: 'summary', label: 'Summary & next steps', hint: 'Written recap' },
]
const FREQ_OPTS: { value: Freq; label: string }[] = [{ value: 'off', label: 'Off' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]

function fmt(d: Date): string { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function reportingPeriod(range: RangeId) {
  const to = new Date(); const from = new Date(to)
  if (range === '7d') from.setDate(to.getDate() - 6)
  else if (range === '30d') from.setDate(to.getDate() - 29)
  else from.setDate(1)
  return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${fmt(to)}`
}

export default function SocialReports() {
  const [params] = useSearchParams()
  const { range, setRange } = useApp()
  const { brand, brandMonogram, schedules, setSchedule, canWrite } = useWorkspace()
  const logoSrc = useTrimmedLogo(brand.logo) ?? brand.logo ?? undefined
  const paramAcct = params.get('account') || ''
  const { accounts: roster, accountById } = useSocial()
  const initial = roster.some((a) => a.id === paramAcct) ? paramAcct : roster[0].id
  const [accountId, setAccountId] = useState(initial)
  const [title, setTitle] = useState('Social performance report')
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ headline: true, channels: true, posts: true, summary: true })

  const account = accountById(accountId) ?? roster[0]
  const m = useMemo(() => socialMetrics(account, range), [account, range])
  const period = reportingPeriod(range)
  const rangeLabel = RANGES.find((r) => r.id === range)!.label
  const active = SECTIONS.filter((s) => sections[s.key])
  const schedule = schedules[account.id] ?? { freq: 'off' as Freq, recipient: '' }
  const topPosts = [...account.posts].sort((a, b) => b.reach * b.engagementRate - a.reach * a.engagementRate).slice(0, 3)
  const recs = socialRecsFor(account)

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 no-print">
        <Card className="p-4">
          <div className="text-[13px] font-bold mb-3">Report setup</div>
          <label className="eyebrow">Account</label>
          <div className="mt-2 mb-4 flex flex-col gap-1.5">
            {roster.map((a) => (
              <button key={a.id} onClick={() => setAccountId(a.id)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left transition-colors border ${a.id === accountId ? 'bg-[var(--accent-weak)] border-[color-mix(in_srgb,var(--accent)_22%,transparent)]' : 'border-transparent hover:bg-[var(--surface-2)]'}`}>
                <ClientMark account={a} className="w-6 h-6 rounded-[6px] text-[10px]" />
                <span className={`text-[13px] font-medium ${a.id === accountId ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{a.name}</span>
              </button>
            ))}
          </div>
          <label className="eyebrow">Report title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-2 mb-4 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
          <label className="eyebrow">Date range</label>
          <div className="mt-2 mb-1.5"><Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} className="w-full" /></div>
          <div className="text-[11.5px] text-[var(--muted)] mb-4">{period}</div>
          <label className="eyebrow">Sections</label>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {SECTIONS.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <div><div className="text-[13px] font-medium">{s.label}</div><div className="text-[11px] text-[var(--muted)]">{s.hint}</div></div>
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
          <div className="flex items-center gap-2 mb-1"><CalendarClock size={15} className="text-[var(--accent)]" /><div className="text-[13px] font-bold">Automatic delivery</div></div>
          <p className="text-[11.5px] text-[var(--muted)] mb-3">Send this report to {account.name} on a schedule.</p>
          {canWrite ? (<>
            <label className="eyebrow">Frequency</label>
            <div className="mt-2 mb-3.5"><Segmented value={schedule.freq} onChange={(v) => { setSchedule(account.id, { ...schedule, freq: v }); toast.success(v === 'off' ? 'Automatic delivery turned off' : `Scheduled ${v}`, { description: v === 'off' ? account.name : `${account.name} · next ${fmt(nextSend(v))}` }) }} options={FREQ_OPTS.map((o) => ({ value: o.value, label: o.label }))} className="w-full" /></div>
            <label className="eyebrow">Send to</label>
            <input type="email" value={schedule.recipient} onChange={(e) => setSchedule(account.id, { ...schedule, recipient: e.target.value })} placeholder="client@email.com" className="w-full mt-2 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
            {schedule.freq !== 'off' && <div className="mt-3 flex items-center gap-2 text-[11.5px] text-[var(--ink-2)] bg-[var(--accent-weak)] rounded-[8px] px-3 py-2"><CalendarClock size={13} className="text-[var(--accent)] flex-none" />Next send <b className="text-[var(--ink)]">{fmt(nextSend(schedule.freq))}</b>{schedule.recipient ? <> to {schedule.recipient}</> : null}</div>}
          </>) : (
            <div className="text-[12px] text-[var(--ink-2)]">{schedule.freq === 'off' ? <>No automatic delivery set. <span className="text-[var(--muted)]">Read-only.</span></> : <>Sends <b>{schedule.freq}</b>, next {fmt(nextSend(schedule.freq))}. <span className="text-[var(--muted)]">Read-only.</span></>}</div>
          )}
        </Card>
      </div>

      {/* Sheet */}
      <Card className="print-sheet overflow-hidden" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}>
        <div className="h-1.5" style={{ background: account.color }} />
        <div className="p-7 md:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)] mb-3">
                {brand.logo ? <img src={logoSrc} alt={brand.agencyName} className="h-[34px] w-auto max-w-[200px] object-contain object-left" /> : <><span className="w-[22px] h-[22px] rounded-[6px] grid place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{brandMonogram}</span><span className="font-semibold">{brand.agencyName}</span></>}
              </div>
              <div className="eyebrow" style={{ color: account.color }}>{account.niche} · {account.location}</div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight mt-1">{title}</h1>
              <div className="text-[15px] font-semibold text-[var(--ink-2)] mt-1">{account.name} · {account.handle}</div>
            </div>
            <ClientMark account={account} className="w-16 h-16 rounded-[14px] text-[19px]" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[var(--line)]">
            <Meta label="Prepared for" value={account.name} />
            <Meta label="Reporting period" value={period} />
            <Meta label="Platforms" value={account.platforms.map((p) => socialPlatform(p).name).join(' · ')} />
            <Meta label="Prepared by" value={brand.agencyName} />
          </div>

          <div className="flex flex-col gap-7 mt-8">
            {sections.headline && (
              <Section n={active.findIndex((s) => s.key === 'headline') + 1} title="Headline results" color={account.color}>
                <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed mb-4">{account.name} reached <b className="text-[var(--ink)]">{compact(m.reach)}</b> accounts at a <b className="text-[var(--ink)]">{m.engagementRate}%</b> engagement rate this period, and grew to <b className="text-[var(--ink)]">{compact(account.followers)}</b> followers.</p>
                <div className="grid grid-cols-3 gap-3">
                  <Mini label="Followers" value={compact(account.followers)} delta={account.followersDelta} />
                  <Mini label="Reach" value={compact(m.reach)} delta={m.reachDelta} />
                  <Mini label="Engagement" value={m.engagementRate + '%'} note={`${m.erDelta >= 0 ? '+' : ''}${m.erDelta} pts`} />
                </div>
              </Section>
            )}

            {sections.channels && (
              <Section n={active.findIndex((s) => s.key === 'channels') + 1} title="Channel performance" color={account.color}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px] min-w-[420px]">
                    <thead><tr className="border-b border-[var(--line-2)]"><Th>Platform</Th><Th right>Followers</Th><Th right>Reach</Th><Th right>Eng. rate</Th><Th right>Posts</Th></tr></thead>
                    <tbody>
                      {account.channels.map((c) => { const pl = socialPlatform(c.platform); return (
                        <tr key={c.platform} className="border-b border-[var(--line)]">
                          <td className="py-2.5 font-medium"><span className="inline-flex items-center gap-2"><PlatformLogo platform={c.platform} size={20} />{pl.name}</span></td>
                          <td className="py-2.5 text-right mono">{compact(c.followers)}</td>
                          <td className="py-2.5 text-right mono">{compact(c.reach)}</td>
                          <td className="py-2.5 text-right mono">{c.engagementRate}%</td>
                          <td className="py-2.5 text-right mono">{c.posts}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {sections.posts && (
              <Section n={active.findIndex((s) => s.key === 'posts') + 1} title="Top posts" color={account.color}>
                <div className="flex flex-col gap-2.5">
                  {topPosts.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] px-3.5 py-2.5">
                      <PlatformLogo platform={p.platform} size={24} />
                      <div className="min-w-0 flex-1"><div className="text-[12.5px] font-medium truncate">{p.caption}</div><div className="text-[11px] text-[var(--muted)]">{POST_TYPE_LABEL[p.type]} · {p.daysAgo}d ago</div></div>
                      <div className="text-right text-[11.5px]"><div className="mono font-semibold">{compact(p.reach)} reach</div><div className="text-[var(--muted)]">{p.engagementRate}% ER</div></div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {sections.summary && (
              <Section n={active.findIndex((s) => s.key === 'summary') + 1} title="Summary & next steps" color={account.color}>
                <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)] mb-3">Engagement {m.erDelta >= 0 ? 'held up' : 'softened'} this period and followers {account.followersDelta >= 0 ? 'grew' : 'dipped'} {Math.abs(account.followersDelta).toFixed(1)}%. The plan below keeps reach compounding.</p>
                <ul className="flex flex-col gap-2">
                  {recs.slice(0, 3).map((r, i) => (
                    <li key={r.id} className="flex items-start gap-2.5 text-[13px] text-[var(--ink-2)]"><span className="mt-0.5 w-4 h-4 rounded-full grid place-items-center flex-none text-[10px] font-bold text-white" style={{ background: account.color }}>{i + 1}</span><span><b className="text-[var(--ink)]">{r.title}.</b> {r.rationale}</span></li>
                  ))}
                </ul>
              </Section>
            )}

            {active.length === 0 && <p className="text-[13px] text-[var(--muted)] py-8 text-center">Turn on a section to build the report.</p>}
          </div>

          <div className="border-t border-[var(--line)] mt-8 pt-4 flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span>{account.name} · {period}</span><span>Prepared by {brand.agencyName} · Confidential</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{label}</div><div className="text-[13px] font-medium text-[var(--ink)] mt-0.5">{value}</div></div>
}
function Section({ n, title, children, color }: { n: number; title: string; children: React.ReactNode; color: string }) {
  return (
    <section className="break-inside-avoid">
      <div className="flex items-center gap-2.5 mb-3.5"><span className="mono text-[12px] font-bold w-6 h-6 rounded-[7px] grid place-items-center flex-none" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{n}</span><h2 className="text-[16px] font-bold tracking-[-0.01em]">{title}</h2></div>
      {children}
    </section>
  )
}
function Mini({ label, value, delta, note }: { label: string; value: string; delta?: number; note?: string }) {
  const good = delta === undefined ? true : delta >= 0
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] p-3.5">
      <div className="text-[10.5px] text-[var(--muted)] uppercase tracking-wide">{label}</div>
      <div className="mono text-[20px] font-semibold mt-1 leading-none">{value}</div>
      {delta !== undefined && <div className="mono text-[11px] font-semibold mt-1.5" style={{ color: good ? 'var(--good)' : 'var(--bad)' }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</div>}
      {note && <div className="mono text-[11px] font-semibold mt-1.5 text-[var(--ink-2)]">{note}</div>}
    </div>
  )
}
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`py-2 font-semibold text-[10.5px] uppercase tracking-wide text-[var(--muted)] ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

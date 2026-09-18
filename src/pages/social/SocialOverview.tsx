/** Social Overview: the social face's home — audience, reach and engagement
 *  across the roster, exceptions, and a client table. */
import { Link, useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { useApp } from '@/context/app'
import { RANGES } from '@/lib/data'
import { ClientMark } from '@/components/ClientMark'
import { socialTotals, socialMetrics, allSocialAlerts, socialHealth, type SocialAccount, type Health } from '@/lib/social'
import { useSocial } from '@/context/social'
import { SourceBadge } from '@/components/social/SourceBadge'
import { compact, num } from '@/lib/format'
import { useLoading } from '@/lib/useLoading'
import { Card, Stat, Segmented, Button, SectionTitle, SeverityDot, Chip } from '@/components/ui/kit'
import { PlatformLogo } from '@/components/social/PlatformLogo'
import { Reveal } from '@/components/ui/disclosure'

const HEALTH_LABEL: Record<Health, string> = { good: 'Healthy', watch: 'Watch', risk: 'At risk' }
const healthColor = (h: Health) => (h === 'good' ? 'var(--st-good)' : h === 'watch' ? 'var(--st-warn)' : 'var(--st-critical)')

export default function SocialOverview() {
  const { range, setRange } = useApp()
  const navigate = useNavigate()
  const { accounts, source, loading: socialLoading } = useSocial()
  const t = socialTotals(range, accounts)
  const alerts = allSocialAlerts(accounts)
  const loading = useLoading([range], 420) || socialLoading

  if (loading) {
    return <div className="flex flex-col gap-6"><div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[92px] rounded-[12px] bg-[var(--surface)] border border-[var(--line)]" />)}</div><div className="h-[300px] rounded-[12px] bg-[var(--surface)] border border-[var(--line)]" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <Stat label="Followers" value={compact(t.followers)} note={`+${compact(t.followerGrowth)} this period`} />
          <Stat label="Reach · period" value={compact(t.reach)} delta={t.reachDelta} note="vs prior" />
          <Stat label="Engagement rate" value={t.engagementRate + '%'} note="across accounts" />
          <Stat label="Posts published" value={num(t.posts)} note="this period" />
          <Stat label="Needs attention" value={t.openAlerts} note={`${accounts.length} accounts`} />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <SourceBadge source={source} />
          <span className="text-[11.5px] text-[var(--muted)]">
            {source === 'live' ? 'Pulled from your connected Meta accounts.'
              : source === 'seed' ? 'Connected, but showing stand-in numbers until a live pull succeeds.'
              : 'Showcase roster — connect Meta to see your own accounts.'}
          </span>
        </div>
      </Reveal>

      {alerts.length > 0 && (
        <Reveal delay={0.06}>
          <SectionTitle right={<Button variant="ghost" onClick={() => navigate('/app/social')}>Refresh</Button>}>Needs attention</SectionTitle>
          <Card>
            {alerts.slice(0, 4).map((al, i) => (
              <Link key={al.id} to={`/app/social/clients/${al.accountId}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--line)]' : ''}`}>
                <SeverityDot severity={al.severity} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{al.title}</div>
                  <div className="text-[11.5px] text-[var(--ink-2)] truncate">{al.detail}</div>
                </div>
                <span className="text-[11px] text-[var(--muted)] font-medium whitespace-nowrap hidden sm:block">{al.accountName}</span>
                <Chip tone={al.severity === 'serious' ? 'serious' : 'warn'}>{al.tag}</Chip>
              </Link>
            ))}
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.12}>
        <SectionTitle right={<Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />}>Accounts</SectionTitle>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <Th>Account</Th><Th>Platforms</Th><Th right>Followers</Th><Th right>Reach</Th><Th right>Engagement</Th><Th>Health</Th><Th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => <Row key={a.id} a={a} range={range} />)}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  )
}

function Row({ a, range }: { a: SocialAccount; range: any }) {
  const m = socialMetrics(a, range)
  const h = socialHealth(a)
  return (
    <tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
      <td className="py-3 px-4">
        <Link to={`/app/social/clients/${a.id}`} className="flex items-center gap-2.5 group">
          <ClientMark account={a} className="w-8 h-8 rounded-[8px] text-[11px]" />
          <span><span className="block font-semibold text-[13px] group-hover:text-[var(--accent)] transition-colors">{a.name}</span><span className="block text-[11px] text-[var(--muted)]">{a.handle} · {a.location}</span></span>
        </Link>
      </td>
      <td className="py-3 px-4"><div className="flex items-center gap-1.5">{a.platforms.map((p) => <PlatformLogo key={p} platform={p} size={19} />)}</div></td>
      <td className="py-3 px-4 text-right mono">{compact(a.followers)}<span className={`ml-1.5 text-[11px] ${a.followersDelta >= 0 ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>{a.followersDelta >= 0 ? '▲' : '▼'}{Math.abs(a.followersDelta).toFixed(1)}%</span></td>
      <td className="py-3 px-4 text-right mono">{compact(m.reach)}</td>
      <td className="py-3 px-4 text-right mono">{m.engagementRate}%</td>
      <td className="py-3 px-4"><span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: healthColor(h) }}><span className="w-[7px] h-[7px] rounded-full" style={{ background: healthColor(h) }} />{HEALTH_LABEL[h]}</span></td>
      <td className="py-3 px-4 text-right"><ArrowRight size={15} className="text-[var(--muted)]" /></td>
    </tr>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`py-2.5 px-4 font-semibold text-[10.5px] uppercase tracking-wide text-[var(--muted)] ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

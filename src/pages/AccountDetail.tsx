/** Account detail: summary first, detail revealed on demand, per-platform tabs. */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  ArrowLeft, FileText, ShieldCheck, Timer, TrendingUp, TrendingDown, Lock, LineChart, Cable, Wallet,
} from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace } from '@/context/workspace'
import {
  metricsFor, pacing, health, serviceHealthFor, PLATFORMS, RANGES, type Account, type PlatformId, type Health,
} from '@/lib/data'
import { money, money2, moneyK, num, compact } from '@/lib/format'
import { useLoading } from '@/lib/useLoading'
import {
  Card, Stat, Button, Segmented, SectionTitle, HealthBadge, PacingBar, Chip, SeverityDot, KpiSkeleton, Skeleton,
} from '@/components/ui/kit'
import { Reveal, ExpandableCard } from '@/components/ui/disclosure'
import { RecommendationsPanel } from '@/components/Recommendations'

const TOOLTIP = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: 'var(--shadow-pop)', fontSize: 12, color: 'var(--ink)' }

export default function AccountDetail() {
  const { id = '' } = useParams()
  const { range, setRange } = useApp()
  const { me, isAdmin, getClient, canSee, openAlerts } = useWorkspace()
  const account = getClient(id)
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | PlatformId>('overview')
  const loading = useLoading([id, range], 450)

  if (!account) return <NotFound onBack={() => navigate('/app')} title="That account does not exist." />
  if (me && !canSee(me, account.id)) return <NotFound onBack={() => navigate('/app')} title="This account is outside your book." icon />

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton h={20} w={90} />
        <div className="flex items-center gap-4"><Skeleton h={56} w={56} className="rounded-[13px]" /><div className="flex flex-col gap-2"><Skeleton h={22} w={220} /><Skeleton h={12} w={160} /></div></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">{Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}</div>
      </div>
    )
  }

  const alerts = openAlerts([account])
  const ownerView = isAdmin

  return (
    <div className="flex flex-col gap-5">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)] hover:text-[var(--ink)] w-fit"><ArrowLeft size={14} /> Portfolio</Link>

      <Reveal>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-[13px] grid place-items-center flex-none mono font-bold text-[18px] text-white" style={{ background: account.color }}>{account.mark}</div>
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-tight">{account.name}</h1>
            <div className="flex items-center gap-2.5 mt-0.5"><span className="text-[13px] text-[var(--ink-2)]">{account.trade} · {account.location}</span><HealthBadge health={health(account)} /></div>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />
            <Button variant="primary" className="press" onClick={() => navigate(`/app/reports?account=${account.id}`)}><FileText size={15} /> Export report</Button>
          </div>
        </div>
      </Reveal>

      {alerts.length > 0 && (
        <Reveal delay={0.04}>
          <Card className="divide-y divide-[var(--line)]">
            {alerts.map((al) => (
              <div key={al.id} className="flex items-center gap-3 px-4 py-2.5">
                <SeverityDot severity={al.severity} />
                <span className="text-[12.5px] font-medium flex-1">{al.title}</span>
                <Chip tone={al.severity === 'serious' ? 'serious' : 'warn'}>{al.tag}</Chip>
              </div>
            ))}
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.06}>
        <div className="overflow-x-auto clip-scroll -mx-1 px-1">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'overview' as const, label: 'Overview' }, ...PLATFORMS.map((p) => ({ value: p.id, label: p.short }))]} />
        </div>
      </Reveal>

      {tab === 'overview' && <Overview account={account} ownerView={ownerView} range={range} />}
      {tab === 'lsa' && <LSA account={account} />}
      {tab === 'googleAds' && <GoogleAds account={account} />}
      {tab === 'gbp' && <GBP account={account} />}
      {tab === 'meta' && <Meta account={account} />}
      {tab === 'semrush' && <SEMrush account={account} />}
    </div>
  )
}

function healthColor(h: Health): string {
  return h === 'good' ? 'var(--st-good)' : h === 'watch' ? 'var(--st-warn)' : 'var(--st-critical)'
}

function NotFound({ onBack, title, icon }: { onBack: () => void; title: string; icon?: boolean }) {
  return (
    <div className="text-center py-20">
      {icon && <Lock size={22} className="mx-auto mb-3 text-[var(--muted)]" />}
      <p className="text-[14px] text-[var(--ink-2)] mb-4">{title}</p>
      <Button onClick={onBack}>Back to portfolio</Button>
    </div>
  )
}

function Overview({ account, ownerView, range }: { account: Account; ownerView: boolean; range: any }) {
  const m = metricsFor(account, range)
  const p = pacing(account)
  const leads = account.leadsDaily.slice(-30)
  const spend = account.spendDaily.slice(-30)

  return (
    <div className="flex flex-col gap-5">
      <Reveal delay={0.08}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Stat label="Leads" value={num(m.leads)} delta={m.leadsDelta} note="all channels" />
          <Stat label="Cost / lead" value={money2(m.cpl)} delta={m.cplDelta} lowerIsBetter note="blended" />
          <Stat label="Ad spend" value={money(m.spend)} delta={m.spendDelta} lowerIsBetter />
          <Card className="p-4 flex flex-col gap-2">
            <span className="eyebrow">Spend pacing · MTD</span>
            <span className="mono text-[26px] font-semibold leading-none">{p.pct}%</span>
            <PacingBar pct={p.pct} spendLabel={`${moneyK(p.mtd)} / ${moneyK(p.budget)}`} />
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <SectionTitle>Recommendations</SectionTitle>
        <RecommendationsPanel accounts={[account]} showAccount={false} />
      </Reveal>

      <Reveal delay={0.16} className="flex flex-col gap-3.5">
        <ExpandableCard title="Performance · last 30 days" subtitle="Leads and spend per day" icon={<LineChart size={17} />} defaultOpen>
          <div className="grid md:grid-cols-2 gap-4 pt-3">
            <TrendCard title="Leads / day" data={leads.map((v, i) => ({ d: i, v: Math.round(v) }))} color="var(--s-blue)" />
            <TrendCard title="Spend / day" data={spend.map((v, i) => ({ d: i, v: Math.round(v) }))} color="var(--s-orange)" fmt={(v) => money(v)} />
          </div>
        </ExpandableCard>

        <ExpandableCard title="Service health" subtitle="Each platform's status, headline metric and a one-line read" icon={<Cable size={17} />} defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3">
            {serviceHealthFor(account).map((s) => {
              const color = healthColor(s.status)
              return (
                <div key={s.id} className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[10px] px-3.5 py-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-[9px] h-[9px] rounded-full flex-none" style={{ background: color }} />
                    <span className="font-semibold text-[12.5px] flex-1">{s.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{s.label}</span>
                  </div>
                  <span className="mono text-[15px] font-semibold leading-none mt-1">{s.keyMetric}</span>
                  <span className="text-[11px] text-[var(--muted)] leading-tight">{s.summary}</span>
                </div>
              )
            })}
          </div>
        </ExpandableCard>

        {ownerView && (
          <ExpandableCard title="Account economics" subtitle="Owner seat" icon={<Wallet size={17} />}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-3">
              <Stat label="Monthly retainer" value={money(account.retainer)} note="Recurring fee" />
              <Stat label="Ad budget" value={money(account.budget)} note="Pass-through" />
              <Stat label="Est. gross margin" value={money(Math.round(account.retainer * 0.62))} note="After delivery" />
              <Stat label="Cost / acquired job" value={money2(m.cpl * 3.4)} note="~29% lead to job" />
            </div>
          </ExpandableCard>
        )}
      </Reveal>
    </div>
  )
}

function TrendCard({ title, data, color, fmt }: { title: string; data: { d: number; v: number }[]; color: string; fmt?: (v: number) => string }) {
  const gid = 'tc' + color.replace(/\W/g, '')
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.24} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="d" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} interval={5} tickFormatter={(d) => `${30 - d}d`} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (fmt ? fmt(v) : String(v))} />
          <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [fmt ? fmt(v) : v, title.split(' /')[0]]} labelFormatter={(d) => `${30 - (d as number)} days ago`} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function MiniChart({ data, color = 'var(--s-blue)', bars = false }: { data: number[]; color?: string; bars?: boolean }) {
  const rows = data.map((v, i) => ({ i, v }))
  const gid = 'mc' + color.replace(/\W/g, '')
  return (
    <ResponsiveContainer width="100%" height={130}>
      {bars ? (
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} /><YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={34} /><Tooltip contentStyle={TOOLTIP} />
          <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      ) : (
        <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.22} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--line)" vertical={false} /><YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={34} /><Tooltip contentStyle={TOOLTIP} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
        </ComposedChart>
      )}
    </ResponsiveContainer>
  )
}

function PlatformChart({ title, data, color, bars }: { title: string; data: number[]; color?: string; bars?: boolean }) {
  return <Card className="p-4"><div className="eyebrow mb-2">{title}</div><MiniChart data={data} color={color} bars={bars} /></Card>
}

function LSA({ account }: { account: Account }) {
  const d = account.lsa
  return (
    <Reveal delay={0.08} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Stat label="Leads · 30d" value={num(d.leads)} note="Booked & messaged" />
        <Stat label="Cost / lead" value={money2(d.cpl)} note="Per valid lead" />
        <Card className="p-4 flex flex-col gap-2"><span className="eyebrow">Google Guaranteed</span><div className="flex items-center gap-2"><ShieldCheck size={22} style={{ color: d.guaranteed ? 'var(--st-good)' : 'var(--st-critical)' }} /><span className="font-semibold text-[16px]">{d.guaranteed ? 'Verified' : 'Pending'}</span></div><span className="text-[11.5px] text-[var(--muted)]">{d.guaranteed ? 'Badge live on placements' : 'Background check in review'}</span></Card>
        <Card className="p-4 flex flex-col gap-2"><span className="eyebrow">Avg response</span><div className="flex items-end gap-1.5"><Timer size={20} style={{ color: d.responseMins < 5 ? 'var(--st-good)' : 'var(--st-serious)' }} /><span className="mono text-[24px] font-semibold leading-none">{d.responseMins.toFixed(1)}</span><span className="text-[12px] text-[var(--muted)] mb-0.5">min</span></div><span className="text-[11.5px] text-[var(--muted)]">{d.responseMins < 5 ? 'Within target' : 'Above 5 min target'}</span></Card>
      </div>
      <PlatformChart title="Leads · last 8 weeks" data={d.series} color="var(--s-blue)" />
    </Reveal>
  )
}

function GoogleAds({ account }: { account: Account }) {
  const d = account.googleAds
  return (
    <Reveal delay={0.08} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Stat label="Spend · 30d" value={money(d.spend)} />
        <Stat label="Clicks" value={compact(d.clicks)} note={`${(d.clicks / 30).toFixed(0)}/day`} />
        <Stat label="Conversions" value={num(d.conversions)} note="calls & forms" />
        <Stat label="Cost / conversion" value={money2(d.costPerConv)} note={`${((d.conversions / d.clicks) * 100).toFixed(1)}% rate`} />
      </div>
      <PlatformChart title="Conversions · last 8 weeks" data={d.series} color="var(--s-orange)" bars />
    </Reveal>
  )
}

function GBP({ account }: { account: Account }) {
  const d = account.gbp
  return (
    <Reveal delay={0.08} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Stat label="Rating" value={d.rating.toFixed(1)} delta={((d.rating - d.ratingPrev) / d.ratingPrev) * 100} note="of 5.0" />
        <Stat label="Reviews" value={num(d.reviews)} note={`+${d.reviewDelta} this month`} />
        <Stat label="Profile views" value={compact(d.views)} note="search + maps" />
        <Stat label="Direction requests" value={num(d.directions)} note="high intent" />
      </div>
      <PlatformChart title="Rating · last 8 weeks" data={d.series} color="var(--s-aqua)" />
    </Reveal>
  )
}

function Meta({ account }: { account: Account }) {
  const d = account.meta
  return (
    <Reveal delay={0.08} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Stat label="Spend · 30d" value={money(d.spend)} />
        <Stat label="Results" value={num(d.results)} note="leads" />
        <Stat label="Cost / result" value={money2(d.costPerResult)} />
        <Stat label="Reach" value={compact(d.reach)} note="unique people" />
      </div>
      <PlatformChart title="Results · last 8 weeks" data={d.series} color="var(--s-blue)" bars />
    </Reveal>
  )
}

function SEMrush({ account }: { account: Account }) {
  const d = account.semrush
  return (
    <Reveal delay={0.08} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        <Stat label="Keywords tracked" value={num(d.keywords)} note="local market" />
        <Stat label="Visibility score" value={d.visibility.toFixed(1) + '%'} delta={d.visibilityDelta} note="top-20 share" />
        <PlatformChart title="Visibility · last 8 weeks" data={d.series} color="var(--s-aqua)" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Movers title="Top gaining" moves={d.gaining} gaining />
        <Movers title="Losing ground" moves={d.losing} gaining={false} />
      </div>
    </Reveal>
  )
}

function Movers({ title, moves, gaining }: { title: string; moves: { term: string; from: number; to: number }[]; gaining: boolean }) {
  const color = gaining ? 'var(--st-good)' : 'var(--st-serious)'
  const Icon = gaining ? TrendingUp : TrendingDown
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3"><Icon size={15} style={{ color }} /><h3 className="text-[13px] font-bold">{title}</h3></div>
      <div className="flex flex-col gap-1.5">
        {moves.map((mv) => (
          <div key={mv.term} className="flex items-center justify-between gap-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-[8px] px-3 py-2">
            <span className="text-[12.5px] truncate">{mv.term}</span>
            <span className="mono text-[11.5px] flex items-center gap-1.5 flex-none text-[var(--muted)]">#{mv.from} <span style={{ color }}>→</span> <span className="font-semibold" style={{ color }}>#{mv.to}</span></span>
          </div>
        ))}
      </div>
    </Card>
  )
}

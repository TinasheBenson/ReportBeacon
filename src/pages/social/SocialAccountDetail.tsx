/** Social client detail: audience and engagement, per-platform channels,
 *  the engagement trend, top posts, and social recommendations. */
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Heart, MessageCircle, Share2, Bookmark, Play, Clock, Lightbulb } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { useApp } from '@/context/app'
import { RANGES } from '@/lib/data'
import { ClientMark } from '@/components/ClientMark'
import {
  socialMetrics, socialHealth, socialRecsFor, socialAlertsFor, socialPlatform,
  POST_TYPE_LABEL, type Post, type Health, type SocialRec,
} from '@/lib/social'
import { useSocial } from '@/context/social'
import { compact } from '@/lib/format'
import { useLoading } from '@/lib/useLoading'
import { useWorkspace } from '@/context/workspace'
import { Card, Stat, Segmented, Button, SectionTitle, SeverityDot, Chip } from '@/components/ui/kit'
import { PlatformLogo } from '@/components/social/PlatformLogo'
import { Reveal } from '@/components/ui/disclosure'

const TOOLTIP = { background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, fontSize: 12, color: 'var(--ink)', boxShadow: 'var(--shadow-pop)' } as any
const HEALTH_LABEL: Record<Health, string> = { good: 'Healthy', watch: 'Watch', risk: 'At risk' }
const healthColor = (h: Health) => (h === 'good' ? 'var(--st-good)' : h === 'watch' ? 'var(--st-warn)' : 'var(--st-critical)')
const CAT_LABEL: Record<SocialRec['category'], string> = { cadence: 'Cadence', format: 'Format', timing: 'Timing', engagement: 'Engagement', growth: 'Growth' }

export default function SocialAccountDetail() {
  const { id = '' } = useParams()
  const { range, setRange, theme } = useApp()
  const { brand } = useWorkspace()
  const navigate = useNavigate()
  const { accountById } = useSocial()
  const account = accountById(id)
  const loading = useLoading([id, range], 420)

  const m = useMemo(() => (account ? socialMetrics(account, range) : null), [account, range])

  if (!account) {
    return <div className="text-center py-20"><p className="text-[14px] text-[var(--ink-2)] mb-4">That account does not exist.</p><Button onClick={() => navigate('/app/social')}>Back to social</Button></div>
  }
  if (loading || !m) {
    return <div className="flex flex-col gap-5"><div className="h-[64px] rounded-[12px] bg-[var(--surface)] border border-[var(--line)]" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[92px] rounded-[12px] bg-[var(--surface)] border border-[var(--line)]" />)}</div></div>
  }

  const h = socialHealth(account)
  const alerts = socialAlertsFor(account)
  const recs = socialRecsFor(account)
  const topPosts = [...account.posts].sort((a, b) => b.reach * b.engagementRate - a.reach * a.engagementRate).slice(0, 6)
  const trend = account.engagementDaily.slice(-30).map((v, i) => ({ d: i, v: +v.toFixed(1) }))
  const reachTrend = account.reachDaily.slice(-30).map((v, i) => ({ d: i, v: Math.round(v) }))
  // Charts follow the active Social brand: the highlight for engagement, the
  // navigation colour for reach (resolved to real hex so SVG strokes apply).
  const engColor = brand.social.accent
  const reachColor = brand.social.base ?? brand.social.accent
  const gridColor = theme === 'dark' ? '#262a31' : '#e7e9ee'
  const axisColor = theme === 'dark' ? '#737a88' : '#98a2b3'

  return (
    <div className="flex flex-col gap-5">
      <Link to="/app/social" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)] hover:text-[var(--ink)] w-fit"><ArrowLeft size={14} /> Social</Link>

      <Reveal>
        <div className="flex flex-wrap items-center gap-4">
          <ClientMark account={account} className="w-14 h-14 rounded-[13px] text-[18px]" />
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-tight">{account.name}</h1>
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="text-[13px] text-[var(--ink-2)]">{account.handle} · {account.location}</span>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: healthColor(h) }}><span className="w-[7px] h-[7px] rounded-full" style={{ background: healthColor(h) }} />{HEALTH_LABEL[h]}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />
            <Button variant="primary" className="press" onClick={() => navigate(`/app/social/reports?account=${account.id}`)}><FileText size={15} /> Export report</Button>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Stat label="Followers" value={compact(account.followers)} delta={account.followersDelta} note="period over period" />
          <Stat label="Reach" value={compact(m.reach)} delta={m.reachDelta} note="vs prior" />
          <Stat label="Engagement rate" value={m.engagementRate + '%'} note={`${m.erDelta >= 0 ? '+' : ''}${m.erDelta} pts`} />
          <Card className="p-4 flex flex-col gap-1.5">
            <span className="eyebrow">Best time to post</span>
            <span className="text-[22px] font-bold leading-none flex items-center gap-1.5"><Clock size={18} className="text-[var(--accent)]" />{account.bestTime}</span>
            <span className="text-[11px] text-[var(--muted)]">{m.posts} posts this period</span>
          </Card>
        </div>
      </Reveal>

      {/* Channels */}
      <Reveal delay={0.1}>
        <SectionTitle>Channels</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {account.channels.map((c) => {
            const pl = socialPlatform(c.platform)
            return (
              <Card key={c.platform} className="p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <PlatformLogo platform={c.platform} size={24} />
                  <span className="text-[13px] font-semibold">{pl.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                  <Kv k="Followers" v={compact(c.followers)} />
                  <Kv k="Eng. rate" v={c.engagementRate + '%'} />
                  <Kv k="Reach" v={compact(c.reach)} />
                  <Kv k="Posts" v={String(c.posts)} />
                </div>
              </Card>
            )
          })}
        </div>
      </Reveal>

      {/* Trends */}
      <Reveal delay={0.12}>
        <Card className="p-4">
          <div className="grid md:grid-cols-2 gap-5">
            <TrendChart title="Engagement rate / day" data={trend} color={engColor} grid={gridColor} axis={axisColor} fmt={(v) => v + '%'} />
            <TrendChart title="Reach / day" data={reachTrend} color={reachColor} grid={gridColor} axis={axisColor} fmt={(v) => compact(v)} />
          </div>
        </Card>
      </Reveal>

      {/* Top posts */}
      <Reveal delay={0.14}>
        <SectionTitle>Top posts</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topPosts.map((p) => <PostCard key={p.id} p={p} />)}
        </div>
      </Reveal>

      {/* Recommendations */}
      <Reveal delay={0.16}>
        <SectionTitle>Recommendations <span className="text-[11px] font-medium text-[var(--muted)] ml-1">{recs.length} for this account</span></SectionTitle>
        <div className="grid md:grid-cols-2 gap-3.5">
          {recs.map((r) => (
            <Card key={r.id} className="p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-[8px] grid place-items-center flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}><Lightbulb size={15} /></span>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">{CAT_LABEL[r.category]}</span>
                <span className="ml-auto text-[11px] font-semibold capitalize" style={{ color: r.priority === 'high' ? 'var(--st-serious)' : r.priority === 'medium' ? 'var(--st-warn)' : 'var(--muted)' }}>{r.priority}</span>
              </div>
              <div className="text-[13.5px] font-semibold leading-snug">{r.title}</div>
              <p className="text-[12.5px] text-[var(--ink-2)] leading-relaxed">{r.rationale}</p>
              <div className="text-[12px] font-medium mt-auto pt-1" style={{ color: 'var(--good)' }}>{r.impact}</div>
              <div><Button className="press" onClick={() => toast.success('Added to plan', { description: r.title })}>{r.action}</Button></div>
            </Card>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[10px] text-[var(--muted)] uppercase tracking-wide">{k}</div><div className="mono text-[13px] font-semibold">{v}</div></div>
}

function PostCard({ p }: { p: Post }) {
  return (
    <Card className="p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <PlatformLogo platform={p.platform} size={20} />
        <span className="text-[11px] font-semibold text-[var(--ink-2)]">{POST_TYPE_LABEL[p.type]}</span>
        <span className="ml-auto text-[11px] text-[var(--muted)]">{p.daysAgo}d ago</span>
      </div>
      <div className="text-[13px] font-medium leading-snug line-clamp-2">{p.caption}</div>
      <div className="flex items-center gap-3 text-[11.5px] text-[var(--ink-2)] mt-auto pt-1">
        <span className="inline-flex items-center gap-1"><Heart size={12} /> {compact(p.likes)}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {compact(p.comments)}</span>
        <span className="inline-flex items-center gap-1"><Share2 size={12} /> {compact(p.shares)}</span>
        <span className="inline-flex items-center gap-1"><Bookmark size={12} /> {compact(p.saves)}</span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[11.5px]">
        <span className="text-[var(--muted)]">Reach <b className="text-[var(--ink)] mono">{compact(p.reach)}</b></span>
        {p.videoViews != null && <span className="text-[var(--muted)] inline-flex items-center gap-1"><Play size={11} /> <b className="text-[var(--ink)] mono">{compact(p.videoViews)}</b></span>}
        <span className="font-semibold" style={{ color: 'var(--accent)' }}>{p.engagementRate}% ER</span>
      </div>
    </Card>
  )
}

function TrendChart({ title, data, color, grid, axis, fmt }: { title: string; data: { d: number; v: number }[]; color: string; grid: string; axis: string; fmt?: (v: number) => string }) {
  const gid = 'st' + title.replace(/\W/g, '')
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.24} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="d" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} interval={5} tickFormatter={(d) => `${30 - d}d`} />
          <YAxis tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (fmt ? fmt(v) : String(v))} />
          <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [fmt ? fmt(v) : v, title.split(' /')[0]]} labelFormatter={(d) => `${30 - (d as number)} days ago`} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

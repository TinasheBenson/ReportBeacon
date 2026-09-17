/** Sortable accounts table with expandable rows (click to peek, then drill in). */
import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, ArrowUpDown, ArrowRight } from 'lucide-react'
import { metricsFor, pacing, health, type Account, type RangeId, type Health } from '@/lib/data'
import { ClientMark } from '@/components/ClientMark'
import { money, money2, moneyK, num } from '@/lib/format'
import { recommendationsFor } from '@/lib/recommend'
import { useWorkspace } from '@/context/workspace'
import { Card, HealthBadge, Delta, PacingBar, SourceDots, Sparkline, Button, PriorityDot } from '@/components/ui/kit'
import { Collapse } from '@/components/ui/disclosure'

type SortKey = 'name' | 'health' | 'leads' | 'cpl' | 'pacing' | 'rating'
const HEALTH_RANK: Record<Health, number> = { risk: 0, watch: 1, good: 2 }

export default function AccountsTable({ range, accounts, showManager = false }: { range: RangeId; accounts: Account[]; showManager?: boolean }) {
  const navigate = useNavigate()
  const { managerFor, isAdmin, members, assignClient } = useWorkspace()
  const managers = members.filter((mm) => mm.role === 'manager')
  const [sort, setSort] = useState<SortKey>('health')
  const [dir, setDir] = useState<1 | -1>(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const data = accounts.map((a) => ({ a, m: metricsFor(a, range), p: pacing(a), h: health(a) }))
    const val = (r: (typeof data)[number]) => {
      switch (sort) {
        case 'name': return r.a.name.toLowerCase()
        case 'health': return HEALTH_RANK[r.h]
        case 'leads': return r.m.leads
        case 'cpl': return r.m.cpl
        case 'pacing': return r.p.pct
        case 'rating': return r.a.gbp.rating
      }
    }
    return [...data].sort((x, y) => {
      const vx = val(x), vy = val(y)
      if (vx < vy) return -1 * dir
      if (vx > vy) return 1 * dir
      return 0
    })
  }, [accounts, range, sort, dir])

  const clickSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1))
    else { setSort(k); setDir(k === 'name' || k === 'health' ? 1 : -1) }
  }

  const Th = ({ k, children, align = 'left' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th className={`px-3.5 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button onClick={() => clickSort(k)} className={`inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-[0.05em] uppercase transition-colors ${sort === k ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink-2)]'}`}>
        {children}<ArrowUpDown size={11} className={sort === k ? 'opacity-100' : 'opacity-40'} />
      </button>
    </th>
  )
  const colCount = 8 + (showManager ? 1 : 0)

  return (
    <Card className="overflow-x-auto clip-scroll">
      <table className="w-full border-collapse min-w-[880px]">
        <thead>
          <tr className="border-b border-[var(--line)]">
            <Th k="name">Account</Th>
            <Th k="health">Health</Th>
            <Th k="leads" align="right">Leads</Th>
            <Th k="cpl" align="right">Cost / lead</Th>
            <Th k="pacing">Spend pacing</Th>
            <th className="px-3.5 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[var(--muted)]">Trend</th>
            <Th k="rating" align="right">Rating</Th>
            {showManager && <th className="px-3.5 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[var(--muted)]">Manager</th>}
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ a, m, p, h }) => {
            const open = openId === a.id
            const mgr = managerFor(a.id)
            const topRec = recommendationsFor(a)[0]
            return (
              <Fragment key={a.id}>
                <tr
                  onClick={() => setOpenId(open ? null : a.id)}
                  className={`border-b border-[var(--line)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors ${open ? 'bg-[var(--surface-2)]' : ''}`}
                >
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <ClientMark account={a} className="w-8 h-8 rounded-[8px] text-[12px]" />
                      <div><div className="font-semibold text-[13.5px] tracking-[-0.01em]">{a.name}</div><div className="text-[11.5px] text-[var(--muted)]">{a.trade} · {a.location}</div></div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3"><HealthBadge health={h} /></td>
                  <td className="px-3.5 py-3 text-right"><div className="mono text-[13.5px] font-semibold">{num(m.leads)}</div><Delta value={m.leadsDelta} /></td>
                  <td className="px-3.5 py-3 text-right"><div className="mono text-[13.5px] font-semibold">{money2(m.cpl)}</div><Delta value={m.cplDelta} lowerIsBetter /></td>
                  <td className="px-3.5 py-3"><PacingBar pct={p.pct} spendLabel={moneyK(p.mtd)} /></td>
                  <td className="px-3.5 py-3"><Sparkline data={a.leadsDaily.slice(-30).filter((_, i) => i % 3 === 0)} color={a.color} /></td>
                  <td className="px-3.5 py-3 text-right"><span className="mono text-[13.5px] font-semibold">{a.gbp.rating.toFixed(1)}</span></td>
                  {showManager && <td className="px-3.5 py-3"><span className="text-[12px] text-[var(--ink-2)]">{mgr?.name.split(' ')[0] ?? '-'}</span></td>}
                  <td className="px-2 py-3 text-right"><ChevronRight size={16} className={`text-[var(--muted)] transition-transform ${open ? 'rotate-90' : ''}`} /></td>
                </tr>
                <tr>
                  <td colSpan={colCount} className="p-0 border-b border-[var(--line)]">
                    <Collapse open={open}>
                      <div className="px-3.5 py-4 bg-[var(--surface-2)]">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <Peek label="Leads · 30d" value={num(m.leads)} />
                          <Peek label="Cost / lead" value={money2(m.cpl)} />
                          <Peek label="Spend · 30d" value={money(m.spend)} />
                          <Peek label="Pacing" value={p.pct + '%'} />
                        </div>
                        <div className="flex items-center gap-2 mb-3 text-[12.5px]">
                          <span className="text-[var(--muted)]">Owner</span>
                          {isAdmin ? (
                            <select
                              value={managerFor(a.id)?.id ?? ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); assignClient(a.id, e.target.value) }}
                              className="bg-[var(--surface)] border border-[var(--line-2)] rounded-[7px] px-2 py-1 text-[12.5px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                            >
                              <option value="">Unassigned</option>
                              {managers.map((mm) => <option key={mm.id} value={mm.id}>{mm.name}</option>)}
                            </select>
                          ) : (
                            <span className="font-medium">{managerFor(a.id)?.name ?? 'Unassigned'}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {topRec && (
                            <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
                              <PriorityDot priority={topRec.priority} />
                              <span className="font-medium text-[var(--ink)]">Top action:</span> {topRec.title}
                            </div>
                          )}
                          <div className="flex items-center gap-3 ml-auto">
                            <SourceDots sources={a.sources} />
                            <Button variant="primary" className="press" onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/app/accounts/${a.id}`) }}>
                              Open account <ArrowRight size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Collapse>
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function Peek({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mono text-[16px] font-semibold mt-0.5">{value}</div>
    </div>
  )
}

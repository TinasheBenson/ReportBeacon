/** Portfolio: seat-scoped summary, exceptions rail, and the accounts table. */
import { Link, useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace } from '@/context/workspace'
import { RANGES, portfolioTotals } from '@/lib/data'
import { money, money2, moneyK, num } from '@/lib/format'
import { useLoading } from '@/lib/useLoading'
import { Card, Stat, Segmented, Button, SectionTitle, SeverityDot, Chip, KpiSkeleton, TableSkeleton } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'
import AccountsTable from '@/components/AccountsTable'

export default function Portfolio() {
  const { range, setRange } = useApp()
  const { me, isAdmin, accountsForSeat, members, openAlerts } = useWorkspace()
  const navigate = useNavigate()
  const isOwner = isAdmin
  const accounts = me ? accountsForSeat(me) : []
  const t = portfolioTotals(range, accounts)
  const alerts = openAlerts(accounts)
  const loading = useLoading([me?.id, range], 420)

  const managerCount = members.filter((mm) => mm.role === 'manager').length
  const retainerTotal = accounts.reduce((s, a) => s + a.retainer, 0)
  const marginEst = Math.round(retainerTotal * 0.62)

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">{Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}</div>
        <TableSkeleton rows={3} />
        <TableSkeleton rows={accounts.length} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <Stat label={isOwner ? 'Active accounts' : 'Your accounts'} value={t.accounts} note="All syncing" />
          <Stat label="Managed spend · 30d" value={moneyK(t.managed)} delta={t.spendDelta} note="vs prior" />
          <Stat label="Blended cost / lead" value={money2(t.cpl)} delta={t.cplDelta} lowerIsBetter note="lower is better" />
          <Stat label="Leads" value={num(t.leads)} delta={t.leadsDelta} note={isOwner ? 'across roster' : 'your book'} />
          <Stat label="Open alerts" value={alerts.length} note={`${t.atRisk} at risk · ${t.watch} watch`} />
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <SectionTitle right={<Button variant="ghost" onClick={() => navigate('/app/alerts')}>View all alerts <ArrowRight size={15} /></Button>}>Needs attention</SectionTitle>
        <Card>
          {alerts.slice(0, 4).map((al, i) => (
            <Link key={al.id} to={`/app/accounts/${al.accountId}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i > 0 ? 'border-t border-[var(--line)]' : ''}`}>
              <SeverityDot severity={al.severity} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[var(--ink)]">{al.title}</div>
                <div className="text-[11.5px] text-[var(--ink-2)] truncate">{al.detail}</div>
              </div>
              <span className="text-[11px] text-[var(--muted)] font-medium whitespace-nowrap hidden sm:block">{al.accountName}</span>
              <Chip tone={al.severity === 'serious' ? 'serious' : 'warn'}>{al.tag}</Chip>
            </Link>
          ))}
          {alerts.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">Nothing needs attention. Every account is healthy.</div>}
        </Card>
      </Reveal>

      <Reveal delay={0.12}>
        <SectionTitle right={<Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />}>Accounts</SectionTitle>
        <AccountsTable range={range} accounts={accounts} showManager={isOwner} />
      </Reveal>

      {isOwner && (
        <Reveal delay={0.18}>
          <SectionTitle>Agency economics <span className="text-[11px] font-medium text-[var(--muted)] ml-1">Owner seat</span></SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Stat label="Recurring retainer · mo" value={money(retainerTotal)} note={`Across ${accounts.length} accounts`} />
            <Stat label="Managed ad budget" value={money(accounts.reduce((s, a) => s + a.budget, 0))} note="Monthly, pass-through" />
            <Stat label="Est. gross margin" value={money(marginEst)} note="After delivery cost" />
            <Stat label="Books managed" value={num(managerCount)} note={`${managerCount === 1 ? 'account manager' : 'account managers'}`} />
          </div>
        </Reveal>
      )}
    </div>
  )
}

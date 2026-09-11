/**
 * Alert-rules engine.
 *
 * Alerts are no longer hard-coded thresholds — they are produced by evaluating
 * a set of configurable rules against each account's live metrics. This is the
 * seam a real backend would slot behind: `evaluate()` is a pure function over
 * (account, rules), so the same rule shapes could later be evaluated server-side
 * without changing any calling code. Four rule types, mirroring what a
 * production monitoring layer needs:
 *
 *   absolute_threshold — a metric crosses a fixed line (e.g. cost/lead over $60)
 *   wow_change         — a metric moved too far week-over-week
 *   budget_pacing      — spend is running ahead of the monthly budget
 *   missing_data       — a connected platform stopped syncing
 *
 * Each produced alert carries a lifecycle status (open → acknowledged →
 * resolved), applied by the workspace store from persisted state.
 */
import { metricsFor, pacing, PLATFORMS, getAccount, type Account, type Severity } from './data'
import { money, money2 } from './format'

export type RuleType = 'absolute_threshold' | 'wow_change' | 'budget_pacing' | 'missing_data'
export type Tier = 'critical' | 'high' | 'medium' | 'low'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'
export type MetricKey = 'cpl' | 'leads' | 'spend' | 'responseMins' | 'budgetPct' | 'visibility' | 'rating'

export interface RuleConfig {
  metric?: MetricKey
  operator?: 'gt' | 'lt'
  threshold?: number
  target?: number
  direction?: 'up' | 'down'
  changePct?: number
  warn?: number
  critical?: number
}

export interface AlertRule {
  id: string
  name: string
  scope: 'all' | string // 'all' or an account id
  ruleType: RuleType
  config: RuleConfig
  severity: Tier
  active: boolean
  createdAt: string
}

export interface AlertInstance {
  id: string // deterministic: `${accountId}:${ruleId}[:suffix]`
  ruleId: string
  ruleType: RuleType
  accountId: string
  accountName: string
  tier: Tier
  severity: Severity // visual bucket reused by existing SeverityDot / Chip
  title: string
  detail: string
  tag: string
  triggeredAt: string // ISO
}

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  absolute_threshold: 'Threshold',
  wow_change: 'Week-over-week change',
  budget_pacing: 'Budget pacing',
  missing_data: 'Missing data',
}

export const TIER_LABEL: Record<Tier, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
}

export const METRIC_LABEL: Record<MetricKey, string> = {
  cpl: 'Cost per lead',
  leads: 'Leads',
  spend: 'Ad spend',
  responseMins: 'LSA response time',
  budgetPct: 'Budget pacing',
  visibility: 'Search visibility',
  rating: 'Google rating',
}

const METRIC_UNIT: Record<MetricKey, string> = {
  cpl: '$', leads: '', spend: '$', responseMins: ' min', budgetPct: '%', visibility: '%', rating: '★',
}

/** Visual severity bucket (reuses the existing three-tone system). */
export function tierToSeverity(tier: Tier): Severity {
  if (tier === 'critical' || tier === 'high') return 'serious'
  if (tier === 'medium') return 'warning'
  return 'info'
}

function tierTag(tier: Tier, ruleType: RuleType): string {
  if (ruleType === 'missing_data') return 'Action'
  if (tier === 'critical' || tier === 'high') return 'At risk'
  if (tier === 'medium') return 'Watch'
  return 'Info'
}

// ── metric access ───────────────────────────────────────────────────────────

export function metricValue(a: Account, key: MetricKey): number {
  const m = metricsFor(a, '30d')
  switch (key) {
    case 'cpl': return m.cpl
    case 'leads': return m.leads
    case 'spend': return m.spend
    case 'responseMins': return a.lsa.responseMins
    case 'budgetPct': return pacing(a).pct
    case 'visibility': return a.semrush.visibility
    case 'rating': return a.gbp.rating
  }
}

function metricDelta(a: Account, key: MetricKey): number {
  const m = metricsFor(a, '30d')
  switch (key) {
    case 'cpl': return m.cplDelta
    case 'leads': return m.leadsDelta
    case 'spend': return m.spendDelta
    case 'visibility': return a.semrush.visibilityDelta
    default: return 0
  }
}

export function formatMetric(key: MetricKey, v: number): string {
  const unit = METRIC_UNIT[key]
  if (unit === '$') return money2(v)
  if (unit === '%') return v.toFixed(1) + '%'
  if (unit === ' min') return v.toFixed(1) + ' min'
  if (unit === '★') return v.toFixed(1) + '★'
  return Math.round(v).toLocaleString('en-US')
}

// ── evaluation ──────────────────────────────────────────────────────────────

function alertBase(a: Account, rule: AlertRule, tier: Tier, suffix = ''): Omit<AlertInstance, 'title' | 'detail'> {
  return {
    id: `${a.id}:${rule.id}${suffix ? ':' + suffix : ''}`,
    ruleId: rule.id,
    ruleType: rule.ruleType,
    accountId: a.id,
    accountName: a.name,
    tier,
    severity: tierToSeverity(tier),
    tag: tierTag(tier, rule.ruleType),
    triggeredAt: new Date(Date.now() - a.lastSyncedMin * 60_000).toISOString(),
  }
}

/** All alerts a single rule raises for a single account (0, 1, or many). */
function evalRule(a: Account, rule: AlertRule): AlertInstance[] {
  const c = rule.config

  if (rule.ruleType === 'missing_data') {
    return PLATFORMS.filter((p) => a.sources[p.id] === 'attention').map((p) => ({
      ...alertBase(a, rule, rule.severity, p.id),
      title: `${p.name} disconnected`,
      detail: 'Token expired, reauthorize to resume sync',
    }))
  }

  if (rule.ruleType === 'budget_pacing') {
    const p = pacing(a)
    const warn = c.warn ?? 100
    const critical = c.critical ?? 112
    if (p.pct <= warn) return []
    const tier: Tier = p.pct > critical ? 'high' : 'medium'
    return [{
      ...alertBase(a, rule, tier),
      title: `Spend at ${p.pct}% of monthly budget`,
      detail: `${money(p.mtd)} of ${money(p.budget)} with 9 days left in the month`,
    }]
  }

  if (rule.ruleType === 'wow_change') {
    const metric = c.metric ?? 'cpl'
    const delta = metricDelta(a, metric)
    const changePct = c.changePct ?? 5
    const dir = c.direction ?? 'up'
    const breached = dir === 'up' ? delta > changePct : delta < -changePct
    if (!breached) return []
    return [{
      ...alertBase(a, rule, rule.severity),
      title: `${METRIC_LABEL[metric]} ${dir} ${Math.abs(delta).toFixed(1)}% month over month`,
      detail: `Now ${formatMetric(metric, metricValue(a, metric))}, past the ${changePct}% guardrail`,
    }]
  }

  // absolute_threshold
  const metric = c.metric ?? 'cpl'
  const op = c.operator ?? 'gt'
  const threshold = c.threshold ?? 0
  const v = metricValue(a, metric)
  const breached = op === 'gt' ? v > threshold : v < threshold
  if (!breached) return []
  if (metric === 'responseMins') {
    const target = c.target ?? 5
    return [{
      ...alertBase(a, rule, rule.severity),
      title: `LSA response time ${v.toFixed(1)} min, above ${target} min target`,
      detail: 'Slow responses lower lead ranking on Local Services Ads',
    }]
  }
  return [{
    ...alertBase(a, rule, rule.severity),
    title: `${METRIC_LABEL[metric]} ${op === 'gt' ? 'over' : 'under'} ${formatMetric(metric, threshold)}`,
    detail: `Now ${formatMetric(metric, v)}`,
  }]
}

const SEV_RANK: Record<Severity, number> = { serious: 0, warning: 1, info: 2 }

/** Evaluate every rule in scope against one account. */
export function evaluate(a: Account, rules: AlertRule[]): AlertInstance[] {
  return rules
    .filter((r) => r.active && (r.scope === 'all' || r.scope === a.id))
    .flatMap((r) => evalRule(a, r))
}

/** Evaluate across a roster, most severe first. */
export function evaluateAll(accounts: Account[], rules: AlertRule[]): AlertInstance[] {
  return accounts.flatMap((a) => evaluate(a, rules)).sort((x, y) => SEV_RANK[x.severity] - SEV_RANK[y.severity])
}

/** Human sentence describing what a rule watches — used in the manager list. */
export function describeRule(rule: AlertRule): string {
  const c = rule.config
  const scope = rule.scope === 'all' ? 'every client' : (getAccount(rule.scope)?.name ?? 'one client')
  switch (rule.ruleType) {
    case 'missing_data':
      return `Any connected platform stops syncing, on ${scope}`
    case 'budget_pacing':
      return `Spend passes ${c.warn ?? 100}% of budget (escalates past ${c.critical ?? 112}%), on ${scope}`
    case 'wow_change':
      return `${METRIC_LABEL[c.metric ?? 'cpl']} moves ${c.direction ?? 'up'} more than ${c.changePct ?? 5}% week over week, on ${scope}`
    default:
      return `${METRIC_LABEL[c.metric ?? 'cpl']} ${c.operator === 'lt' ? 'drops under' : 'goes over'} ${formatMetric(c.metric ?? 'cpl', c.threshold ?? 0)}, on ${scope}`
  }
}

/** Seed rules that reproduce the demo's original alert thresholds. */
export function defaultRules(): AlertRule[] {
  const at = '2026-01-01T00:00:00.000Z'
  return [
    { id: 'rule-lsa-response', name: 'LSA response time', scope: 'all', ruleType: 'absolute_threshold', config: { metric: 'responseMins', operator: 'gt', threshold: 10, target: 5 }, severity: 'critical', active: true, createdAt: at },
    { id: 'rule-budget-pacing', name: 'Budget pacing', scope: 'all', ruleType: 'budget_pacing', config: { warn: 100, critical: 112 }, severity: 'medium', active: true, createdAt: at },
    { id: 'rule-cpl-wow', name: 'Cost per lead spike', scope: 'all', ruleType: 'wow_change', config: { metric: 'cpl', direction: 'up', changePct: 5 }, severity: 'medium', active: true, createdAt: at },
    { id: 'rule-missing-data', name: 'Platform disconnected', scope: 'all', ruleType: 'missing_data', config: {}, severity: 'medium', active: true, createdAt: at },
  ]
}

export function newRuleId(): string {
  return 'rule-' + Date.now().toString(36)
}

export const RULE_TYPES: RuleType[] = ['absolute_threshold', 'wow_change', 'budget_pacing', 'missing_data']
export const TIERS: Tier[] = ['critical', 'high', 'medium', 'low']
export const THRESHOLD_METRICS: MetricKey[] = ['cpl', 'responseMins', 'budgetPct', 'visibility', 'rating']
export const WOW_METRICS: MetricKey[] = ['cpl', 'leads', 'spend', 'visibility']

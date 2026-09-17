/**
 * Mock data for ReportBeacon, an internal account-reporting console.
 *
 * No backend and no live integrations. Each account carries 60 days of daily
 * leads and spend so the range controls (7d / 30d / month-to-date) and the
 * period-over-period deltas are computed for real, not hardcoded. Health and
 * alerts are derived from the same numbers, so the "needs attention" list and
 * the health flags always agree with what the tables show.
 */
import { money, money2, num } from './format'

// ---------------------------------------------------------------------------
// Roles (internal only)
// ---------------------------------------------------------------------------

export type RoleId = 'owner' | 'manager' | 'viewer'

export interface Role {
  id: RoleId
  label: string
  /** Sees agency economics: retainer, margin. */
  seesEconomics: boolean
  /** Can change things — import, assign, schedule, resolve. Viewers cannot. */
  canWrite: boolean
}

export const ROLES: Role[] = [
  { id: 'owner', label: 'Owner', seesEconomics: true, canWrite: true },
  { id: 'manager', label: 'Account manager', seesEconomics: false, canWrite: true },
  { id: 'viewer', label: 'Viewer', seesEconomics: false, canWrite: false },
]

export const ROLE_LABEL: Record<RoleId, string> = {
  owner: 'Agency owner', manager: 'Account manager', viewer: 'Viewer',
}

// ---------------------------------------------------------------------------
// Seats (mock auth). An owner sees the whole agency; each manager sees only
// the accounts assigned to them. No passwords — this is a demo.
// ---------------------------------------------------------------------------

export interface Seat {
  id: string
  name: string
  initials: string
  role: RoleId
  title: string
  /** Account ids this seat manages. Owner is assigned all, implicitly. */
  accountIds: string[]
}

export const SEATS: Seat[] = [
  { id: 'owner', name: 'Tinashe Benson', initials: 'TB', role: 'owner', title: 'Agency owner', accountIds: [] },
  { id: 'dana', name: 'Dana Okafor', initials: 'DO', role: 'manager', title: 'Account manager', accountIds: ['brightside-dental', 'redline-auto'] },
  { id: 'marcus', name: 'Marcus Reyes', initials: 'MR', role: 'manager', title: 'Account manager', accountIds: ['harbor-vine-law', 'verde-medspa'] },
  { id: 'priya', name: 'Priya Shah', initials: 'PS', role: 'viewer', title: 'Viewer · read-only', accountIds: [] },
]

export function getSeat(id: string): Seat | undefined {
  return SEATS.find((s) => s.id === id)
}

// Ownership, scoping and the live roster are dynamic and live in the workspace
// store (src/context/workspace.tsx), which seeds itself from SEATS' accountIds
// and the imported catalog below.

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------

export type PlatformId = 'lsa' | 'googleAds' | 'gbp' | 'meta' | 'semrush'
export type SourceStatus = 'live' | 'syncing' | 'attention'

export interface PlatformMeta {
  id: PlatformId
  name: string
  short: string
}

export const PLATFORMS: PlatformMeta[] = [
  { id: 'lsa', name: 'Local Services Ads', short: 'LSA' },
  { id: 'googleAds', name: 'Google Ads', short: 'Google Ads' },
  { id: 'gbp', name: 'Google Business Profile', short: 'GBP' },
  { id: 'meta', name: 'Meta Ads', short: 'Meta' },
  { id: 'semrush', name: 'SEMrush', short: 'SEMrush' },
]

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

export type RangeId = '7d' | '30d' | 'mtd'
export const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: 'mtd', label: 'MTD', days: 21 },
]

// ---------------------------------------------------------------------------
// Seeded generation
// ---------------------------------------------------------------------------

function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

const DAYS = 60

/** Daily series of length 60 whose last-30 sum ≈ `monthlyTotal` and whose
 *  30-day-over-prior-30 change ≈ `deltaFrac` (e.g. 0.12 for +12%). */
function series(seed: number, monthlyTotal: number, deltaFrac: number): number[] {
  const k = deltaFrac / (30 - 14.5 * deltaFrac)
  const base = monthlyTotal / (30 + 1335 * k)
  const rnd = rng(seed)
  const out: number[] = []
  for (let day = 0; day < DAYS; day++) {
    const trend = base * (1 + k * day)
    const noise = 1 + (rnd() - 0.5) * 0.28
    out.push(Math.max(0, trend * noise))
  }
  return out
}

function short(seed: number, base: number, spread: number, slope = 0): number[] {
  const rnd = rng(seed)
  const out: number[] = []
  let v = base
  for (let i = 0; i < 8; i++) {
    v += (rnd() - 0.5) * spread + slope
    out.push(Math.max(0, Math.round(v * 10) / 10))
  }
  return out
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeywordMove {
  term: string
  from: number
  to: number
}

export interface Account {
  id: string
  name: string
  trade: 'Dental' | 'Med spa' | 'Legal' | 'Auto repair' | 'Veterinary' | 'Real estate'
  location: string
  mark: string
  color: string
  logo?: string | null
  budget: number
  retainer: number
  lastSyncedMin: number

  leadsDaily: number[]
  spendDaily: number[]

  sources: Record<PlatformId, SourceStatus>

  lsa: { leads: number; cpl: number; guaranteed: boolean; responseMins: number; series: number[] }
  googleAds: { spend: number; clicks: number; conversions: number; costPerConv: number; series: number[] }
  gbp: { rating: number; ratingPrev: number; reviews: number; reviewDelta: number; views: number; directions: number; series: number[] }
  meta: { spend: number; results: number; costPerResult: number; reach: number; series: number[] }
  semrush: { keywords: number; visibility: number; visibilityDelta: number; series: number[]; gaining: KeywordMove[]; losing: KeywordMove[] }
}

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

export const ACCOUNTS: Account[] = [
  {
    id: 'brightside-dental',
    name: 'Brightside Dental',
    trade: 'Dental',
    location: 'Phoenix, AZ',
    mark: 'BD',
    color: '#2a78d6',
    budget: 15000,
    retainer: 3200,
    lastSyncedMin: 4,
    leadsDaily: series(11, 342, 0.124),
    spendDaily: series(12, 14086, 0.051),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'live' },
    lsa: { leads: 148, cpl: 32.4, guaranteed: true, responseMins: 3.2, series: short(13, 33, 6, 0.6) },
    googleAds: { spend: 8420, clicks: 2914, conversions: 121, costPerConv: 69.6, series: short(14, 26, 5, 0.5) },
    gbp: { rating: 4.8, ratingPrev: 4.7, reviews: 612, reviewDelta: 23, views: 18240, directions: 486, series: short(15, 4.6, 0.08, 0.02) },
    meta: { spend: 3240, results: 73, costPerResult: 44.4, reach: 41200, series: short(16, 16, 4, 0.4) },
    semrush: {
      keywords: 214, visibility: 38.6, visibilityDelta: 4.1, series: short(17, 31, 2.2, 1.0),
      gaining: [
        { term: 'invisalign phoenix', from: 14, to: 4 },
        { term: 'emergency dentist near me', from: 9, to: 3 },
        { term: 'dental implants cost az', from: 22, to: 12 },
      ],
      losing: [
        { term: 'teeth whitening phoenix', from: 6, to: 11 },
        { term: 'pediatric dentist near me', from: 8, to: 13 },
      ],
    },
  },
  {
    id: 'verde-medspa',
    name: 'Verde Med Spa',
    trade: 'Med spa',
    location: 'Orlando, FL',
    mark: 'VM',
    color: '#1baf7a',
    budget: 7800,
    retainer: 2100,
    lastSyncedMin: 7,
    leadsDaily: series(41, 268, 0.079),
    spendDaily: series(42, 7488, 0.044),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'live' },
    lsa: { leads: 132, cpl: 21.8, guaranteed: true, responseMins: 2.4, series: short(43, 30, 5, 0.4) },
    googleAds: { spend: 4020, clicks: 2361, conversions: 96, costPerConv: 41.9, series: short(44, 21, 4, 0.5) },
    gbp: { rating: 4.7, ratingPrev: 4.6, reviews: 489, reviewDelta: 31, views: 14720, directions: 302, series: short(45, 4.6, 0.05, 0.01) },
    meta: { spend: 1980, results: 58, costPerResult: 34.1, reach: 33600, series: short(46, 13, 3, 0.3) },
    semrush: {
      keywords: 178, visibility: 34.2, visibilityDelta: 2.3, series: short(47, 30, 2.0, 0.6),
      gaining: [
        { term: 'botox orlando', from: 11, to: 4 },
        { term: 'laser hair removal near me', from: 16, to: 8 },
      ],
      losing: [
        { term: 'chemical peel orlando', from: 6, to: 10 },
        { term: 'coolsculpting near me', from: 7, to: 12 },
      ],
    },
  },
  {
    id: 'harbor-vine-law',
    name: 'Harbor & Vine Law',
    trade: 'Legal',
    location: 'Austin, TX',
    mark: 'HV',
    color: '#eb6834',
    budget: 6000,
    retainer: 1750,
    lastSyncedMin: 12,
    leadsDaily: series(21, 129, -0.038),
    spendDaily: series(22, 6390, -0.022),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'attention', semrush: 'live' },
    lsa: { leads: 61, cpl: 46.9, guaranteed: true, responseMins: 6.8, series: short(23, 15, 4, -0.2) },
    googleAds: { spend: 3980, clicks: 1247, conversions: 44, costPerConv: 90.5, series: short(24, 11, 3, -0.3) },
    gbp: { rating: 4.5, ratingPrev: 4.5, reviews: 208, reviewDelta: 6, views: 7420, directions: 173, series: short(25, 4.5, 0.06, 0.0) },
    meta: { spend: 1160, results: 19, costPerResult: 61.1, reach: 14800, series: short(26, 5, 2.4, -0.2) },
    semrush: {
      keywords: 96, visibility: 21.3, visibilityDelta: -1.6, series: short(27, 24, 1.8, -0.5),
      gaining: [
        { term: 'car accident lawyer austin', from: 19, to: 9 },
        { term: 'personal injury attorney', from: 15, to: 8 },
      ],
      losing: [
        { term: 'slip and fall lawyer austin', from: 4, to: 9 },
        { term: 'workers comp attorney', from: 7, to: 14 },
        { term: 'motorcycle accident lawyer', from: 5, to: 10 },
      ],
    },
  },
  {
    id: 'redline-auto',
    name: 'Redline Auto Care',
    trade: 'Auto repair',
    location: 'Denver, CO',
    mark: 'RA',
    color: '#7a5af0',
    budget: 6800,
    retainer: 2600,
    lastSyncedMin: 63,
    leadsDaily: series(31, 87, 0.312),
    spendDaily: series(32, 9780, 0.186),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'syncing' },
    lsa: { leads: 24, cpl: 128.6, guaranteed: false, responseMins: 11.4, series: short(33, 5, 2, 0.3) },
    googleAds: { spend: 6820, clicks: 1583, conversions: 38, costPerConv: 179.5, series: short(34, 8, 3, 0.6) },
    gbp: { rating: 4.9, ratingPrev: 4.8, reviews: 341, reviewDelta: 18, views: 11960, directions: 214, series: short(35, 4.7, 0.05, 0.03) },
    meta: { spend: 2960, results: 31, costPerResult: 95.5, reach: 28400, series: short(36, 6, 2.6, 0.5) },
    semrush: {
      keywords: 143, visibility: 29.8, visibilityDelta: 6.7, series: short(37, 21, 2.4, 1.4),
      gaining: [
        { term: 'brake repair denver', from: 17, to: 5 },
        { term: 'transmission repair colorado', from: 24, to: 11 },
        { term: 'check engine light diagnostic', from: 12, to: 6 },
      ],
      losing: [{ term: 'oil change near me denver', from: 9, to: 15 }],
    },
  },
]

/**
 * Additional client accounts that exist in the connected platforms but have
 * not been imported into the workspace yet. Connecting a source in the demo
 * "discovers" these so they can be imported and assigned.
 */
export const IMPORTABLE: Account[] = [
  {
    id: 'lakeside-vet',
    name: 'Lakeside Veterinary',
    trade: 'Veterinary',
    location: 'Seattle, WA',
    mark: 'LV',
    color: '#0e9e8f',
    budget: 5200,
    retainer: 1600,
    lastSyncedMin: 2,
    leadsDaily: series(51, 176, 0.061),
    spendDaily: series(52, 4980, 0.03),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'live' },
    lsa: { leads: 88, cpl: 24.6, guaranteed: true, responseMins: 3.6, series: short(53, 20, 4, 0.3) },
    googleAds: { spend: 2760, clicks: 1420, conversions: 61, costPerConv: 45.2, series: short(54, 14, 3, 0.3) },
    gbp: { rating: 4.8, ratingPrev: 4.7, reviews: 356, reviewDelta: 19, views: 9800, directions: 221, series: short(55, 4.6, 0.05, 0.02) },
    meta: { spend: 1220, results: 41, costPerResult: 29.8, reach: 22400, series: short(56, 9, 2.5, 0.2) },
    semrush: {
      keywords: 118, visibility: 31.4, visibilityDelta: 2.9, series: short(57, 27, 2, 0.7),
      gaining: [{ term: 'emergency vet seattle', from: 13, to: 5 }, { term: 'cat dental cleaning', from: 18, to: 9 }],
      losing: [{ term: 'dog vaccinations near me', from: 7, to: 11 }],
    },
  },
  {
    id: 'summit-realty',
    name: 'Summit Realty Group',
    trade: 'Real estate',
    location: 'Nashville, TN',
    mark: 'SR',
    color: '#c2410c',
    budget: 9400,
    retainer: 2400,
    lastSyncedMin: 5,
    leadsDaily: series(61, 214, 0.144),
    spendDaily: series(62, 8600, 0.09),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'syncing' },
    lsa: { leads: 64, cpl: 58.2, guaranteed: false, responseMins: 4.4, series: short(63, 13, 4, 0.4) },
    googleAds: { spend: 5100, clicks: 1880, conversions: 78, costPerConv: 65.4, series: short(64, 17, 4, 0.5) },
    gbp: { rating: 4.6, ratingPrev: 4.6, reviews: 274, reviewDelta: 12, views: 12600, directions: 188, series: short(65, 4.5, 0.05, 0.01) },
    meta: { spend: 2010, results: 52, costPerResult: 38.7, reach: 31200, series: short(66, 11, 3, 0.4) },
    semrush: {
      keywords: 162, visibility: 27.1, visibilityDelta: 5.2, series: short(67, 20, 2.3, 1.1),
      gaining: [{ term: 'homes for sale nashville', from: 16, to: 6 }, { term: 'realtor near me', from: 21, to: 10 }],
      losing: [{ term: 'condos downtown nashville', from: 8, to: 13 }],
    },
  },
]

/** Every client account known across connected platforms. */
export const CATALOG: Account[] = [...ACCOUNTS, ...IMPORTABLE]

export function getAccount(id: string): Account | undefined {
  return CATALOG.find((a) => a.id === id)
}

// ---------------------------------------------------------------------------
// Client synthesis — build a full Account from the handful of fields an owner
// edits in the Client Editor. The deterministic generators above give every
// new client a believable 60-day history and per-channel breakdown, so the
// charts, health and reports work exactly like the seeded roster.
// ---------------------------------------------------------------------------

export interface NewClientInput {
  id?: string
  name: string
  trade: Account['trade']
  location: string
  color: string
  mark: string
  budget: number
  retainer: number
  monthlyLeads: number
  rating: number
  logo?: string | null
}

export const TRADES: Account['trade'][] = ['Dental', 'Med spa', 'Legal', 'Auto repair', 'Veterinary', 'Real estate']

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'client-' + Date.now().toString(36)
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

export function makeAccount(input: NewClientInput): Account {
  const id = input.id || slugify(input.name)
  const seed = hashSeed(id)
  const leads = Math.max(1, Math.round(input.monthlyLeads))
  const spend = Math.max(1, Math.round(input.budget))
  const rating = Math.min(5, Math.max(0, input.rating))
  const cpl = spend / leads
  // Distribute leads/spend across channels with believable weights.
  const lsaLeads = Math.round(leads * 0.33)
  const gAdsConv = Math.round(leads * 0.42)
  const metaRes = Math.max(0, leads - lsaLeads - gAdsConv)
  const gAdsSpend = Math.round(spend * 0.5)
  const metaSpend = Math.round(spend * 0.22)
  const kw = 90 + (seed % 140)
  return {
    id, name: input.name, trade: input.trade, location: input.location,
    mark: input.mark.slice(0, 2).toUpperCase() || input.name.slice(0, 2).toUpperCase(),
    color: input.color, logo: input.logo ?? null, budget: spend, retainer: Math.max(0, Math.round(input.retainer)), lastSyncedMin: 3,
    leadsDaily: series(seed, leads, 0.06), spendDaily: series(seed + 7, spend, 0.03),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'live' },
    lsa: { leads: lsaLeads, cpl: +(cpl * 0.7).toFixed(1), guaranteed: true, responseMins: +(2 + (seed % 5)).toFixed(1), series: short(seed + 1, 30, 5, 0.4) },
    googleAds: { spend: gAdsSpend, clicks: gAdsConv * 24, conversions: gAdsConv, costPerConv: gAdsConv ? +(gAdsSpend / gAdsConv).toFixed(1) : 0, series: short(seed + 2, 22, 4, 0.4) },
    gbp: { rating: +rating.toFixed(1), ratingPrev: +Math.max(0, rating - 0.1).toFixed(1), reviews: 120 + (seed % 500), reviewDelta: 6 + (seed % 24), views: 6000 + (seed % 14000), directions: 120 + (seed % 380), series: short(seed + 3, rating || 4.5, 0.06, 0.02) },
    meta: { spend: metaSpend, results: metaRes, costPerResult: metaRes ? +(metaSpend / metaRes).toFixed(1) : 0, reach: 12000 + (seed % 32000), series: short(seed + 4, 12, 3, 0.3) },
    semrush: {
      keywords: kw, visibility: +(20 + (seed % 22)).toFixed(1), visibilityDelta: +(((seed % 90) / 10) - 4).toFixed(1), series: short(seed + 5, 24, 2.2, 0.7),
      gaining: [{ term: `${input.trade.toLowerCase()} ${input.location.split(',')[0].toLowerCase()}`, from: 14, to: 5 }, { term: `best ${input.trade.toLowerCase()} near me`, from: 18, to: 9 }],
      losing: [{ term: `cheap ${input.trade.toLowerCase()}`, from: 7, to: 12 }],
    },
  }
}


// ---------------------------------------------------------------------------
// Derived metrics
// ---------------------------------------------------------------------------

function sum(a: number[]): number {
  return a.reduce((x, y) => x + y, 0)
}

export interface RangeMetrics {
  leads: number
  leadsDelta: number
  spend: number
  spendDelta: number
  cpl: number
  cplDelta: number
}

function windowSum(daily: number[], days: number, back = 0): number {
  const end = daily.length - back * days
  return sum(daily.slice(end - days, end))
}

function pctChange(cur: number, prev: number): number {
  if (prev <= 0) return 0
  return ((cur - prev) / prev) * 100
}

export function metricsFor(a: Account, range: RangeId): RangeMetrics {
  const days = RANGES.find((r) => r.id === range)!.days
  const leads = windowSum(a.leadsDaily, days, 0)
  const leadsPrev = windowSum(a.leadsDaily, days, 1)
  const spend = windowSum(a.spendDaily, days, 0)
  const spendPrev = windowSum(a.spendDaily, days, 1)
  const cpl = leads > 0 ? spend / leads : 0
  const cplPrev = leadsPrev > 0 ? spendPrev / leadsPrev : 0
  return {
    leads: Math.round(leads),
    leadsDelta: pctChange(leads, leadsPrev),
    spend: Math.round(spend),
    spendDelta: pctChange(spend, spendPrev),
    cpl,
    cplDelta: pctChange(cpl, cplPrev),
  }
}

/** Month-to-date spend against monthly budget. */
export function pacing(a: Account): { mtd: number; budget: number; pct: number } {
  const mtd = windowSum(a.spendDaily, 21, 0)
  return { mtd: Math.round(mtd), budget: a.budget, pct: a.budget > 0 ? Math.round((mtd / a.budget) * 100) : 0 }
}

// ---------------------------------------------------------------------------
// Health + alerts
// ---------------------------------------------------------------------------

export type Health = 'good' | 'watch' | 'risk'
export const HEALTH_LABEL: Record<Health, string> = { good: 'Healthy', watch: 'Watch', risk: 'At risk' }

export function health(a: Account): Health {
  const m = metricsFor(a, '30d')
  const p = pacing(a)
  const anyDown = Object.values(a.sources).includes('attention')
  if (a.lsa.responseMins > 10 || p.pct > 112 || m.cplDelta > 12) return 'risk'
  if (m.cplDelta > 5 || p.pct > 102 || m.leadsDelta < -3 || anyDown || Object.values(a.sources).includes('syncing'))
    return 'watch'
  return 'good'
}

// ---------------------------------------------------------------------------
// Per-service health — a health status, one-line summary and headline metric
// for each connected platform, so the account view reads service by service.
// ---------------------------------------------------------------------------

export interface ServiceHealth {
  id: PlatformId
  name: string
  short: string
  status: Health
  connection: SourceStatus
  label: string
  summary: string
  keyMetric: string
}

export function serviceHealthFor(a: Account): ServiceHealth[] {
  return PLATFORMS.map((p) => {
    const src = a.sources[p.id]
    // Connection issues dominate; otherwise the service's own signal sets health.
    let status: Health = src === 'attention' ? 'risk' : src === 'syncing' ? 'watch' : 'good'
    let summary = ''
    let keyMetric = ''
    switch (p.id) {
      case 'lsa': {
        const s = a.lsa
        if (status === 'good' && s.responseMins > 10) status = 'risk'
        else if (status === 'good' && s.responseMins > 5) status = 'watch'
        keyMetric = `${money2(s.cpl)} / lead`
        summary = `${num(s.leads)} leads · ${s.responseMins.toFixed(1)} min response`
        break
      }
      case 'googleAds': {
        const s = a.googleAds
        keyMetric = `${money2(s.costPerConv)} / conv`
        summary = `${num(s.conversions)} conversions · ${money(s.spend)} spend`
        break
      }
      case 'gbp': {
        const s = a.gbp
        if (status === 'good' && s.rating < 4) status = 'watch'
        keyMetric = `${s.rating.toFixed(1)} ★`
        summary = `${num(s.reviews)} reviews · +${s.reviewDelta} this period`
        break
      }
      case 'meta': {
        const s = a.meta
        keyMetric = `${money2(s.costPerResult)} / result`
        summary = `${num(s.results)} results · ${money(s.spend)} spend`
        break
      }
      case 'semrush': {
        const s = a.semrush
        if (status === 'good' && s.visibilityDelta < 0) status = 'watch'
        keyMetric = `${s.visibility.toFixed(1)}% vis`
        summary = `${num(s.keywords)} keywords · ${s.visibilityDelta >= 0 ? '+' : ''}${s.visibilityDelta.toFixed(1)}%`
        break
      }
    }
    const label = src === 'attention' ? 'Reconnect' : src === 'syncing' ? 'Syncing' : HEALTH_LABEL[status]
    return { id: p.id, name: p.name, short: p.short, status, connection: src, label, summary, keyMetric }
  })
}

export type Severity = 'serious' | 'warning' | 'info'

export interface Alert {
  id: string
  accountId: string
  accountName: string
  severity: Severity
  title: string
  detail: string
  tag: string
}

export function alertsFor(a: Account): Alert[] {
  const out: Alert[] = []
  const m = metricsFor(a, '30d')
  const p = pacing(a)

  if (a.lsa.responseMins > 10) {
    out.push({
      id: a.id + '-resp', accountId: a.id, accountName: a.name, severity: 'serious',
      title: `LSA response time ${a.lsa.responseMins.toFixed(1)} min, above 5 min target`,
      detail: 'Slow responses lower lead ranking on Local Services Ads', tag: 'At risk',
    })
  }
  if (p.pct > 100) {
    out.push({
      id: a.id + '-pace', accountId: a.id, accountName: a.name, severity: p.pct > 112 ? 'serious' : 'warning',
      title: `Spend at ${p.pct}% of monthly budget`,
      detail: `$${p.mtd.toLocaleString()} of $${a.budget.toLocaleString()} with 9 days left in the month`, tag: 'Watch',
    })
  }
  if (m.cplDelta > 5) {
    out.push({
      id: a.id + '-cpl', accountId: a.id, accountName: a.name, severity: 'warning',
      title: `Cost per lead up ${m.cplDelta.toFixed(1)}% month over month`,
      detail: `${'$' + m.cpl.toFixed(2)}, driven by Google Ads search terms`, tag: 'Watch',
    })
  }
  for (const p2 of PLATFORMS) {
    if (a.sources[p2.id] === 'attention') {
      out.push({
        id: a.id + '-' + p2.id, accountId: a.id, accountName: a.name, severity: 'warning',
        title: `${p2.name} disconnected`,
        detail: 'Token expired 2 days ago, reauthorize to resume sync', tag: 'Action',
      })
    }
  }
  return out
}

const SEV_RANK: Record<Severity, number> = { serious: 0, warning: 1, info: 2 }

export function allAlerts(accounts: Account[] = ACCOUNTS): Alert[] {
  return accounts.flatMap(alertsFor).sort((x, y) => SEV_RANK[x.severity] - SEV_RANK[y.severity])
}

// ---------------------------------------------------------------------------
// Portfolio totals
// ---------------------------------------------------------------------------

export function portfolioTotals(range: RangeId, accounts: Account[] = ACCOUNTS) {
  let leads = 0, leadsPrev = 0, spend = 0, spendPrev = 0, managed = 0
  const days = RANGES.find((r) => r.id === range)!.days
  for (const a of accounts) {
    leads += windowSum(a.leadsDaily, days, 0)
    leadsPrev += windowSum(a.leadsDaily, days, 1)
    spend += windowSum(a.spendDaily, days, 0)
    spendPrev += windowSum(a.spendDaily, days, 1)
    managed += windowSum(a.spendDaily, 30, 0)
  }
  const cpl = leads > 0 ? spend / leads : 0
  const cplPrev = leadsPrev > 0 ? spendPrev / leadsPrev : 0
  return {
    accounts: accounts.length,
    leads: Math.round(leads),
    leadsDelta: pctChange(leads, leadsPrev),
    spend: Math.round(spend),
    spendDelta: pctChange(spend, spendPrev),
    managed: Math.round(managed),
    cpl,
    cplDelta: pctChange(cpl, cplPrev),
    openAlerts: allAlerts(accounts).length,
    atRisk: accounts.filter((a) => health(a) === 'risk').length,
    watch: accounts.filter((a) => health(a) === 'watch').length,
  }
}

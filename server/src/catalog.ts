/**
 * Seed catalog — the demo client roster, generated server-side so the roster
 * genuinely lives in Postgres. This mirrors the frontend's src/lib/data.ts
 * generators so a seeded Account is byte-for-byte what the Performance face
 * expects to render (60-day daily series, per-platform breakdowns, keyword moves).
 */

function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

const DAYS = 60

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

export interface SeedClient {
  id: string
  importable: boolean
  data: Record<string, unknown>
}

const ACCOUNTS = [
  {
    id: 'brightside-dental', name: 'Brightside Dental', trade: 'Dental', location: 'Phoenix, AZ',
    mark: 'BD', color: '#2a78d6', budget: 15000, retainer: 3200, lastSyncedMin: 4,
    leadsDaily: series(11, 342, 0.124), spendDaily: series(12, 14086, 0.051),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'live' },
    lsa: { leads: 148, cpl: 32.4, guaranteed: true, responseMins: 3.2, series: short(13, 33, 6, 0.6) },
    googleAds: { spend: 8420, clicks: 2914, conversions: 121, costPerConv: 69.6, series: short(14, 26, 5, 0.5) },
    gbp: { rating: 4.8, ratingPrev: 4.7, reviews: 612, reviewDelta: 23, views: 18240, directions: 486, series: short(15, 4.6, 0.08, 0.02) },
    meta: { spend: 3240, results: 73, costPerResult: 44.4, reach: 41200, series: short(16, 16, 4, 0.4) },
    semrush: {
      keywords: 214, visibility: 38.6, visibilityDelta: 4.1, series: short(17, 31, 2.2, 1.0),
      gaining: [{ term: 'invisalign phoenix', from: 14, to: 4 }, { term: 'emergency dentist near me', from: 9, to: 3 }, { term: 'dental implants cost az', from: 22, to: 12 }],
      losing: [{ term: 'teeth whitening phoenix', from: 6, to: 11 }, { term: 'pediatric dentist near me', from: 8, to: 13 }],
    },
  },
  {
    id: 'verde-medspa', name: 'Verde Med Spa', trade: 'Med spa', location: 'Orlando, FL',
    mark: 'VM', color: '#1baf7a', budget: 7800, retainer: 2100, lastSyncedMin: 7,
    leadsDaily: series(41, 268, 0.079), spendDaily: series(42, 7488, 0.044),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'live' },
    lsa: { leads: 132, cpl: 21.8, guaranteed: true, responseMins: 2.4, series: short(43, 30, 5, 0.4) },
    googleAds: { spend: 4020, clicks: 2361, conversions: 96, costPerConv: 41.9, series: short(44, 21, 4, 0.5) },
    gbp: { rating: 4.7, ratingPrev: 4.6, reviews: 489, reviewDelta: 31, views: 14720, directions: 302, series: short(45, 4.6, 0.05, 0.01) },
    meta: { spend: 1980, results: 58, costPerResult: 34.1, reach: 33600, series: short(46, 13, 3, 0.3) },
    semrush: {
      keywords: 178, visibility: 34.2, visibilityDelta: 2.3, series: short(47, 30, 2.0, 0.6),
      gaining: [{ term: 'botox orlando', from: 11, to: 4 }, { term: 'laser hair removal near me', from: 16, to: 8 }],
      losing: [{ term: 'chemical peel orlando', from: 6, to: 10 }, { term: 'coolsculpting near me', from: 7, to: 12 }],
    },
  },
  {
    id: 'harbor-vine-law', name: 'Harbor & Vine Law', trade: 'Legal', location: 'Austin, TX',
    mark: 'HV', color: '#eb6834', budget: 6000, retainer: 1750, lastSyncedMin: 12,
    leadsDaily: series(21, 129, -0.038), spendDaily: series(22, 6390, -0.022),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'attention', semrush: 'live' },
    lsa: { leads: 61, cpl: 46.9, guaranteed: true, responseMins: 6.8, series: short(23, 15, 4, -0.2) },
    googleAds: { spend: 3980, clicks: 1247, conversions: 44, costPerConv: 90.5, series: short(24, 11, 3, -0.3) },
    gbp: { rating: 4.5, ratingPrev: 4.5, reviews: 208, reviewDelta: 6, views: 7420, directions: 173, series: short(25, 4.5, 0.06, 0.0) },
    meta: { spend: 1160, results: 19, costPerResult: 61.1, reach: 14800, series: short(26, 5, 2.4, -0.2) },
    semrush: {
      keywords: 96, visibility: 21.3, visibilityDelta: -1.6, series: short(27, 24, 1.8, -0.5),
      gaining: [{ term: 'car accident lawyer austin', from: 19, to: 9 }, { term: 'personal injury attorney', from: 15, to: 8 }],
      losing: [{ term: 'slip and fall lawyer austin', from: 4, to: 9 }, { term: 'workers comp attorney', from: 7, to: 14 }, { term: 'motorcycle accident lawyer', from: 5, to: 10 }],
    },
  },
  {
    id: 'redline-auto', name: 'Redline Auto Care', trade: 'Auto repair', location: 'Denver, CO',
    mark: 'RA', color: '#7a5af0', budget: 6800, retainer: 2600, lastSyncedMin: 63,
    leadsDaily: series(31, 87, 0.312), spendDaily: series(32, 9780, 0.186),
    sources: { lsa: 'live', googleAds: 'live', gbp: 'live', meta: 'live', semrush: 'syncing' },
    lsa: { leads: 24, cpl: 128.6, guaranteed: false, responseMins: 11.4, series: short(33, 5, 2, 0.3) },
    googleAds: { spend: 6820, clicks: 1583, conversions: 38, costPerConv: 179.5, series: short(34, 8, 3, 0.6) },
    gbp: { rating: 4.9, ratingPrev: 4.8, reviews: 341, reviewDelta: 18, views: 11960, directions: 214, series: short(35, 4.7, 0.05, 0.03) },
    meta: { spend: 2960, results: 31, costPerResult: 95.5, reach: 28400, series: short(36, 6, 2.6, 0.5) },
    semrush: {
      keywords: 143, visibility: 29.8, visibilityDelta: 6.7, series: short(37, 21, 2.4, 1.4),
      gaining: [{ term: 'brake repair denver', from: 17, to: 5 }, { term: 'transmission repair colorado', from: 24, to: 11 }, { term: 'check engine light diagnostic', from: 12, to: 6 }],
      losing: [{ term: 'oil change near me denver', from: 9, to: 15 }],
    },
  },
]

const IMPORTABLE = [
  {
    id: 'lakeside-vet', name: 'Lakeside Veterinary', trade: 'Veterinary', location: 'Seattle, WA',
    mark: 'LV', color: '#0e9e8f', budget: 5200, retainer: 1600, lastSyncedMin: 2,
    leadsDaily: series(51, 176, 0.061), spendDaily: series(52, 4980, 0.03),
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
    id: 'summit-realty', name: 'Summit Realty Group', trade: 'Real estate', location: 'Nashville, TN',
    mark: 'SR', color: '#c2410c', budget: 9400, retainer: 2400, lastSyncedMin: 5,
    leadsDaily: series(61, 214, 0.144), spendDaily: series(62, 8600, 0.09),
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

/** Every seed client, flagged by whether it starts imported or discoverable. */
export function seedCatalog(): SeedClient[] {
  return [
    ...ACCOUNTS.map((a) => ({ id: a.id, importable: false, data: a as Record<string, unknown> })),
    ...IMPORTABLE.map((a) => ({ id: a.id, importable: true, data: a as Record<string, unknown> })),
  ]
}

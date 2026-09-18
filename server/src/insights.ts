/**
 * The shape every platform's metrics are normalised into, and the helpers that
 * are genuinely shared between them.
 *
 * Each connector (Meta, LinkedIn, …) returns a `PullResult`: a daily frame plus
 * the recent posts. Storage then does not care which platform produced it, so
 * `persist()` and the read path are written once.
 *
 * Two of these helpers exist because the same awkwardness recurs across
 * platforms. Both Meta and LinkedIn report a *current* follower total plus
 * per-day net change, never a history — so `followerCurve` walks the total
 * backwards through the gains. And both can omit a daily engagement series, so
 * `interactionsFromPosts` folds post engagement into the day it was published.
 */

export interface DailyRow {
  date: string               // YYYY-MM-DD
  followers: number | null
  reach: number | null
  impressions: number | null // "views" in current Meta vocabulary
  engagementRate: number | null
}

export interface PostRow {
  externalId: string
  type: string
  caption: string | null
  postedAt: string
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  videoViews: number | null
}

export interface PullResult {
  daily: DailyRow[]
  posts: PostRow[]
  followers: number | null
  /** Field or metric names that actually resolved — the audit trail for a run. */
  metricsUsed: string[]
  /** Non-fatal gaps (a retired metric, a partial window). */
  warnings: string[]
}

export const DAY = 86_400_000
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const unix = (d: Date) => Math.floor(d.getTime() / 1000)
export const millis = (d: Date) => d.getTime()

/** Midnight UTC today — every window is anchored here. */
export function todayUTC(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** The [since, until] windows covering `days` back, each at most `chunk` days.
 *  Instagram caps an insights query's range at 30 days. */
export function windows(days: number, chunk = 30): Array<{ since: number; until: number }> {
  const out: Array<{ since: number; until: number }> = []
  const end = todayUTC()
  let cur = new Date(end.getTime() - days * DAY)
  while (cur < end) {
    const stop = new Date(Math.min(end.getTime(), cur.getTime() + chunk * DAY))
    out.push({ since: unix(cur), until: unix(stop) })
    cur = stop
  }
  return out
}

/** An empty daily skeleton, oldest first — every puller fills the same frame. */
export function frame(days: number): DailyRow[] {
  const end = todayUTC()
  const rows: DailyRow[] = []
  for (let i = days - 1; i >= 0; i--) {
    rows.push({ date: iso(new Date(end.getTime() - i * DAY)), followers: null, reach: null, impressions: null, engagementRate: null })
  }
  return rows
}

/**
 * Rebuild a follower curve from today's count and the daily net-new series.
 *
 * Platforms report the *current* total plus per-day deltas, so the history is
 * walked backwards: yesterday = today − today's net new.
 */
export function followerCurve(rows: DailyRow[], current: number | null, newPerDay: Map<string, number>) {
  if (current == null) return
  let running = current
  for (let i = rows.length - 1; i >= 0; i--) {
    rows[i].followers = Math.max(0, Math.round(running))
    running -= newPerDay.get(rows[i].date) ?? 0
  }
}

/** engagement ÷ reach × 100 — the one definition the UI reads. */
export function engagementRate(interactions: number | null, reach: number | null): number | null {
  if (interactions == null || !reach) return null
  return +((interactions / reach) * 100).toFixed(2)
}

/** Fold post engagement into the day the post went out — the fallback when a
 *  platform gives no account-level daily interactions series. */
export function interactionsFromPosts(posts: PostRow[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const p of posts) {
    const day = p.postedAt.slice(0, 10)
    const eng = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)
    byDay.set(day, (byDay.get(day) ?? 0) + eng)
  }
  return byDay
}

/** Did the pull find anything worth storing? A window with no reach and no
 *  posts means the connection produced nothing, and the caller records that
 *  rather than storing an invented figure. */
export function isEmpty(r: PullResult): boolean {
  return !r.posts.length && !r.daily.some((d) => d.reach != null || d.impressions != null || d.followers != null)
}

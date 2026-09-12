/**
 * Social-media reporting model — the "Social face" of ReportBeacon.
 *
 * A separate lens from the performance/lead-gen side: instead of leads and
 * cost-per-lead across ad platforms, this is reach, engagement and post
 * performance across the channels a social media manager actually runs
 * (Instagram, Facebook, TikTok, LinkedIn). Same shape of demo data as
 * lib/data.ts — 60 days of daily series so range controls and deltas are real
 * — but the roster is content brands and creators, and the derived metrics,
 * recommendations and alerts speak the language of social, not paid search.
 */
import { RANGES, type RangeId } from './data'

export type SocialPlatformId = 'instagram' | 'facebook' | 'tiktok' | 'linkedin'

export interface SocialPlatform {
  id: SocialPlatformId
  name: string
  short: string
  color: string
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: 'instagram', name: 'Instagram', short: 'IG', color: '#e1306c' },
  { id: 'facebook', name: 'Facebook', short: 'FB', color: '#1877f2' },
  { id: 'tiktok', name: 'TikTok', short: 'TT', color: '#fe2c55' },
  { id: 'linkedin', name: 'LinkedIn', short: 'LI', color: '#0a66c2' },
]
export function socialPlatform(id: SocialPlatformId): SocialPlatform {
  return SOCIAL_PLATFORMS.find((p) => p.id === id)!
}

export type PostType = 'reel' | 'video' | 'image' | 'carousel' | 'story' | 'text'
export const POST_TYPE_LABEL: Record<PostType, string> = {
  reel: 'Reel', video: 'Video', image: 'Image', carousel: 'Carousel', story: 'Story', text: 'Text',
}

export interface Post {
  id: string
  platform: SocialPlatformId
  type: PostType
  caption: string
  daysAgo: number
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  videoViews?: number
  engagementRate: number // percent of reach that engaged
}

export interface ChannelStat {
  platform: SocialPlatformId
  followers: number
  followersDelta: number // percent, period over period
  reach: number
  engagementRate: number
  posts: number
}

export interface SocialAccount {
  id: string
  name: string
  handle: string
  mark: string
  color: string
  niche: string
  location: string
  bestTime: string // e.g. "7:00 PM"
  platforms: SocialPlatformId[]
  followers: number
  followersDelta: number
  reachDaily: number[] // 60 days
  engagementDaily: number[] // 60 days, rate %
  channels: ChannelStat[]
  posts: Post[]
  lastSyncedMin: number
}

// ── pseudo-random, seeded so the demo is stable ──────────────────────────────
function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}
function series(seed: number, base: number, deltaFrac: number, jitter = 0.22): number[] {
  const rnd = rng(seed)
  const k = (deltaFrac * base) / 60
  const out: number[] = []
  for (let d = 0; d < 60; d++) out.push(Math.max(0, (base + k * (d - 30)) * (1 + (rnd() - 0.5) * jitter)))
  return out
}

const CAPTIONS: Record<string, string[]> = {
  food: ['Weekend brunch is back 🍳', 'Behind the pass with Chef Amara', 'New jollof special, one day only', 'Your table is ready ✨', 'Sunday nyama choma platter'],
  fashion: ['Drop 04 is live 🔥', 'Styling the ankara blazer three ways', 'Fitting room diaries', 'Made in Lagos, worn everywhere', 'Restock alert: the linen set'],
  fitness: ['5am club, who is up?', '20-minute mobility flow', 'Member spotlight: Wanjiru', 'Form check Friday', 'New class times this month'],
  creator: ['Storytime: how I started', 'Nairobi in 60 seconds', 'Answering your DMs', '3 things nobody tells you', 'Day in the life'],
  coffee: ['Single-origin from Nyeri ☕', 'Latte art class this Saturday', 'Cold brew season is here', 'Meet the roasters', 'Your morning, sorted'],
}
const TYPES: PostType[] = ['reel', 'video', 'image', 'carousel', 'story', 'text']

function makePosts(seed: number, platforms: SocialPlatformId[], niche: string, baseReach: number): Post[] {
  const rnd = rng(seed)
  const caps = CAPTIONS[niche] ?? CAPTIONS.creator
  const posts: Post[] = []
  const n = 10 + Math.floor(rnd() * 4)
  for (let i = 0; i < n; i++) {
    const platform = platforms[Math.floor(rnd() * platforms.length)]
    // Reels / short video over-index on reach on IG and TikTok.
    const videoLean = platform === 'tiktok' || platform === 'instagram'
    const type: PostType = videoLean && rnd() < 0.55 ? (platform === 'tiktok' ? 'video' : 'reel') : TYPES[Math.floor(rnd() * TYPES.length)]
    const isVideo = type === 'reel' || type === 'video'
    const reach = Math.round(baseReach * (0.4 + rnd() * (isVideo ? 2.4 : 1.1)))
    const impressions = Math.round(reach * (1.2 + rnd() * 0.5))
    const er = (isVideo ? 4.5 : 2.6) + rnd() * 3.5
    const engaged = Math.round((reach * er) / 100)
    const likes = Math.round(engaged * (0.7 + rnd() * 0.12))
    const comments = Math.round(engaged * (0.06 + rnd() * 0.05))
    const shares = Math.round(engaged * (0.05 + rnd() * 0.05))
    const saves = Math.max(0, engaged - likes - comments - shares)
    posts.push({
      id: `${seed}-p${i}`,
      platform, type,
      caption: caps[i % caps.length],
      daysAgo: 1 + Math.floor(rnd() * 30),
      reach, impressions, likes, comments, shares, saves,
      videoViews: isVideo ? Math.round(reach * (1.6 + rnd() * 1.4)) : undefined,
      engagementRate: +er.toFixed(1),
    })
  }
  return posts.sort((a, b) => a.daysAgo - b.daysAgo)
}

function makeAccount(a: {
  id: string; name: string; handle: string; mark: string; color: string; niche: string; location: string
  bestTime: string; platforms: SocialPlatformId[]; followers: number; followersDelta: number
  baseReach: number; er: number; erDelta: number; seed: number; lastSyncedMin: number
}): SocialAccount {
  const rnd = rng(a.seed)
  const channels: ChannelStat[] = a.platforms.map((platform, i) => {
    const shareOfFollowers = a.platforms.length === 1 ? 1 : (0.55 - i * 0.14 + rnd() * 0.1)
    return {
      platform,
      followers: Math.round(a.followers * Math.max(0.12, shareOfFollowers)),
      followersDelta: +(a.followersDelta + (rnd() - 0.4) * 2).toFixed(1),
      reach: Math.round(a.baseReach * 30 * (0.4 + rnd() * 0.9)),
      engagementRate: +(a.er + (rnd() - 0.5) * 2).toFixed(1),
      posts: 6 + Math.floor(rnd() * 12),
    }
  })
  return {
    id: a.id, name: a.name, handle: a.handle, mark: a.mark, color: a.color, niche: a.niche,
    location: a.location, bestTime: a.bestTime, platforms: a.platforms,
    followers: a.followers, followersDelta: a.followersDelta,
    reachDaily: series(a.seed + 1, a.baseReach, a.erDelta > 0 ? 0.25 : -0.12),
    engagementDaily: series(a.seed + 2, a.er, a.erDelta / a.er, 0.14),
    channels,
    posts: makePosts(a.seed + 3, a.platforms, a.niche, a.baseReach),
    lastSyncedMin: a.lastSyncedMin,
  }
}

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  makeAccount({ id: 'zuri-kitchen', name: 'Zuri Kitchen', handle: '@zurikitchen', mark: 'ZK', color: '#d9480f', niche: 'food', location: 'Nairobi, KE', bestTime: '7:30 PM', platforms: ['instagram', 'facebook', 'tiktok'], followers: 48200, followersDelta: 6.4, baseReach: 5200, er: 5.1, erDelta: 0.6, seed: 101, lastSyncedMin: 3 }),
  makeAccount({ id: 'lagos-threads', name: 'Lagos Threads', handle: '@lagosthreads', mark: 'LT', color: '#7048e8', niche: 'fashion', location: 'Lagos, NG', bestTime: '6:00 PM', platforms: ['instagram', 'tiktok', 'facebook'], followers: 91300, followersDelta: 9.2, baseReach: 8600, er: 6.3, erDelta: 1.4, seed: 202, lastSyncedMin: 6 }),
  makeAccount({ id: 'pulsefit', name: 'PulseFit Studio', handle: '@pulsefitke', mark: 'PF', color: '#0ca678', niche: 'fitness', location: 'Nairobi, KE', bestTime: '5:30 AM', platforms: ['instagram', 'facebook'], followers: 21700, followersDelta: -1.8, baseReach: 2400, er: 3.4, erDelta: -0.9, seed: 303, lastSyncedMin: 4 }),
  makeAccount({ id: 'amara-media', name: 'Amara Media', handle: '@amaracreates', mark: 'AM', color: '#e8590c', niche: 'creator', location: 'Accra, GH', bestTime: '8:00 PM', platforms: ['tiktok', 'instagram', 'linkedin'], followers: 128500, followersDelta: 12.7, baseReach: 14200, er: 7.2, erDelta: 2.1, seed: 404, lastSyncedMin: 2 }),
  makeAccount({ id: 'sankofa-coffee', name: 'Sankofa Coffee', handle: '@sankofacoffee', mark: 'SC', color: '#5c3d2e', niche: 'coffee', location: 'Accra, GH', bestTime: '8:30 AM', platforms: ['instagram', 'facebook'], followers: 12900, followersDelta: 2.3, baseReach: 1500, er: 4.0, erDelta: 0.2, seed: 505, lastSyncedMin: 9 }),
]

export function getSocialAccount(id: string): SocialAccount | undefined {
  return SOCIAL_ACCOUNTS.find((a) => a.id === id)
}

// ── derived metrics ──────────────────────────────────────────────────────────
function sum(a: number[]): number { return a.reduce((x, y) => x + y, 0) }
function avg(a: number[]): number { return a.length ? sum(a) / a.length : 0 }
function windowSlice(daily: number[], days: number, back = 0): number[] {
  const end = daily.length - back * days
  return daily.slice(Math.max(0, end - days), end)
}
function pctChange(cur: number, prev: number): number {
  if (prev <= 0) return 0
  return ((cur - prev) / prev) * 100
}

export interface SocialMetrics {
  reach: number; reachDelta: number
  engagementRate: number; erDelta: number
  followers: number; followerGrowth: number
  posts: number
  topPost: Post | null
}

export function socialMetrics(a: SocialAccount, range: RangeId): SocialMetrics {
  const days = RANGES.find((r) => r.id === range)!.days
  const reach = sum(windowSlice(a.reachDaily, days, 0))
  const reachPrev = sum(windowSlice(a.reachDaily, days, 1))
  const er = avg(windowSlice(a.engagementDaily, days, 0))
  const erPrev = avg(windowSlice(a.engagementDaily, days, 1))
  const postsInRange = a.posts.filter((p) => p.daysAgo <= days)
  const topPost = [...a.posts].sort((x, y) => (y.reach * y.engagementRate) - (x.reach * x.engagementRate))[0] ?? null
  return {
    reach: Math.round(reach),
    reachDelta: pctChange(reach, reachPrev),
    engagementRate: +er.toFixed(1),
    erDelta: +(er - erPrev).toFixed(1),
    followers: a.followers,
    followerGrowth: Math.round((a.followers * a.followersDelta) / 100),
    posts: postsInRange.length,
    topPost,
  }
}

export type Health = 'good' | 'watch' | 'risk'
export function socialHealth(a: SocialAccount): Health {
  const m = socialMetrics(a, '30d')
  const gap = a.posts.length ? Math.min(...a.posts.map((p) => p.daysAgo)) : 99
  if (a.followersDelta < 0 || m.erDelta < -0.5 || gap > 7) return 'risk'
  if (m.erDelta < 0 || m.posts < 8 || gap > 4) return 'watch'
  return 'good'
}

export interface SocialAlert {
  id: string; accountId: string; accountName: string; severity: 'serious' | 'warning' | 'info'
  title: string; detail: string; tag: string
}
export function socialAlertsFor(a: SocialAccount): SocialAlert[] {
  const out: SocialAlert[] = []
  const m = socialMetrics(a, '30d')
  const gap = a.posts.length ? Math.min(...a.posts.map((p) => p.daysAgo)) : 99
  if (a.followersDelta < 0) out.push({ id: a.id + '-foll', accountId: a.id, accountName: a.name, severity: 'serious', title: `Followers down ${Math.abs(a.followersDelta).toFixed(1)}% this period`, detail: 'Losing audience faster than new follows come in', tag: 'At risk' })
  if (m.erDelta < -0.5) out.push({ id: a.id + '-eng', accountId: a.id, accountName: a.name, severity: 'warning', title: `Engagement rate down ${Math.abs(m.erDelta).toFixed(1)} pts`, detail: 'Recent posts are landing softer than usual', tag: 'Watch' })
  if (gap > 5) out.push({ id: a.id + '-gap', accountId: a.id, accountName: a.name, severity: 'warning', title: `No post in ${gap} days`, detail: 'Consistency drives reach; the feed has gone quiet', tag: 'Action' })
  return out
}
export function allSocialAlerts(accounts: SocialAccount[]): SocialAlert[] {
  const rank = { serious: 0, warning: 1, info: 2 }
  return accounts.flatMap(socialAlertsFor).sort((x, y) => rank[x.severity] - rank[y.severity])
}

export interface SocialRec {
  id: string; accountId: string; accountName: string
  category: 'cadence' | 'format' | 'timing' | 'engagement' | 'growth'
  priority: 'high' | 'medium' | 'low'
  title: string; rationale: string; impact: string; action: string
}
const CAT_ORDER = { high: 0, medium: 1, low: 2 }

export function socialRecsFor(a: SocialAccount): SocialRec[] {
  const out: SocialRec[] = []
  const m = socialMetrics(a, '30d')
  const videoPosts = a.posts.filter((p) => p.type === 'reel' || p.type === 'video')
  const videoShare = a.posts.length ? videoPosts.length / a.posts.length : 0
  const avgVideoReach = videoPosts.length ? avg(videoPosts.map((p) => p.reach)) : 0
  const avgOtherReach = avg(a.posts.filter((p) => !(p.type === 'reel' || p.type === 'video')).map((p) => p.reach)) || 1

  if (videoShare < 0.5 && avgVideoReach > avgOtherReach) {
    out.push({ id: a.id + '-format', accountId: a.id, accountName: a.name, category: 'format', priority: 'high', title: 'Post more short video', rationale: `Reels and video reach ${Math.round(avgVideoReach / avgOtherReach * 10) / 10}x further than static posts here, but are under half of what goes out.`, impact: `~${Math.round(avgVideoReach - avgOtherReach).toLocaleString()} more reach per post`, action: 'Plan Reels' })
  }
  if (m.posts < 12) {
    out.push({ id: a.id + '-cadence', accountId: a.id, accountName: a.name, category: 'cadence', priority: m.posts < 8 ? 'high' : 'medium', title: 'Lift posting cadence', rationale: `${m.posts} posts in the last 30 days. Accounts this size hold reach at 3 to 4 a week.`, impact: 'Steadier reach and follower growth', action: 'Build a calendar' })
  }
  out.push({ id: a.id + '-timing', accountId: a.id, accountName: a.name, category: 'timing', priority: 'medium', title: `Post around ${a.bestTime}`, rationale: `Engagement peaks near ${a.bestTime} for this audience; most posts are going out off-peak.`, impact: 'Higher first-hour engagement', action: 'Reschedule' })
  if (m.erDelta < 0) {
    out.push({ id: a.id + '-eng', accountId: a.id, accountName: a.name, category: 'engagement', priority: 'medium', title: 'Reply in the first hour', rationale: 'Engagement is slipping; fast replies and question-led captions lift the ratio.', impact: `Recover ~${Math.abs(m.erDelta).toFixed(1)} pts of engagement`, action: 'Set a reply window' })
  }
  if (a.followersDelta > 6) {
    out.push({ id: a.id + '-growth', accountId: a.id, accountName: a.name, category: 'growth', priority: 'low', title: 'Double down on what is working', rationale: `Followers up ${a.followersDelta.toFixed(1)}%. The current mix is compounding; keep the winning formats front and centre.`, impact: 'Sustain the growth curve', action: 'Repeat winners' })
  }
  return out.sort((x, y) => CAT_ORDER[x.priority] - CAT_ORDER[y.priority])
}
export function socialRecsForMany(accounts: SocialAccount[]): SocialRec[] {
  return accounts.flatMap(socialRecsFor).sort((x, y) => CAT_ORDER[x.priority] - CAT_ORDER[y.priority])
}

export function socialTotals(range: RangeId, accounts: SocialAccount[]) {
  let reach = 0, reachPrev = 0, followers = 0, growth = 0, posts = 0
  const ers: number[] = []
  const days = RANGES.find((r) => r.id === range)!.days
  for (const a of accounts) {
    const m = socialMetrics(a, range)
    reach += m.reach
    reachPrev += sum(windowSlice(a.reachDaily, days, 1))
    followers += a.followers
    growth += m.followerGrowth
    posts += m.posts
    ers.push(m.engagementRate)
  }
  return {
    accounts: accounts.length,
    reach: Math.round(reach), reachDelta: pctChange(reach, reachPrev),
    followers, followerGrowth: growth, posts,
    engagementRate: +avg(ers).toFixed(1),
    openAlerts: allSocialAlerts(accounts).length,
  }
}

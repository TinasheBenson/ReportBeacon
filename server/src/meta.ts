/**
 * Meta (Facebook + Instagram) connection, sync and read.
 *
 * Three modes of honesty about where numbers come from:
 *
 *  - **live** — META_APP_ID/SECRET are set, OAuth is real, and the metrics are
 *    pulled from the Graph API by `metaInsights.ts`.
 *  - **seed** — no Meta app configured, or a live pull returned nothing. A
 *    synthetic 60-day history stands in so the connect → import → read pipeline
 *    stays exercisable. Every connection records which it is (`data_source`),
 *    and the API reports it, so seeded numbers are never mistaken for real ones.
 *
 * Importing is idempotent: accounts, connections and posts upsert against the
 * natural keys added in migration 003, so re-connecting or re-syncing refreshes
 * rather than duplicating.
 */
import crypto from 'node:crypto'
import { pool } from './db.js'
import { encrypt, decrypt } from './crypto.js'
import { pullInstagram, pullFacebookPage, isEmpty, type PullResult, type DailyRow, type PostRow } from './metaInsights.js'
import { GRAPH, GraphError } from './graph.js'

const APP_ID = process.env.META_APP_ID
const APP_SECRET = process.env.META_APP_SECRET
const API_URL = process.env.API_URL ?? 'http://localhost:8080'
const REDIRECT = process.env.META_REDIRECT_URI ?? `${API_URL}/api/connect/meta/callback`
export const metaEnabled = !!(APP_ID && APP_SECRET)

const WINDOW_DAYS = 60

function db() { if (!pool) throw new Error('database not configured'); return pool }

/** Where /connect/meta/start sends the browser. Real: Meta's OAuth dialog.
 *  Stub: a local mock consent screen that returns a fake code. */
export function startAuthUrl(state: string): string {
  if (!metaEnabled) return `${API_URL}/api/connect/meta/mock?state=${encodeURIComponent(state)}`
  const scope = [
    'pages_show_list', 'pages_read_engagement', 'pages_read_user_content',
    'instagram_basic', 'instagram_manage_insights', 'read_insights',
    'business_management',
  ].join(',')
  const p = new URLSearchParams({ client_id: APP_ID!, redirect_uri: REDIRECT, state, scope, response_type: 'code' })
  return `https://www.facebook.com/dialog/oauth?${p}`
}

interface Identity { name: string; handle: string | null; platform: 'instagram' | 'facebook'; externalId: string; token: string }

/** Exchange the code and read the connected identities from the Graph API. */
async function fetchIdentities(code: string): Promise<Identity[]> {
  const tokenRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
    client_id: APP_ID!, client_secret: APP_SECRET!, redirect_uri: REDIRECT, code,
  }))
  if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`)
  const userToken = ((await tokenRes.json()) as any).access_token as string

  const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=name,access_token,instagram_business_account{username}&access_token=${userToken}`)
  if (!pagesRes.ok) throw new Error(`pages fetch failed: ${pagesRes.status}`)
  const pages = (((await pagesRes.json()) as any).data ?? []) as any[]

  const out: Identity[] = []
  for (const pg of pages) {
    out.push({ name: pg.name, handle: null, platform: 'facebook', externalId: String(pg.id), token: pg.access_token })
    if (pg.instagram_business_account) {
      out.push({
        name: pg.name, handle: pg.instagram_business_account.username ? `@${pg.instagram_business_account.username}` : null,
        platform: 'instagram', externalId: String(pg.instagram_business_account.id), token: pg.access_token,
      })
    }
  }
  return out
}

/** Stub identities: what a plausible Meta account returns, no app required. */
function stubIdentities(): Identity[] {
  return [
    { name: 'Zuri Kitchen', handle: '@zurikitchen', platform: 'instagram', externalId: 'ig_stub_1', token: 'stub-token-ig-1' },
    { name: 'Zuri Kitchen', handle: null, platform: 'facebook', externalId: 'fb_stub_1', token: 'stub-token-fb-1' },
    { name: 'Amara Media', handle: '@amaracreates', platform: 'instagram', externalId: 'ig_stub_2', token: 'stub-token-ig-2' },
  ]
}

// ── seeded fallback ──────────────────────────────────────────────────────────
function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646 }

/** A believable 60-day history, shaped exactly like a live pull so the writer
 *  below doesn't care which one it got. */
function seedPull(seed: number): PullResult {
  const rnd = rng(seed)
  const baseFollowers = 8000 + Math.floor(rnd() * 90000)
  const baseReach = 1500 + Math.floor(rnd() * 12000)
  const daily: DailyRow[] = []
  for (let d = WINDOW_DAYS - 1; d >= 0; d--) {
    const day = new Date(); day.setUTCHours(0, 0, 0, 0); day.setUTCDate(day.getUTCDate() - d)
    const reach = Math.round(baseReach * (0.7 + rnd() * 0.6))
    daily.push({
      date: day.toISOString().slice(0, 10),
      followers: Math.round(baseFollowers * (1 + (WINDOW_DAYS - 1 - d) * 0.001)),
      reach,
      impressions: Math.round(reach * (1.2 + rnd() * 0.5)),
      engagementRate: +(2.5 + rnd() * 5).toFixed(2),
    })
  }
  const captions = ['Weekend brunch is back', 'Behind the pass', 'New drop is live', 'Your table is ready', 'Story time']
  const types = ['reel', 'image', 'carousel', 'video', 'story']
  const posts: PostRow[] = []
  for (let p = 0; p < 10; p++) {
    const reach = Math.round(baseReach * (0.4 + rnd() * 2.2))
    const eng = Math.round(reach * (0.03 + rnd() * 0.06))
    const posted = new Date(); posted.setUTCDate(posted.getUTCDate() - Math.floor(rnd() * 30))
    const type = types[p % types.length]
    posts.push({
      externalId: `seed_${seed}_${p}`, type, caption: captions[p % captions.length],
      postedAt: posted.toISOString(), reach, impressions: Math.round(reach * 1.3),
      likes: Math.round(eng * 0.7), comments: Math.round(eng * 0.1),
      shares: Math.round(eng * 0.1), saves: Math.round(eng * 0.1),
      videoViews: type === 'reel' || type === 'video' ? Math.round(reach * 1.7) : null,
    })
  }
  return { daily, posts, followers: daily[daily.length - 1].followers, metricsUsed: [], warnings: [] }
}

// ── persistence ──────────────────────────────────────────────────────────────

/** Write a pull into metrics_daily + posts. Upserts, so re-syncing a day or a
 *  post refreshes it instead of duplicating or conflicting. */
async function persist(connectionId: string, r: PullResult) {
  const rows = r.daily.filter((d) => d.followers != null || d.reach != null || d.impressions != null || d.engagementRate != null)
  if (rows.length) {
    const values: string[] = []
    const params: any[] = []
    let i = 1
    for (const d of rows) {
      values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`)
      params.push(connectionId, d.date, d.followers, d.reach, d.impressions, d.engagementRate)
    }
    await db().query(
      `insert into metrics_daily (connection_id,date,followers,reach,impressions,engagement_rate)
       values ${values.join(',')}
       on conflict (connection_id,date) do update set
         followers       = coalesce(excluded.followers, metrics_daily.followers),
         reach           = coalesce(excluded.reach, metrics_daily.reach),
         impressions     = coalesce(excluded.impressions, metrics_daily.impressions),
         engagement_rate = coalesce(excluded.engagement_rate, metrics_daily.engagement_rate)`,
      params,
    )
  }

  for (const p of r.posts) {
    await db().query(
      `insert into posts (connection_id,external_id,type,caption,posted_at,reach,impressions,likes,comments,shares,saves,video_views)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (connection_id,external_id) where external_id is not null do update set
         type=excluded.type, caption=excluded.caption, posted_at=excluded.posted_at,
         reach=coalesce(excluded.reach, posts.reach),
         impressions=coalesce(excluded.impressions, posts.impressions),
         likes=coalesce(excluded.likes, posts.likes),
         comments=coalesce(excluded.comments, posts.comments),
         shares=coalesce(excluded.shares, posts.shares),
         saves=coalesce(excluded.saves, posts.saves),
         video_views=coalesce(excluded.video_views, posts.video_views)`,
      [connectionId, p.externalId, p.type, p.caption, p.postedAt, p.reach, p.impressions,
        p.likes, p.comments, p.shares, p.saves, p.videoViews],
    )
  }
}

/**
 * Sync one connection: pull live if we can, fall back to the seed if we can't,
 * and record on the sync run which it was and what Meta actually answered.
 * Never throws — a dead channel shouldn't strand the other channels' data.
 */
export async function syncConnection(conn: {
  id: string; platform: string; external_id: string | null; access_token_enc: Buffer | null
}): Promise<{ source: 'live' | 'seed'; error?: string }> {
  const run = (await db().query('insert into sync_runs (connection_id, status) values ($1,$2) returning id', [conn.id, 'running'])).rows[0]

  let result: PullResult | null = null
  let source: 'live' | 'seed' = 'seed'
  let error: string | undefined

  if (metaEnabled && conn.external_id && conn.access_token_enc) {
    try {
      const token = decrypt(conn.access_token_enc)
      const live = conn.platform === 'instagram'
        ? await pullInstagram(conn.external_id, token, WINDOW_DAYS)
        : await pullFacebookPage(conn.external_id, token, WINDOW_DAYS)
      if (isEmpty(live)) {
        error = 'live pull returned no data for this window'
      } else {
        result = live
        source = 'live'
      }
    } catch (err) {
      const ge = err as GraphError
      error = ge.isAuth
        ? `token rejected — reconnect required (${ge.message})`
        : `live pull failed: ${(err as Error).message}`
      if (ge.isAuth) {
        await db().query(`update platform_connections set status='needs_reauth' where id=$1`, [conn.id]).catch(() => {})
      }
    }
  }

  if (!result) result = seedPull(crypto.createHash('md5').update(conn.id).digest().readUInt32BE(0))

  try {
    await persist(conn.id, result)
    await db().query(
      `update platform_connections set last_synced_at=now(), data_source=$2 where id=$1`,
      [conn.id, source],
    )
    await db().query(
      `update sync_runs set status=$1, finished_at=now(), source=$2, metrics=$3::jsonb, warnings=$4::jsonb, error=$5 where id=$6`,
      [error ? 'degraded' : 'ok', source, JSON.stringify(result.metricsUsed), JSON.stringify(result.warnings),
        error?.slice(0, 500) ?? null, run.id],
    )
  } catch (err) {
    error = `persist failed: ${(err as Error).message}`
    await db().query('update sync_runs set status=$1, finished_at=now(), error=$2 where id=$3',
      ['error', error.slice(0, 500), run.id]).catch(() => {})
  }
  return { source, error }
}

/** Re-sync every connection in a workspace — refreshing real numbers without
 *  sending the user back through OAuth. */
export async function syncWorkspace(workspaceId: string): Promise<{ connections: number; live: number; errors: string[] }> {
  const conns = (await db().query(
    `select pc.id, pc.platform, pc.external_id, pc.access_token_enc
       from platform_connections pc
       join social_accounts sa on sa.id = pc.social_account_id
      where sa.workspace_id = $1`,
    [workspaceId],
  )).rows

  let live = 0
  const errors: string[] = []
  for (const c of conns) {
    const r = await syncConnection(c)
    if (r.source === 'live') live++
    if (r.error) errors.push(r.error)
  }
  return { connections: conns.length, live, errors }
}

/** The full import: identities → accounts + connections (token encrypted) →
 *  a sync per channel. Idempotent; returns how many accounts landed. */
export async function importFromMeta(workspaceId: string, code: string): Promise<{ accounts: number; mode: 'live' | 'stub'; live: number }> {
  const mode = metaEnabled ? 'live' : 'stub'
  let identities: Identity[]
  try {
    identities = metaEnabled ? await fetchIdentities(code) : stubIdentities()
  } catch (err) {
    // A live failure shouldn't strand the user mid-connect; surface it instead.
    throw new Error(`meta import failed (${mode}): ${(err as Error).message}`)
  }

  // Group identities by account name into one social_account with N channels.
  const byName = new Map<string, Identity[]>()
  for (const id of identities) { const k = id.name; byName.set(k, [...(byName.get(k) ?? []), id]) }

  let count = 0
  let live = 0
  for (const [name, channels] of byName) {
    const handle = channels.find((c) => c.handle)?.handle ?? null
    const acct = (await db().query(
      `insert into social_accounts (workspace_id, name, handle) values ($1,$2,$3)
       on conflict (workspace_id, name) do update set handle = coalesce(excluded.handle, social_accounts.handle)
       returning id`,
      [workspaceId, name, handle],
    )).rows[0]
    count++
    for (const ch of channels) {
      const conn = (await db().query(
        `insert into platform_connections (social_account_id, platform, external_id, access_token_enc, status)
         values ($1,$2,$3,$4,'connected')
         on conflict (social_account_id, platform, external_id) do update set
           access_token_enc = excluded.access_token_enc, status = 'connected'
         returning id, platform, external_id, access_token_enc`,
        [acct.id, ch.platform, ch.externalId, encrypt(ch.token)],
      )).rows[0]
      const r = await syncConnection(conn)
      if (r.source === 'live') live++
    }
  }
  return { accounts: count, mode, live }
}

// ── read: the Social face's shape ────────────────────────────────────────────

const MARK_COLORS = ['#d9480f', '#7048e8', '#0ca678', '#e8590c', '#5c3d2e', '#1971c2', '#c2255c', '#2f9e44']

/** Initials and a stable colour, so the UI's client marks need no extra data. */
function markFor(name: string): { mark: string; color: string } {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const mark = ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase() || '??'
  const h = crypto.createHash('md5').update(name).digest()[0]
  return { mark, color: MARK_COLORS[h % MARK_COLORS.length] }
}

/** The hour that actually earns the most engagement, from the posts we hold. */
function bestTimeFrom(posts: Array<{ posted_at: Date | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null }>): string {
  const score = new Map<number, number>()
  for (const p of posts) {
    if (!p.posted_at) continue
    const hour = new Date(p.posted_at).getUTCHours()
    const eng = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)
    score.set(hour, (score.get(hour) ?? 0) + eng)
  }
  if (!score.size) return '7:00 PM'
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const h12 = best % 12 === 0 ? 12 : best % 12
  return `${h12}:00 ${best < 12 ? 'AM' : 'PM'}`
}

/** A 60-day frame of dates, oldest first — the series the UI indexes into. */
function dateFrame(days = WINDOW_DAYS): string[] {
  const end = new Date(); end.setUTCHours(0, 0, 0, 0)
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) out.push(new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10))
  return out
}

/**
 * The workspace's social accounts in the exact shape the Social face models —
 * 60-day reach and engagement curves, per-channel stats, and recent posts — so
 * the client's existing derived metrics, alerts and recommendations work on
 * live data without a parallel code path.
 */
export async function listAccounts(workspaceId: string) {
  const accounts = (await db().query(
    'select id, name, handle, niche, location from social_accounts where workspace_id=$1 order by name',
    [workspaceId],
  )).rows
  if (!accounts.length) return []

  const ids = accounts.map((a) => a.id)
  const conns = (await db().query(
    `select id, social_account_id, platform, external_id, status, data_source,
            extract(epoch from (now() - last_synced_at)) as synced_ago
       from platform_connections where social_account_id = any($1::uuid[]) order by platform`,
    [ids],
  )).rows
  const connIds = conns.map((c) => c.id)

  const metrics = connIds.length ? (await db().query(
    `select connection_id, to_char(date,'YYYY-MM-DD') as date, followers, reach, impressions, engagement_rate
       from metrics_daily where connection_id = any($1::uuid[]) and date > current_date - $2::int
       order by date`,
    [connIds, WINDOW_DAYS],
  )).rows : []

  const posts = connIds.length ? (await db().query(
    `select connection_id, external_id, type, caption, posted_at, reach, impressions,
            likes, comments, shares, saves, video_views
       from posts where connection_id = any($1::uuid[])
       order by posted_at desc nulls last limit 500`,
    [connIds],
  )).rows : []

  const frame = dateFrame()
  const frameIndex = new Map(frame.map((d, i) => [d, i]))
  const connsByAccount = new Map<string, any[]>()
  for (const c of conns) connsByAccount.set(c.social_account_id, [...(connsByAccount.get(c.social_account_id) ?? []), c])
  const metricsByConn = new Map<string, any[]>()
  for (const m of metrics) metricsByConn.set(m.connection_id, [...(metricsByConn.get(m.connection_id) ?? []), m])
  const postsByConn = new Map<string, any[]>()
  for (const p of posts) postsByConn.set(p.connection_id, [...(postsByConn.get(p.connection_id) ?? []), p])

  const dayMs = 86_400_000
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)

  return accounts.map((a) => {
    const channels = connsByAccount.get(a.id) ?? []

    // Account-level curves: reach sums across channels; engagement is the
    // reach-weighted average, which is what "engagement ÷ reach" means once
    // more than one channel is in play.
    const reachDaily = new Array(frame.length).fill(0)
    const engWeighted = new Array(frame.length).fill(0)
    const engWeight = new Array(frame.length).fill(0)

    const channelStats = channels.map((c) => {
      const rows = metricsByConn.get(c.id) ?? []
      let followers = 0
      let followersFirst = 0
      let reach30 = 0
      const ers: number[] = []
      for (const m of rows) {
        const i = frameIndex.get(m.date)
        const reach = Number(m.reach ?? 0)
        if (i != null) {
          reachDaily[i] += reach
          if (m.engagement_rate != null) { engWeighted[i] += Number(m.engagement_rate) * (reach || 1); engWeight[i] += reach || 1 }
        }
        if (m.followers != null) { followers = Number(m.followers); if (!followersFirst) followersFirst = Number(m.followers) }
        if (i != null && i >= frame.length - 30) { reach30 += reach; if (m.engagement_rate != null) ers.push(Number(m.engagement_rate)) }
      }
      const chPosts = postsByConn.get(c.id) ?? []
      return {
        platform: c.platform,
        followers,
        followersDelta: followersFirst ? +(((followers - followersFirst) / followersFirst) * 100).toFixed(1) : 0,
        reach: reach30,
        engagementRate: ers.length ? +(ers.reduce((s, x) => s + x, 0) / ers.length).toFixed(1) : 0,
        posts: chPosts.length,
        status: c.status,
        dataSource: c.data_source,
        syncedMinAgo: c.synced_ago != null ? Math.max(0, Math.round(Number(c.synced_ago) / 60)) : null,
      }
    })

    const engagementDaily = engWeighted.map((v, i) => (engWeight[i] ? +(v / engWeight[i]).toFixed(2) : 0))
    const followers = channelStats.reduce((s, c) => s + c.followers, 0)
    const followersStart = channelStats.reduce((s, c) => s + (c.followersDelta ? c.followers / (1 + c.followersDelta / 100) : c.followers), 0)

    const allPosts = channels.flatMap((c) => (postsByConn.get(c.id) ?? []).map((p) => ({ ...p, platform: c.platform })))
    const uiPosts = allPosts.map((p, i) => {
      const reach = Number(p.reach ?? 0)
      const eng = Number(p.likes ?? 0) + Number(p.comments ?? 0) + Number(p.shares ?? 0) + Number(p.saves ?? 0)
      return {
        id: p.external_id ?? `${a.id}-p${i}`,
        platform: p.platform,
        type: p.type ?? 'image',
        caption: p.caption ?? '',
        daysAgo: p.posted_at ? Math.max(0, Math.round((today.getTime() - new Date(p.posted_at).getTime()) / dayMs)) : 99,
        reach,
        impressions: Number(p.impressions ?? 0),
        likes: Number(p.likes ?? 0),
        comments: Number(p.comments ?? 0),
        shares: Number(p.shares ?? 0),
        saves: Number(p.saves ?? 0),
        videoViews: p.video_views != null ? Number(p.video_views) : undefined,
        engagementRate: reach ? +((eng / reach) * 100).toFixed(1) : 0,
      }
    }).sort((x, y) => x.daysAgo - y.daysAgo)

    const syncedValues = channelStats.map((c) => c.syncedMinAgo).filter((v): v is number => v != null)
    const { mark, color } = markFor(a.name)

    return {
      id: a.id,
      name: a.name,
      handle: a.handle ?? '',
      mark, color,
      niche: a.niche ?? 'creator',
      location: a.location ?? '',
      bestTime: bestTimeFrom(allPosts),
      platforms: channelStats.map((c) => c.platform),
      followers,
      followersDelta: followersStart ? +(((followers - followersStart) / followersStart) * 100).toFixed(1) : 0,
      reachDaily,
      engagementDaily,
      channels: channelStats,
      posts: uiPosts,
      lastSyncedMin: syncedValues.length ? Math.min(...syncedValues) : 0,
      /** 'live' if any channel's numbers came from Meta. */
      dataSource: channelStats.some((c) => c.dataSource === 'live') ? 'live' : 'seed',
    }
  })
}

/** The most recent sync runs for a workspace — the audit trail that proves
 *  whether the numbers on screen came from Meta. */
export async function listSyncRuns(workspaceId: string, limit = 20) {
  return (await db().query(
    `select sr.id, sr.started_at, sr.finished_at, sr.status, sr.source, sr.metrics, sr.warnings, sr.error,
            pc.platform, sa.name as account
       from sync_runs sr
       join platform_connections pc on pc.id = sr.connection_id
       join social_accounts sa on sa.id = pc.social_account_id
      where sa.workspace_id = $1
      order by sr.started_at desc limit $2`,
    [workspaceId, limit],
  )).rows
}

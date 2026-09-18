/**
 * LinkedIn organization pages — OAuth and statistics.
 *
 * ── Read this before debugging it ───────────────────────────────────────────
 * This code has never run against LinkedIn. It was written from the Community
 * Management API documentation, because that API is a vetted product: access is
 * granted by application and review, so there is no development mode in which
 * to try it first. Every endpoint, parameter and field name below is what the
 * docs specify; none of it has been confirmed against a real response.
 *
 * So it is written to fail loudly and partially rather than silently and
 * wholly. Each figure is read through a list of candidate field names, a
 * missing one costs that figure alone, and whatever actually resolved is
 * recorded on the sync run. When approval lands, `GET /api/social/sync-runs`
 * is the first place to look: it will name the fields LinkedIn really sent.
 *
 * ── What LinkedIn does and does not give us ─────────────────────────────────
 * Organization pages only. `r_member_social` — personal profile analytics — is
 * a closed permission that LinkedIn is not granting, so a member's own posts
 * are out of reach entirely and no amount of approval changes that.
 *
 * Three quirks shape the code:
 *
 *  - **Follower totals live elsewhere.** The follower statistics endpoint
 *    returns per-day *gains*, not totals, and no longer returns a lifetime
 *    total at all. The total comes from `networkSizes`, and the history is
 *    reconstructed backwards from it — the same shape of problem as Meta.
 *  - **The window lags.** Follower data runs from 12 months ago to *two days*
 *    before today, so the most recent days are legitimately blank rather than
 *    zero. Share data is a rolling 12 months.
 *  - **Rest.li 2.0 encoding.** Query values are not ordinary query strings:
 *    `timeIntervals=(timeRange:(start:…,end:…),timeGranularityType:DAY)`, and
 *    the parentheses and colons must survive un-encoded while the URNs inside
 *    them are encoded. `restli()` below does that, and getting it wrong is the
 *    most likely cause of a 400 on first contact.
 */
import {
  DAY, iso, millis, todayUTC, frame, followerCurve, engagementRate, interactionsFromPosts,
  type PostRow, type PullResult,
} from './insights.js'

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID?.trim()
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET?.trim()
const API_URL = process.env.API_URL?.trim() || 'http://localhost:8080'
const REDIRECT = process.env.LINKEDIN_REDIRECT_URI?.trim() || `${API_URL}/api/connect/linkedin/callback`

/** Marketing API version, `YYYYMM`. LinkedIn sunsets versions on a schedule —
 *  202510 goes on 15 October 2026 — so this is configurable for the same
 *  reason META_GRAPH_VERSION is. */
const VERSION = process.env.LINKEDIN_VERSION?.trim() || '202609'

const REST = 'https://api.linkedin.com/rest'
export const linkedinEnabled = !!(CLIENT_ID && CLIENT_SECRET)

/** Scopes needed to read an organization's pages and their reporting data.
 *  rw_organization_admin is the one the statistics endpoints check, and it is
 *  restricted to organizations where the member is an ADMINISTRATOR. */
const SCOPES = ['r_organization_social', 'rw_organization_admin', 'w_member_social']

export class LinkedInError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) { super(message) }
  /** Token expired or the permission was revoked — needs a reconnect. */
  get isAuth(): boolean { return this.status === 401 || this.status === 403 }
  get isRateLimit(): boolean { return this.status === 429 }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Encode a Rest.li 2.0 parameter value.
 *
 * The structural characters — ( ) : , — are syntax and must stay literal. The
 * leaf values inside must be percent-encoded, which matters because every URN
 * contains colons of its own that would otherwise be read as structure.
 */
function restli(value: string): string {
  return value.replace(/urn:li:[A-Za-z]+:[^,)]+/g, (urn) => encodeURIComponent(urn))
}

async function li<T = any>(
  path: string,
  params: Record<string, string | number | undefined>,
  token: string,
  attempt = 0,
): Promise<T> {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    parts.push(`${k}=${restli(String(v))}`)
  }
  const url = `${REST}/${path.replace(/^\//, '')}${parts.length ? `?${parts.join('&')}` : ''}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    if (attempt < 2) { await sleep(500 * 2 ** attempt); return li<T>(path, params, token, attempt + 1) }
    throw new LinkedInError(`network: ${(err as Error).message}`, 0)
  }

  const body = await res.json().catch(() => ({})) as any
  if (res.ok) return body as T

  const err = new LinkedInError(
    String(body?.message ?? `HTTP ${res.status}`),
    res.status,
    body,
  )
  // Development Tier allows 500 requests per app and 100 per member, so a
  // throttle here is expected rather than exceptional.
  if (err.isRateLimit && attempt < 3) {
    await sleep(Math.min(8_000, 1_000 * 2 ** attempt))
    return li<T>(path, params, token, attempt + 1)
  }
  throw err
}

/** Read the first present field from a list of candidates, recording which
 *  one answered. Written this way because the field names are unverified. */
function pick(obj: any, used: string[], ...names: string[]): number | null {
  for (const n of names) {
    const v = obj?.[n]
    if (typeof v === 'number') { if (!used.includes(n)) used.push(n); return v }
  }
  return null
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export function startAuthUrl(state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT,
    state,
    scope: SCOPES.join(' '),
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`
}

interface TokenResponse { access_token: string; expires_in?: number; refresh_token?: string }

export async function exchangeCode(code: string): Promise<{ token: string; expiresAt: Date | null }> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new LinkedInError(`token exchange failed: ${res.status} ${text.slice(0, 200)}`, res.status)
  }
  const body = (await res.json()) as TokenResponse
  // LinkedIn access tokens are long-lived but finite (around 60 days), and
  // refresh tokens are only issued to approved apps. Storing the expiry lets a
  // sync say "reconnect" instead of reporting a mysterious 401.
  const expiresAt = body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null
  return { token: body.access_token, expiresAt }
}

export interface LinkedInIdentity {
  name: string
  handle: string | null
  externalId: string   // numeric organization id
  token: string
  expiresAt: Date | null
}

/**
 * The organizations this member administers.
 *
 * organizationAcls lists role assignments; the organization's own name has to
 * be looked up separately. A page the member merely has analyst access to will
 * not satisfy the statistics endpoints, so only ADMINISTRATOR is requested.
 */
export async function fetchOrganizations(token: string, expiresAt: Date | null): Promise<LinkedInIdentity[]> {
  const acls = await li<{ elements?: any[] }>('organizationAcls', {
    q: 'roleAssignee', role: 'ADMINISTRATOR', state: 'APPROVED', count: 50,
  }, token)

  const out: LinkedInIdentity[] = []
  for (const el of acls.elements ?? []) {
    const urn: string | undefined = el?.organization ?? el?.organizationalTarget
    const id = urn?.split(':').pop()
    if (!id) continue
    let name = `Organization ${id}`
    let handle: string | null = null
    try {
      const org = await li<any>(`organizations/${id}`, {}, token)
      name = org?.localizedName ?? org?.name?.localized?.en_US ?? name
      handle = org?.vanityName ? `@${org.vanityName}` : null
    } catch {
      // A page we can see in an ACL but cannot read details for still has
      // usable statistics, so keep it under a placeholder name.
    }
    out.push({ name, handle, externalId: id, token, expiresAt })
  }
  return out
}

// ── statistics ───────────────────────────────────────────────────────────────

const orgUrn = (id: string) => `urn:li:organization:${id}`

/** timeIntervals in Rest.li 2.0 object syntax. */
function timeIntervals(startMs: number, endMs: number, granularity: 'DAY' | 'MONTH' = 'DAY'): string {
  return `(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:${granularity})`
}

/** Current total followers. Lives on networkSizes, not on the statistics
 *  endpoint, which stopped returning a lifetime total. */
async function fetchFollowerTotal(id: string, token: string, used: string[], warnings: string[]): Promise<number | null> {
  for (const edgeType of ['CompanyFollowedByMember', 'COMPANY_FOLLOWED_BY_MEMBER']) {
    try {
      const res = await li<any>(`networkSizes/${orgUrn(id)}`, { edgeType }, token)
      const n = pick(res, used, 'firstDegreeSize', 'firstDegreeSizeWithoutHidden')
      if (n != null) return n
    } catch (err) {
      if ((err as LinkedInError).isAuth) throw err
      // The enum spelling is the uncertain part; try the other before warning.
    }
  }
  warnings.push('linkedin: could not read follower total from networkSizes')
  return null
}

export async function pullOrganization(id: string, token: string, days = 60): Promise<PullResult> {
  const rows = frame(days)
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const metricsUsed: string[] = []
  const warnings: string[] = []

  const end = todayUTC()
  const start = new Date(end.getTime() - days * DAY)

  const followers = await fetchFollowerTotal(id, token, metricsUsed, warnings)

  // Daily share statistics: impressions, unique impressions (our reach), and
  // the engagement counts.
  try {
    const stats = await li<{ elements?: any[] }>('organizationalEntityShareStatistics', {
      q: 'organizationalEntity',
      organizationalEntity: orgUrn(id),
      timeIntervals: timeIntervals(millis(start), millis(end)),
    }, token)

    for (const el of stats.elements ?? []) {
      const startMs = el?.timeRange?.start
      if (typeof startMs !== 'number') continue
      const row = byDate.get(iso(new Date(startMs)))
      if (!row) continue
      const t = el.totalShareStatistics ?? {}
      // The docs spell this both ways — `uniqueImpressionsCount` in the schema
      // and `uniqueImpressionsCounts` in a sample response. Accept either.
      row.reach = pick(t, metricsUsed, 'uniqueImpressionsCount', 'uniqueImpressionsCounts')
      row.impressions = pick(t, metricsUsed, 'impressionCount')
      const likes = pick(t, metricsUsed, 'likeCount') ?? 0
      const comments = pick(t, metricsUsed, 'commentCount') ?? 0
      const shares = pick(t, metricsUsed, 'shareCount') ?? 0
      const clicks = pick(t, metricsUsed, 'clickCount') ?? 0
      const interactions = likes + comments + shares + clicks
      // Prefer our own definition (engagement ÷ reach) over LinkedIn's
      // `engagement`, which is over impressions — mixing the two would make
      // LinkedIn's rate quietly incomparable with every other platform's.
      row.engagementRate = engagementRate(interactions, row.reach)
        ?? (typeof t.engagement === 'number' ? +(t.engagement * 100).toFixed(2) : null)
    }
    if (!(stats.elements ?? []).length) warnings.push('linkedin: share statistics returned no rows for this window')
  } catch (err) {
    if ((err as LinkedInError).isAuth) throw err
    warnings.push(`linkedin share statistics: ${(err as Error).message}`)
  }

  // Daily follower gains, used to walk the total backwards into a curve.
  const newFollows = new Map<string, number>()
  try {
    const fs = await li<{ elements?: any[] }>('organizationalEntityFollowerStatistics', {
      q: 'organizationalEntity',
      organizationalEntity: orgUrn(id),
      timeIntervals: timeIntervals(millis(start), millis(end)),
    }, token)
    for (const el of fs.elements ?? []) {
      const startMs = el?.timeRange?.start
      if (typeof startMs !== 'number') continue
      const g = el.followerGains ?? {}
      const organic = pick(g, metricsUsed, 'organicFollowerGain') ?? 0
      const paid = pick(g, metricsUsed, 'paidFollowerGain') ?? 0
      newFollows.set(iso(new Date(startMs)), organic + paid)
    }
    if (!(fs.elements ?? []).length) {
      // Expected near the present: this series stops two days before today.
      warnings.push('linkedin: follower statistics returned no rows (the series lags today by two days)')
    }
  } catch (err) {
    if ((err as LinkedInError).isAuth) throw err
    warnings.push(`linkedin follower statistics: ${(err as Error).message}`)
  }
  followerCurve(rows, followers, newFollows)

  // Posts, then per-post lifetime statistics. Time-bound stats are not
  // available per share, so these are lifetime figures for recent posts.
  const posts: PostRow[] = []
  try {
    const feed = await li<{ elements?: any[] }>('posts', {
      q: 'author', author: orgUrn(id), count: 50, sortBy: 'LAST_MODIFIED',
    }, token)

    const recent = (feed.elements ?? []).filter((p: any) => {
      const created = p?.createdAt ?? p?.firstPublishedAt
      return typeof created !== 'number' || created >= millis(start)
    })

    const urns = recent.map((p: any) => p?.id).filter((u: any): u is string => typeof u === 'string')
    const statsByUrn = new Map<string, any>()
    if (urns.length) {
      // Batched in tens: the URN list rides in the query string, and Development
      // Tier request budgets are small enough to be worth respecting.
      for (let i = 0; i < urns.length; i += 10) {
        const batch = urns.slice(i, i + 10)
        const key = batch[0].includes(':ugcPost:') ? 'ugcPosts' : 'shares'
        try {
          const res = await li<{ elements?: any[] }>('organizationalEntityShareStatistics', {
            q: 'organizationalEntity',
            organizationalEntity: orgUrn(id),
            [key]: `List(${batch.join(',')})`,
          }, token)
          for (const el of res.elements ?? []) {
            const u = el?.share ?? el?.ugcPost
            if (typeof u === 'string') statsByUrn.set(u, el.totalShareStatistics ?? {})
          }
        } catch (err) {
          if ((err as LinkedInError).isAuth) throw err
          warnings.push(`linkedin post statistics: ${(err as Error).message}`)
        }
      }
    }

    for (const p of recent) {
      const urn: string = p?.id
      if (!urn) continue
      const t = statsByUrn.get(urn) ?? {}
      const createdAt = p?.createdAt ?? p?.firstPublishedAt
      const text: string | null =
        p?.commentary ?? p?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text ?? null
      const media = String(p?.content?.media?.id ?? '')
      posts.push({
        externalId: urn,
        // LinkedIn has no post "type" field as such; infer video from the
        // attached media URN and otherwise treat it as text.
        type: media.includes(':video:') ? 'video' : media.includes(':image:') ? 'image' : 'text',
        caption: text,
        postedAt: new Date(typeof createdAt === 'number' ? createdAt : Date.now()).toISOString(),
        reach: pick(t, metricsUsed, 'uniqueImpressionsCount', 'uniqueImpressionsCounts'),
        impressions: pick(t, metricsUsed, 'impressionCount'),
        likes: pick(t, metricsUsed, 'likeCount'),
        comments: pick(t, metricsUsed, 'commentCount'),
        shares: pick(t, metricsUsed, 'shareCount'),
        saves: null,        // LinkedIn exposes no save metric
        videoViews: null,   // video views come from a separate analytics endpoint
      })
    }
  } catch (err) {
    if ((err as LinkedInError).isAuth) throw err
    warnings.push(`linkedin posts: ${(err as Error).message}`)
  }

  // If no daily engagement landed, derive it from the posts rather than leaving
  // the column blank.
  if (!rows.some((r) => r.engagementRate != null)) {
    const byDay = interactionsFromPosts(posts)
    for (const r of rows) r.engagementRate = engagementRate(byDay.get(r.date) ?? 0, r.reach)
  }

  return { daily: rows, posts, followers, metricsUsed, warnings }
}

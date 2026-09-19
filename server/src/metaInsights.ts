/**
 * Live Meta insights — the real numbers behind the Social face.
 *
 * Replaces the seeded generator with actual Graph API reads for the two
 * platforms Meta owns: an Instagram business account and a Facebook Page.
 * Each puller returns a normalised `PullResult` (a 60-day daily series plus the
 * recent posts) that `meta.ts` writes into metrics_daily / posts, so the storage
 * shape is identical whether the numbers came from Meta or from the seed.
 *
 * ── Why the metric names are lists, not constants ───────────────────────────
 * Meta retires insights metrics on a rolling schedule and the replacements are
 * not drop-in: on Instagram `impressions` and `plays` gave way to `views`
 * (v22.0, April 2025), and on Pages `page_impressions` and `page_fans` were
 * retired in favour of views/follows metrics through late 2025 and 2026. A
 * request naming one retired metric fails whole, taking the healthy metrics
 * with it.
 *
 * So each logical field (reach, views, interactions, follows) is expressed as a
 * *priority list* of candidate metric names. `insights()` drops the ones this
 * Graph version rejects and we read the first survivor. A deprecation costs one
 * field rather than the sync, and `metricsUsed` records which names actually
 * answered so a sync run can be audited against Meta's own Insights UI.
 */
import { graph, paged, insights, seriesByDate, firstOf, GraphError } from './graph.js'
import {
  DAY, unix, windows, frame, followerCurve, engagementRate, interactionsFromPosts,
  type PostRow, type PullResult,
} from './insights.js'

export { isEmpty } from './insights.js'
export type { DailyRow, PostRow, PullResult } from './insights.js'

// ── Instagram ────────────────────────────────────────────────────────────────

/** Media product types map onto the app's post vocabulary. */
function igType(m: any): string {
  const product = String(m.media_product_type ?? '').toUpperCase()
  if (product === 'REELS') return 'reel'
  if (product === 'STORY') return 'story'
  const type = String(m.media_type ?? '').toUpperCase()
  if (type === 'VIDEO') return 'video'
  if (type === 'CAROUSEL_ALBUM') return 'carousel'
  return 'image'
}

/**
 * An Instagram professional account's last `days` of numbers.
 *
 * `base` exists because the same account is reachable through two different
 * APIs. A connection made through Facebook Login is read from graph.facebook.com
 * (the default, where a bare node id resolves); one made through Instagram Login
 * is read from graph.instagram.com, whose tokens Facebook does not recognise and
 * vice versa. The node shapes, fields and metric names are identical, so the
 * only difference is which host the request goes to — hence a base URL rather
 * than a second copy of this function. `graph()` passes an absolute path through
 * untouched, which is what makes prefixing enough.
 */
export async function pullInstagram(igId: string, token: string, days = 60, base?: string): Promise<PullResult> {
  const node = (id: string) => (base ? `${base}/${id}` : id)
  const rows = frame(days)
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const metricsUsed: string[] = []
  const warnings: string[] = []

  // Current audience: a plain field on the node, unaffected by insights churn.
  let followers: number | null = null
  try {
    const prof = await graph<{ followers_count?: number }>(node(igId), { fields: 'followers_count,username,name' }, token)
    followers = typeof prof.followers_count === 'number' ? prof.followers_count : null
    if (followers != null) metricsUsed.push('followers_count')
  } catch (err) {
    warnings.push(`ig profile: ${(err as Error).message}`)
  }

  // Daily series, 30-day chunks. `views` superseded `impressions` in v22.0;
  // ask for both and take whichever this version still answers.
  const newFollows = new Map<string, number>()
  for (const w of windows(days, 30)) {
    const got = await insights(node(igId), ['reach', 'views', 'impressions', 'follower_count', 'total_interactions'],
      { period: 'day', since: w.since, until: w.until }, token)

    const reach = seriesByDate(firstOf(got, 'reach'))
    const views = seriesByDate(firstOf(got, 'views', 'impressions'))
    const inter = seriesByDate(firstOf(got, 'total_interactions'))
    for (const [k, v] of seriesByDate(firstOf(got, 'follower_count'))) newFollows.set(k, v)

    for (const [date, v] of reach) { const r = byDate.get(date); if (r) r.reach = v }
    for (const [date, v] of views) { const r = byDate.get(date); if (r) r.impressions = v }
    for (const [date, v] of inter) {
      const r = byDate.get(date)
      if (r) r.engagementRate = engagementRate(v, r.reach)
    }
    for (const name of got.keys()) if (!metricsUsed.includes(name)) metricsUsed.push(name)
  }
  for (const want of ['reach', 'views', 'total_interactions']) {
    if (!metricsUsed.includes(want)) warnings.push(`ig: "${want}" unavailable on this Graph version`)
  }

  followerCurve(rows, followers, newFollows)

  // Recent media + per-post insights.
  const posts: PostRow[] = []
  const since = unix(new Date(Date.now() - days * DAY))
  try {
    const media = await paged<any>(node(`${igId}/media`), {
      fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink',
      since, limit: 50,
    }, token, { maxPages: 6, maxItems: 120 })

    // The first media teaches us which per-media metrics this account serves;
    // every later one asks for just those, so a retired metric costs one slow
    // path rather than one per post.
    let mediaMetrics = ['reach', 'views', 'saved', 'shares', 'total_interactions']
    let learned = false

    for (const m of media) {
      const type = igType(m)
      const row: PostRow = {
        externalId: String(m.id),
        type,
        caption: m.caption ?? null,
        postedAt: m.timestamp ?? new Date().toISOString(),
        reach: null, impressions: null,
        likes: typeof m.like_count === 'number' ? m.like_count : null,
        comments: typeof m.comments_count === 'number' ? m.comments_count : null,
        shares: null, saves: null, videoViews: null,
      }
      try {
        // Per-media metric support varies by format (stories and reels differ
        // from feed posts), which is exactly what the per-metric fallback absorbs.
        const got = await insights(node(m.id), mediaMetrics, {}, token, (names) => {
          // Stories and reels serve different metrics than feed posts, so only
          // narrow the set when a node actually answered with something.
          if (!learned && names.length) { mediaMetrics = names; learned = true }
        })
        const val = (e: any) => (e ? (typeof e.total_value?.value === 'number' ? e.total_value.value : (e.values?.[0]?.value ?? null)) : null)
        row.reach = val(firstOf(got, 'reach'))
        row.impressions = val(firstOf(got, 'views'))
        row.saves = val(firstOf(got, 'saved'))
        row.shares = val(firstOf(got, 'shares'))
        if (type === 'reel' || type === 'video') row.videoViews = row.impressions
        for (const name of got.keys()) if (!metricsUsed.includes(`media.${name}`)) metricsUsed.push(`media.${name}`)
      } catch (err) {
        if ((err as GraphError).isAuth) throw err
        warnings.push(`ig media ${m.id}: ${(err as Error).message}`)
      }
      posts.push(row)
    }
  } catch (err) {
    if ((err as GraphError).isAuth) throw err
    warnings.push(`ig media: ${(err as Error).message}`)
  }

  // If the account-level interactions series was retired, derive the daily rate
  // from the posts themselves rather than leaving engagement blank.
  if (!metricsUsed.includes('total_interactions')) {
    const byDay = interactionsFromPosts(posts)
    for (const r of rows) if (r.engagementRate == null) r.engagementRate = engagementRate(byDay.get(r.date) ?? 0, r.reach)
  }

  return { daily: rows, posts, followers, metricsUsed, warnings }
}

// ── Facebook Page ────────────────────────────────────────────────────────────

export async function pullFacebookPage(pageId: string, token: string, days = 60): Promise<PullResult> {
  const rows = frame(days)
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const metricsUsed: string[] = []
  const warnings: string[] = []

  // `fan_count` (Page likes) was retired in favour of `followers_count`; ask for
  // both and prefer the modern one.
  let followers: number | null = null
  try {
    const page = await graph<{ followers_count?: number; fan_count?: number }>(pageId, { fields: 'followers_count,fan_count,name' }, token)
    followers = typeof page.followers_count === 'number' ? page.followers_count
      : typeof page.fan_count === 'number' ? page.fan_count : null
    if (followers != null) metricsUsed.push(typeof page.followers_count === 'number' ? 'followers_count' : 'fan_count')
  } catch (err) {
    warnings.push(`page profile: ${(err as Error).message}`)
  }

  // Page insights accept a wider window than IG, but chunking keeps responses small.
  const newFollows = new Map<string, number>()
  for (const w of windows(days, 30)) {
    const got = await insights(pageId, [
      // reach — unique people, in retirement order newest-name-first
      'page_impressions_unique',
      // views / impressions
      'page_impressions', 'page_views_total',
      // interactions
      'page_post_engagements', 'page_total_actions',
      // follows (page_fans retired Nov 2025)
      'page_daily_follows_unique', 'page_daily_follows', 'page_fan_adds_unique', 'page_fans',
    ], { period: 'day', since: w.since, until: w.until }, token)

    const reach = seriesByDate(firstOf(got, 'page_impressions_unique'))
    const views = seriesByDate(firstOf(got, 'page_impressions', 'page_views_total'))
    const inter = seriesByDate(firstOf(got, 'page_post_engagements', 'page_total_actions'))
    for (const [k, v] of seriesByDate(firstOf(got, 'page_daily_follows_unique', 'page_daily_follows', 'page_fan_adds_unique'))) newFollows.set(k, v)

    for (const [date, v] of reach) { const r = byDate.get(date); if (r) r.reach = v }
    for (const [date, v] of views) { const r = byDate.get(date); if (r) r.impressions = v }
    for (const [date, v] of inter) { const r = byDate.get(date); if (r) r.engagementRate = engagementRate(v, r.reach) }

    // `page_fans` is a running total, not a delta — use it directly when present.
    for (const [date, v] of seriesByDate(firstOf(got, 'page_fans'))) { const r = byDate.get(date); if (r) r.followers = v }
    for (const name of got.keys()) if (!metricsUsed.includes(name)) metricsUsed.push(name)
  }
  if (!metricsUsed.some((m) => m.startsWith('page_impressions'))) {
    warnings.push('page: no reach/views metric available on this Graph version')
  }

  if (!metricsUsed.includes('page_fans')) followerCurve(rows, followers, newFollows)

  // Recent posts + per-post insights.
  const posts: PostRow[] = []
  const since = unix(new Date(Date.now() - days * DAY))
  try {
    const feed = await paged<any>(`${pageId}/posts`, {
      fields: 'id,message,created_time,permalink_url,shares,attachments{media_type},likes.summary(true).limit(0),comments.summary(true).limit(0)',
      since, limit: 50,
    }, token, { maxPages: 6, maxItems: 120 })

    let postMetrics = ['post_impressions_unique', 'post_impressions', 'post_engaged_users', 'post_video_views']
    let learnedPost = false

    for (const p of feed) {
      const mediaType = String(p.attachments?.data?.[0]?.media_type ?? '').toLowerCase()
      const type = mediaType === 'video' ? 'video' : mediaType === 'album' ? 'carousel' : mediaType === 'photo' ? 'image' : 'text'
      const row: PostRow = {
        externalId: String(p.id),
        type,
        caption: p.message ?? null,
        postedAt: p.created_time ?? new Date().toISOString(),
        reach: null, impressions: null,
        likes: p.likes?.summary?.total_count ?? null,
        comments: p.comments?.summary?.total_count ?? null,
        shares: p.shares?.count ?? null,
        saves: null, videoViews: null,
      }
      try {
        const got = await insights(p.id, postMetrics, {}, token, (names) => {
          if (!learnedPost && names.length) { postMetrics = names; learnedPost = true }
        })
        const val = (e: any) => (e ? (typeof e.total_value?.value === 'number' ? e.total_value.value : (e.values?.[0]?.value ?? null)) : null)
        row.reach = val(firstOf(got, 'post_impressions_unique'))
        row.impressions = val(firstOf(got, 'post_impressions'))
        row.videoViews = val(firstOf(got, 'post_video_views'))
        for (const name of got.keys()) if (!metricsUsed.includes(`post.${name}`)) metricsUsed.push(`post.${name}`)
      } catch (err) {
        if ((err as GraphError).isAuth) throw err
        warnings.push(`page post ${p.id}: ${(err as Error).message}`)
      }
      posts.push(row)
    }
  } catch (err) {
    if ((err as GraphError).isAuth) throw err
    warnings.push(`page posts: ${(err as Error).message}`)
  }

  if (!metricsUsed.some((m) => m === 'page_post_engagements' || m === 'page_total_actions')) {
    const byDay = interactionsFromPosts(posts)
    for (const r of rows) if (r.engagementRate == null) r.engagementRate = engagementRate(byDay.get(r.date) ?? 0, r.reach)
  }

  return { daily: rows, posts, followers, metricsUsed, warnings }
}


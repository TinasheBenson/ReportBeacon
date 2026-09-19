/**
 * Graph API transport — the thin, defensive layer every Meta call goes through.
 *
 * Two things make this more than a fetch wrapper:
 *
 *  1. **Version churn.** Meta retires insights metrics on a rolling schedule and
 *     a request naming one dead metric fails *entirely* — the good metrics in
 *     the same call are lost with it. `insights()` therefore asks for a list of
 *     candidates, and on a metric error falls back to asking for each one
 *     separately, keeping whatever the current version still serves. Callers
 *     declare what they want in priority order and read back what arrived.
 *
 *  2. **Rate limits.** Page/IG calls are throttled per token. `graph()` retries
 *     on 429 and on Meta's application-limit codes with capped backoff, and
 *     `paged()` bounds how far it will walk a cursor.
 *
 * The Graph version is env-configurable (META_GRAPH_VERSION) precisely because
 * the right value changes over time; pin it when a deployment needs stability.
 */

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || 'v23.0'
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly type?: string,
  ) { super(message) }

  /** Throttling — worth retrying after a pause. */
  get isRateLimit(): boolean {
    return this.status === 429 || this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613
  }

  /** The metric/field is gone or unsupported on this version — never retryable,
   *  but survivable: drop the offender and ask for the rest. */
  get isBadMetric(): boolean {
    if (this.code === 100) return true
    return /deprecated|nonexisting field|must be one of the following values|valid insights metric|not supported/i.test(this.message)
  }

  /** The token is dead or the permission was revoked — the connection needs a
   *  reconnect, so callers surface it rather than silently degrading. */
  get isAuth(): boolean {
    if (this.status === 401) return true
    const c = this.code ?? 0
    // 190 expired/invalid token, 102 session, 10 + the 2xx block are permission errors.
    return c === 190 || c === 102 || c === 10 || (c >= 200 && c <= 299)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One Graph GET with rate-limit backoff. Returns parsed JSON. */
export async function graph<T = any>(
  path: string,
  params: Record<string, string | number | undefined>,
  token: string,
  attempt = 0,
): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  qs.set('access_token', token)

  const url = `${path.startsWith('http') ? path : `${GRAPH}/${path.replace(/^\//, '')}`}?${qs}`
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  } catch (err) {
    // Network/timeout: retry a couple of times before giving up.
    if (attempt < 2) { await sleep(500 * 2 ** attempt); return graph<T>(path, params, token, attempt + 1) }
    throw new GraphError(`network: ${(err as Error).message}`, 0)
  }

  const body = await res.json().catch(() => ({})) as any
  if (res.ok && !body?.error) return body as T

  const e = body?.error ?? {}
  const err = new GraphError(
    String(e.message ?? `HTTP ${res.status}`),
    res.status,
    typeof e.code === 'number' ? e.code : undefined,
    typeof e.error_subcode === 'number' ? e.error_subcode : undefined,
    e.type,
  )
  if (err.isRateLimit && attempt < 3) {
    await sleep(Math.min(8_000, 1_000 * 2 ** attempt))
    return graph<T>(path, params, token, attempt + 1)
  }
  throw err
}

/** Walk `data` across pages, bounded so a runaway cursor can't hang a sync. */
export async function paged<T = any>(
  path: string,
  params: Record<string, string | number | undefined>,
  token: string,
  opts: { maxPages?: number; maxItems?: number } = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 10
  const maxItems = opts.maxItems ?? 400
  const out: T[] = []
  let page = await graph<{ data?: T[]; paging?: { next?: string } }>(path, params, token)
  for (let i = 0; i < maxPages; i++) {
    out.push(...(page.data ?? []))
    const next = page.paging?.next
    if (!next || out.length >= maxItems) break
    // `next` is absolute and already carries the token + cursor.
    page = await graph<{ data?: T[]; paging?: { next?: string } }>(next, {}, token)
  }
  return out.slice(0, maxItems)
}

export interface InsightValue { value: any; end_time?: string }
export interface InsightEntry { name: string; period?: string; values?: InsightValue[]; total_value?: { value: any } }

/**
 * Ask for `metrics` on a node's /insights edge, tolerating dead metric names.
 *
 * Fast path: one request for all of them. If Meta rejects the batch because one
 * name is retired, fall back to asking per metric and keep the survivors — so a
 * deprecation costs us that metric, not the whole sync. Returns the entries that
 * came back, keyed by metric name; anything missing simply wasn't available.
 */
export async function insights(
  nodeId: string,
  metrics: string[],
  params: Record<string, string | number | undefined>,
  token: string,
  /** Called with the metric names that this node actually served. Lets a caller
   *  looping over many similar nodes (every post on a page) learn the working
   *  set once instead of re-running the slow path — and re-paying its request
   *  cost — for each one. */
  onResolved?: (names: string[]) => void,
): Promise<Map<string, InsightEntry>> {
  const got = new Map<string, InsightEntry>()
  if (!metrics.length) return got

  const absorb = (entries: InsightEntry[] | undefined) => {
    for (const e of entries ?? []) if (e?.name && !got.has(e.name)) got.set(e.name, e)
  }

  try {
    const res = await graph<{ data?: InsightEntry[] }>(`${nodeId}/insights`, { ...params, metric: metrics.join(',') }, token)
    absorb(res.data)
    onResolved?.([...got.keys()])
    return got
  } catch (err) {
    if (!(err instanceof GraphError) || err.isAuth || !err.isBadMetric) throw err
  }

  // Slow path: one metric at a time, skipping the ones this version no longer has.
  //
  // A metric rejected on its own gets one more chance with `metric_type=total_value`.
  // Meta moved several Instagram metrics — `views`, `total_interactions`, `likes`,
  // `shares`, `saves` — to that form, where they return a single figure for the
  // window instead of a daily series, and asking for them the old way is rejected
  // as an unsupported metric rather than as a changed one. The error looks
  // identical to a retirement, so the only way to tell the two apart is to ask
  // again the other way; the first live sync did exactly this and reported
  // `views` and `total_interactions` as simply unavailable, which is what
  // prompted this.
  //
  // The retry costs one request per genuinely-dead metric and nothing at all for
  // a healthy one, and `metricsUsed` records which form answered — so production
  // tells us the truth rather than us guessing from documentation.
  for (const m of metrics) {
    try {
      const res = await graph<{ data?: InsightEntry[] }>(`${nodeId}/insights`, { ...params, metric: m }, token)
      absorb(res.data)
      continue
    } catch (err) {
      const ge = err as GraphError
      if (ge.isAuth) throw err
      if (!ge.isBadMetric) throw err
    }
    try {
      // `period` is meaningless for a single window total and Meta rejects the
      // combination, so the retry drops it and keeps only the range.
      const { period: _period, ...range } = params
      const res = await graph<{ data?: InsightEntry[] }>(
        `${nodeId}/insights`,
        { ...range, metric: m, metric_type: 'total_value' },
        token,
      )
      absorb(res.data)
    } catch (err) {
      const ge = err as GraphError
      if (ge.isAuth) throw err
      if (!ge.isBadMetric) throw err
      // Gone in both forms — expected on a retirement, keep going.
    }
  }
  onResolved?.([...got.keys()])
  return got
}

/** Sum an insight's daily values (for metrics returned as a series). */
export function seriesTotal(e: InsightEntry | undefined): number {
  if (!e) return 0
  if (e.total_value && typeof e.total_value.value === 'number') return e.total_value.value
  return (e.values ?? []).reduce((s, v) => s + (typeof v.value === 'number' ? v.value : 0), 0)
}

/** A metric's daily values as {date -> number}, for building a 60-day curve. */
export function seriesByDate(e: InsightEntry | undefined): Map<string, number> {
  const out = new Map<string, number>()
  for (const v of e?.values ?? []) {
    if (!v.end_time || typeof v.value !== 'number') continue
    out.set(v.end_time.slice(0, 10), v.value)
  }
  return out
}

/** The first metric present from a priority list — how callers survive renames. */
export function firstOf(got: Map<string, InsightEntry>, ...names: string[]): InsightEntry | undefined {
  for (const n of names) { const e = got.get(n); if (e) return e }
  return undefined
}

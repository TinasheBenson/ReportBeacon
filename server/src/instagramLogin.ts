/**
 * Instagram API with Instagram Login — connecting an Instagram account without
 * going through Facebook at all.
 *
 * ── Why this exists alongside the Meta flow ─────────────────────────────────
 * `meta.ts` connects Instagram the long way round: Facebook Login → the Pages
 * you administer → the IG account linked to each Page. That route needs
 * `instagram_basic` and `pages_show_list` at **advanced** access, and Meta only
 * grants advanced access after Business Verification. Until then the app can
 * only authorise people who hold a role on it, so a real client cannot connect.
 *
 * Instagram Login is a separate product with its own door. The user authorises
 * on instagram.com, Instagram issues the token, and every read goes to
 * `graph.instagram.com` instead of `graph.facebook.com`. Crucially,
 * `instagram_business_basic` and `instagram_business_manage_insights` are
 * usable at **standard** access, so this works today.
 *
 * What it costs: Instagram only. No Facebook Page metrics come through this
 * door, and the account has to be a Professional (Business or Creator) account
 * — a personal Instagram account cannot be connected by any API.
 *
 * ── The credentials are not the Facebook app's ──────────────────────────────
 * This flow uses the **Instagram app id and secret**, shown on the app's
 * "API setup with Instagram login" page — different numbers from META_APP_ID
 * and META_APP_SECRET, even though they belong to the same app. Sending the
 * Facebook app id here fails with an unhelpful "Invalid platform app".
 *
 * ── Tokens ──────────────────────────────────────────────────────────────────
 * The code exchange returns a token good for about an hour. It has to be
 * swapped for a long-lived one (60 days) immediately, and refreshed before it
 * lapses or the connection dies silently two months after it was made. Both
 * steps are done here: `exchangeCode` always returns a long-lived token, and
 * `refreshIfStale` is called from the sync so a workspace that syncs at all
 * keeps working without anyone re-authorising.
 */
import { graph, GraphError, GRAPH_VERSION } from './graph.js'

// Trimmed for the same reason every other credential is: a tab pasted into a
// dashboard variable is invisible and breaks the request with no useful symptom.
const APP_ID = process.env.INSTAGRAM_APP_ID?.trim()
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET?.trim()
const API_URL = process.env.API_URL?.trim() || 'http://localhost:8080'
const REDIRECT = process.env.INSTAGRAM_REDIRECT_URI?.trim() || `${API_URL}/api/connect/instagram/callback`

/** Reads go here, not to graph.facebook.com. Versioned to match the Meta path
 *  so both move together; override only if the two ever need to diverge. */
export const IG_API_BASE = process.env.INSTAGRAM_API_BASE?.trim()
  || `https://graph.instagram.com/${GRAPH_VERSION}`

export const instagramLoginEnabled = !!(APP_ID && APP_SECRET)
export const instagramRedirectUri = REDIRECT

/**
 * The permissions this app asks for.
 *
 * `instagram_business_basic` is the profile and media. `..._manage_insights` is
 * the reach/views/interaction numbers the Social face is built on. Both are
 * available at standard access, which is the whole point of this route — do not
 * add publishing or messaging scopes here, because they are not needed and each
 * one is another thing for a user to refuse.
 */
const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights']

/** Where /connect/instagram/start sends the browser. Note the host: this dialog
 *  is served by instagram.com, not facebook.com, and the redirect_uri must be
 *  registered on the Instagram login settings page rather than under Facebook
 *  Login's Valid OAuth Redirect URIs. */
export function startAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: APP_ID!,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${params}`
}

export interface InstagramToken {
  token: string
  /** When the long-lived token lapses — 60 days out, absent if Instagram
   *  declined to say. */
  expiresAt: Date | null
  /** The Instagram user id the token is scoped to. */
  userId: string
}

async function form(url: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({})) as any
  if (!res.ok || data?.error_message || data?.error) {
    // Instagram's OAuth endpoint reports failures in three different shapes
    // depending on which stage rejected the request. Read all of them, because
    // the message is the only thing that distinguishes "wrong app id" from
    // "redirect_uri not registered" from "code already used".
    const msg = data?.error_message ?? data?.error?.message ?? data?.error_description ?? `HTTP ${res.status}`
    throw new GraphError(String(msg), res.status, data?.code, undefined, data?.error_type)
  }
  return data
}

/**
 * Authorisation code → a long-lived token, in two hops.
 *
 * Instagram appends a literal `#_` fragment to the redirect it sends the
 * browser back with. Browsers keep fragments to themselves so it usually never
 * reaches us, but it does survive some redirect chains, and a code with `#_`
 * stuck on the end is rejected as invalid — with an error that says nothing
 * about the two characters responsible. Strip it rather than debug it twice.
 */
export async function exchangeCode(code: string): Promise<InstagramToken> {
  const short = await form('https://api.instagram.com/oauth/access_token', {
    client_id: APP_ID!,
    client_secret: APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT,
    code: code.replace(/#_$/, ''),
  })

  const shortToken = String(short.access_token ?? '')
  if (!shortToken) throw new GraphError('Instagram returned no access token', 502)
  // `user_id` is the Instagram professional account's id — the node every read
  // below is made against. The separate `id` field is app-scoped and is not it.
  const userId = String(short.user_id ?? short.id ?? '')

  // The short-lived token lasts about an hour, which is not long enough to be
  // worth storing. Exchange it now so the connection is durable from the start.
  const long = await graph<{ access_token?: string; expires_in?: number }>(
    `${IG_API_BASE}/access_token`,
    { grant_type: 'ig_exchange_token', client_secret: APP_SECRET! },
    shortToken,
  )
  const token = long.access_token ?? shortToken
  const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null
  if (!long.access_token) {
    // Falling back to the short-lived token keeps the connect working, but it
    // will stop within the hour, so it must not pass unnoticed.
    console.warn('instagram: long-lived token exchange returned nothing; storing the short-lived token, which expires within the hour')
  }
  return { token, expiresAt, userId }
}

/**
 * Refresh a long-lived token if it is closer to expiry than `withinDays`.
 *
 * Instagram will only refresh a token that is at least 24 hours old and not yet
 * expired, so this is deliberately eager: a connection synced weekly still gets
 * several attempts before the 60 days run out. Returns null when nothing needed
 * doing, so the caller can skip the write.
 */
export async function refreshIfStale(
  token: string,
  expiresAt: Date | null,
  withinDays = 14,
): Promise<{ token: string; expiresAt: Date | null } | null> {
  if (expiresAt && expiresAt.getTime() - Date.now() > withinDays * 86_400_000) return null
  // An already-expired token cannot be refreshed; the user has to reconnect,
  // and the sync will report that when the read fails.
  if (expiresAt && expiresAt.getTime() <= Date.now()) return null
  const res = await graph<{ access_token?: string; expires_in?: number }>(
    `${IG_API_BASE}/refresh_access_token`,
    { grant_type: 'ig_refresh_token' },
    token,
  )
  if (!res.access_token) return null
  return {
    token: res.access_token,
    expiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000) : null,
  }
}

export interface InstagramIdentity {
  name: string
  handle: string | null
  externalId: string
  token: string
  expiresAt: Date | null
}

/**
 * Who we just connected.
 *
 * `/me` answers for whoever the token belongs to, which is why the user id from
 * the token exchange is a fallback rather than the lookup key. `name` is the
 * profile's display name and is often unset; the username always exists, so it
 * stands in — an account named "@thing" is clearer than one named "Instagram".
 */
export async function fetchIdentity(t: InstagramToken): Promise<InstagramIdentity> {
  const me = await graph<{ user_id?: string; id?: string; username?: string; name?: string; account_type?: string }>(
    `${IG_API_BASE}/me`,
    { fields: 'user_id,username,name,account_type' },
    t.token,
  )
  const externalId = String(me.user_id ?? me.id ?? t.userId ?? '')
  if (!externalId) throw new GraphError('Instagram did not identify the connected account', 502)

  // A personal account can complete this OAuth flow but serves no insights at
  // all, so it would connect and then report an empty sync forever. Say what is
  // actually wrong while the user is still in the connect flow and can fix it.
  const kind = String(me.account_type ?? '').toUpperCase()
  if (kind && kind !== 'BUSINESS' && kind !== 'MEDIA_CREATOR' && kind !== 'CREATOR') {
    throw new GraphError(
      `this Instagram account is a ${kind.toLowerCase()} account — switch it to a Professional (Business or Creator) account in the Instagram app, then connect again`,
      400,
    )
  }
  const username = me.username ? String(me.username) : null
  return {
    name: me.name?.trim() || (username ? `@${username}` : `Instagram ${externalId}`),
    handle: username ? `@${username}` : null,
    externalId,
    token: t.token,
    expiresAt: t.expiresAt,
  }
}

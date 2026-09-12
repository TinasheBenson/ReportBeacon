/**
 * Meta (Facebook + Instagram) connection and import.
 *
 * Two modes. When META_APP_ID / META_APP_SECRET are set we run the real OAuth
 * flow and fetch the connected Pages and Instagram business accounts. When they
 * are not, a stub stands in — it creates believable connected accounts and a
 * seeded 60-day history — so the connect → import → read pipeline is fully
 * exercisable before the Meta app exists. Metrics are seeded in both modes for
 * now; replacing the seed with live Graph insights is the one piece that needs a
 * real app to verify (marked TODO below), and a failed live pull falls back to
 * the seed and is recorded on the sync_run rather than breaking the connect.
 */
import crypto from 'node:crypto'
import { pool } from './db.js'
import { encrypt } from './crypto.js'

const GRAPH = 'https://graph.facebook.com/v21.0'
const APP_ID = process.env.META_APP_ID
const APP_SECRET = process.env.META_APP_SECRET
const API_URL = process.env.API_URL ?? 'http://localhost:8080'
const REDIRECT = process.env.META_REDIRECT_URI ?? `${API_URL}/api/connect/meta/callback`
export const metaEnabled = !!(APP_ID && APP_SECRET)

function db() { if (!pool) throw new Error('database not configured'); return pool }

/** Where /connect/meta/start sends the browser. Real: Meta's OAuth dialog.
 *  Stub: a local mock consent screen that returns a fake code. */
export function startAuthUrl(state: string): string {
  if (!metaEnabled) return `${API_URL}/api/connect/meta/mock?state=${encodeURIComponent(state)}`
  const scope = ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_manage_insights', 'read_insights'].join(',')
  const p = new URLSearchParams({ client_id: APP_ID!, redirect_uri: REDIRECT, state, scope, response_type: 'code' })
  return `https://www.facebook.com/v21.0/dialog/oauth?${p}`
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

// ── seeded metric generator (temporary; TODO: replace with live insights) ─────
function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646 }

async function seedMetrics(connectionId: string, seed: number) {
  const rnd = rng(seed)
  const baseFollowers = 8000 + Math.floor(rnd() * 90000)
  const baseReach = 1500 + Math.floor(rnd() * 12000)
  const values: string[] = []
  const params: any[] = []
  let i = 1
  for (let d = 59; d >= 0; d--) {
    const day = new Date(); day.setUTCDate(day.getUTCDate() - d); day.setUTCHours(0, 0, 0, 0)
    const followers = Math.round(baseFollowers * (1 + (59 - d) * 0.001))
    const reach = Math.round(baseReach * (0.7 + rnd() * 0.6))
    const impressions = Math.round(reach * (1.2 + rnd() * 0.5))
    const er = +(2.5 + rnd() * 5).toFixed(2)
    values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`)
    params.push(connectionId, day.toISOString().slice(0, 10), followers, reach, impressions, er)
  }
  await db().query(`insert into metrics_daily (connection_id,date,followers,reach,impressions,engagement_rate) values ${values.join(',')} on conflict do nothing`, params)

  const captions = ['Weekend brunch is back', 'Behind the pass', 'New drop is live', 'Your table is ready', 'Story time']
  const types = ['reel', 'image', 'carousel', 'video', 'story']
  for (let p = 0; p < 10; p++) {
    const reach = Math.round(baseReach * (0.4 + rnd() * 2.2))
    const eng = Math.round(reach * (0.03 + rnd() * 0.06))
    const posted = new Date(); posted.setUTCDate(posted.getUTCDate() - Math.floor(rnd() * 30))
    await db().query(
      `insert into posts (connection_id,external_id,type,caption,posted_at,reach,impressions,likes,comments,shares,saves,video_views)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [connectionId, `stub_${connectionId}_${p}`, types[p % types.length], captions[p % captions.length], posted.toISOString(),
        reach, Math.round(reach * 1.3), Math.round(eng * 0.7), Math.round(eng * 0.1), Math.round(eng * 0.1), Math.round(eng * 0.1),
        types[p % types.length] === 'reel' || types[p % types.length] === 'video' ? Math.round(reach * 1.7) : null],
    )
  }
}

/** The full import: identities → accounts + connections (token encrypted) →
 *  seeded metrics → a recorded sync run. Returns how many accounts landed. */
export async function importFromMeta(workspaceId: string, code: string): Promise<{ accounts: number; mode: 'live' | 'stub' }> {
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
  for (const [name, channels] of byName) {
    const handle = channels.find((c) => c.handle)?.handle ?? null
    const acct = (await db().query(
      'insert into social_accounts (workspace_id, name, handle) values ($1,$2,$3) returning id',
      [workspaceId, name, handle],
    )).rows[0]
    count++
    for (const ch of channels) {
      const conn = (await db().query(
        `insert into platform_connections (social_account_id, platform, external_id, access_token_enc, status)
         values ($1,$2,$3,$4,'connected') returning id`,
        [acct.id, ch.platform, ch.externalId, encrypt(ch.token)],
      )).rows[0]
      const run = (await db().query('insert into sync_runs (connection_id, status) values ($1,$2) returning id', [conn.id, 'running'])).rows[0]
      try {
        // TODO(live): pull real Graph insights + media here instead of seeding.
        await seedMetrics(conn.id, crypto.createHash('md5').update(conn.id).digest().readUInt32BE(0))
        await db().query('update sync_runs set status=$1, finished_at=now() where id=$2', ['ok', run.id])
      } catch (err) {
        await db().query('update sync_runs set status=$1, finished_at=now(), error=$2 where id=$3', ['error', String((err as Error).message).slice(0, 500), run.id])
      }
    }
  }
  return { accounts: count, mode }
}

/** Read: the workspace's social accounts with a per-channel summary, shaped for
 *  the Social face. Latest followers, 30-day reach, and current engagement. */
export async function listAccounts(workspaceId: string) {
  const accounts = (await db().query('select id, name, handle, niche, location from social_accounts where workspace_id=$1 order by name', [workspaceId])).rows
  const out = []
  for (const a of accounts) {
    const channels = (await db().query(
      `select pc.platform,
              (select followers from metrics_daily m where m.connection_id=pc.id order by date desc limit 1) as followers,
              (select coalesce(sum(reach),0) from metrics_daily m where m.connection_id=pc.id and date > current_date - 30) as reach_30d,
              (select round(avg(engagement_rate),2) from metrics_daily m where m.connection_id=pc.id and date > current_date - 30) as engagement_rate,
              (select count(*) from posts p where p.connection_id=pc.id) as posts
         from platform_connections pc where pc.social_account_id=$1 order by pc.platform`,
      [a.id],
    )).rows
    out.push({
      id: a.id, name: a.name, handle: a.handle, niche: a.niche, location: a.location,
      platforms: channels.map((c) => c.platform),
      followers: channels.reduce((s, c) => s + Number(c.followers ?? 0), 0),
      channels: channels.map((c) => ({
        platform: c.platform, followers: Number(c.followers ?? 0),
        reach: Number(c.reach_30d ?? 0), engagementRate: Number(c.engagement_rate ?? 0), posts: Number(c.posts ?? 0),
      })),
    })
  }
  return out
}

/**
 * Setup check — "why isn't this working?", answered in plain English.
 *
 * Deploying this app means getting a handful of separate things to agree with
 * each other: a database, an encryption key, two domains, a cookie scope, and a
 * Meta app. When one of them is wrong the symptom is usually silence — a login
 * that doesn't stick, or a Social page showing stand-in numbers — and nothing on
 * screen says which one.
 *
 * So this walks every requirement, reports pass / warn / fail, and for anything
 * that isn't passing says exactly what to change and where. It renders as a
 * readable page in a browser and as JSON to anything else.
 *
 * It requires a session: the answers describe how the deployment is wired, which
 * isn't something to hand to anonymous callers.
 */
import type { Request, Response } from 'express'
import { pool, dbConfigured, dbHealthy } from './db.js'
import { tokenKeyConfigured } from './crypto.js'
import { emailConfigured } from './email.js'
import { metaEnabled } from './meta.js'
import { instagramLoginEnabled, instagramRedirectUri, IG_API_BASE } from './instagramLogin.js'
import { GRAPH_VERSION } from './graph.js'

type Level = 'pass' | 'warn' | 'fail'
interface Check {
  name: string
  level: Level
  detail: string
  /** What to actually do about it. Empty when the check passes. */
  fix?: string
}

const prod = process.env.NODE_ENV === 'production'

function host(url: string | undefined): string | null {
  if (!url) return null
  try { return new URL(url).hostname } catch { return null }
}

/** Does `cookieDomain` actually cover both hosts? A cookie scoped to
 *  `.example.com` reaches app.example.com and api.example.com; one scoped to
 *  the wrong parent reaches neither, and login silently fails to stick. */
function domainCovers(cookieDomain: string, h: string | null): boolean {
  if (!h) return false
  const d = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain
  return h === d || h.endsWith(`.${d}`)
}

export async function buildChecks(rejectedOrigins: string[] = []): Promise<Check[]> {
  const checks: Check[] = []
  // Trimmed the same way the server reads them, so the check reports what the
  // app actually uses rather than the raw, possibly whitespace-padded value.
  const APP_URL = process.env.APP_URL?.trim()
  const API_URL = process.env.API_URL?.trim()
  const CORS = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim()
  const REDIRECT = process.env.META_REDIRECT_URI?.trim()

  // ── database ──────────────────────────────────────────────────────────────
  if (!dbConfigured) {
    checks.push({
      name: 'Database', level: 'fail',
      detail: 'No DATABASE_URL, so nothing can be saved — logins and connections will fail.',
      fix: 'In Railway, attach a Postgres database to this project and reference it from the api service as DATABASE_URL.',
    })
  } else if (!(await dbHealthy())) {
    checks.push({
      name: 'Database', level: 'fail',
      detail: 'DATABASE_URL is set but the database did not answer.',
      fix: 'Check the Postgres service is running, and that DATABASE_URL points at it (use Railway’s variable reference rather than a pasted URL).',
    })
  } else {
    const applied = (await pool!.query('select name from schema_migrations order by name')).rows.map((r) => r.name as string)
    const missing = [
      '001_init.sql', '002_password_and_app.sql', '003_live_sync.sql',
      '004_remove_demo_data.sql', '005_instagram_login.sql',
    ].filter((m) => !applied.includes(m))
    checks.push(missing.length ? {
      name: 'Database', level: 'fail',
      detail: `Connected, but these migrations have not run: ${missing.join(', ')}.`,
      fix: 'Migrations run automatically when the api service boots. Redeploy it and check the deploy log for "migrate: applied".',
    } : {
      name: 'Database', level: 'pass',
      detail: `Connected. ${applied.length} migrations applied.`,
    })
  }

  // ── token encryption ──────────────────────────────────────────────────────
  checks.push(tokenKeyConfigured ? {
    name: 'Token encryption key', level: 'pass',
    detail: 'TOKEN_ENC_KEY is set. Meta access tokens are encrypted at rest with it.',
  } : {
    name: 'Token encryption key', level: prod ? 'fail' : 'warn',
    detail: prod
      ? 'TOKEN_ENC_KEY is missing in production.'
      : 'TOKEN_ENC_KEY is unset, so a fixed development key is in use.',
    fix: 'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))" and set it as TOKEN_ENC_KEY on the api service. Do this BEFORE connecting a real Meta account — changing it afterwards makes stored tokens unreadable and forces everyone to reconnect.',
  })

  // ── the two domains and the cookie that has to span them ─────────────────
  const appHost = host(APP_URL)
  const apiHost = host(API_URL)
  if (!APP_URL || !API_URL) {
    checks.push({
      name: 'App and API URLs', level: 'fail',
      detail: `APP_URL is ${APP_URL ?? 'unset'}; API_URL is ${API_URL ?? 'unset'}.`,
      fix: 'Set both on the api service: APP_URL is where the app is served (e.g. https://app.tinashebenson.com), API_URL is this API (e.g. https://api.tinashebenson.com).',
    })
  } else {
    checks.push({ name: 'App and API URLs', level: 'pass', detail: `App at ${APP_URL}, API at ${API_URL}.` })
  }

  // A rejected origin is the single most common cause of "Failed to fetch":
  // the preflight answers 204, the real request is never sent, and nothing in
  // the browser says why.
  if (rejectedOrigins.length) {
    checks.push({
      name: 'Blocked browser origins', level: 'fail',
      detail: `This API has refused requests from: ${rejectedOrigins.join(', ')}. A front end on one of those addresses will show "Failed to fetch" on every request, including sign-in.`,
      fix: `If that address is a front end of yours, add it to CORS_ORIGINS on the api service, or add its host suffix (e.g. .vercel.app) to CORS_ORIGIN_SUFFIXES. If you did not expect it, ignore it — nothing was served to it.`,
    })
  }

  if (APP_URL && !CORS.includes(APP_URL)) {
    checks.push({
      name: 'Browser access (CORS)', level: CORS.length ? 'fail' : 'warn',
      detail: CORS.length
        ? `CORS_ORIGINS does not list ${APP_URL}, so the browser will block the app’s requests to this API.`
        : 'CORS_ORIGINS is empty, so any origin is allowed. Fine for testing, too open for production.',
      fix: `Set CORS_ORIGINS on the api service to include ${APP_URL} (comma-separated for several).`,
    })
  } else if (APP_URL) {
    checks.push({ name: 'Browser access (CORS)', level: 'pass', detail: `${APP_URL} is allowed to call this API.` })
  }

  // The single most common cause of "I log in and it forgets me".
  if (appHost && apiHost && appHost !== apiHost) {
    if (!COOKIE_DOMAIN) {
      checks.push({
        name: 'Login cookie', level: 'fail',
        detail: `The app (${appHost}) and API (${apiHost}) are on different hostnames and COOKIE_DOMAIN is unset, so the session cookie will not reach the app. Signing in will appear to do nothing.`,
        fix: 'Set COOKIE_DOMAIN on the api service to the shared parent domain, with a leading dot — e.g. .tinashebenson.com',
      })
    } else if (!domainCovers(COOKIE_DOMAIN, appHost) || !domainCovers(COOKIE_DOMAIN, apiHost)) {
      checks.push({
        name: 'Login cookie', level: 'fail',
        detail: `COOKIE_DOMAIN is "${COOKIE_DOMAIN}", which does not cover both ${appHost} and ${apiHost}.`,
        fix: 'Set it to the domain both share, with a leading dot — e.g. .tinashebenson.com',
      })
    } else {
      checks.push({ name: 'Login cookie', level: 'pass', detail: `Scoped to ${COOKIE_DOMAIN}, which covers both the app and the API.` })
    }
  } else {
    checks.push({ name: 'Login cookie', level: 'pass', detail: 'App and API share a hostname, so the session cookie needs no special scope.' })
  }

  if (prod && API_URL && !API_URL.startsWith('https://')) {
    checks.push({
      name: 'HTTPS', level: 'fail',
      detail: 'In production the session cookie is marked Secure, so it is only sent over HTTPS, but API_URL is not https.',
      fix: 'Serve the API over HTTPS and set API_URL to the https:// address.',
    })
  }

  // ── Meta ──────────────────────────────────────────────────────────────────
  if (!metaEnabled) {
    checks.push({
      name: 'Meta app', level: 'warn',
      detail: 'META_APP_ID / META_APP_SECRET are not set, so Connect runs against a built-in mock and imports sample accounts. Nothing on the Social pages will be real.',
      fix: 'Create a Meta app, then set META_APP_ID, META_APP_SECRET and META_REDIRECT_URI on the api service. See server/META_SETUP.md.',
    })
  } else {
    const configId = process.env.META_LOGIN_CONFIG_ID?.trim()
    checks.push({ name: 'Meta app', level: 'pass', detail: `Configured. Calls go to Graph ${GRAPH_VERSION}.` })
    checks.push(configId ? {
      name: 'Meta login product', level: 'pass',
      detail: `Using Facebook Login for Business with configuration ${configId}. Permissions come from that configuration in the App Dashboard, not from this server.`,
    } : {
      name: 'Meta login product', level: 'warn',
      detail: 'Sending a scope list, which is the classic Facebook Login flow. A Business-type app normally uses Facebook Login for Business, which expects a configuration id instead and will not show the permissions you expect without one.',
      fix: 'If the connect dialog refuses to load or grants no permissions: in the App Dashboard add the "Facebook Login for Business" product, create a business login configuration with the permissions listed in server/src/meta.ts (SCOPES), and set its id as META_LOGIN_CONFIG_ID on the api service. If classic Facebook Login is what the app uses, ignore this.',
    })
    const expected = `${API_URL ?? ''}/api/connect/meta/callback`
    checks.push(REDIRECT === expected ? {
      name: 'Meta redirect URI', level: 'pass', detail: REDIRECT,
    } : {
      name: 'Meta redirect URI', level: 'fail',
      detail: `META_REDIRECT_URI is "${REDIRECT ?? 'unset'}" but this API expects "${expected}". Meta rejects a mismatch, so connecting will fail.`,
      fix: `Set META_REDIRECT_URI to ${expected} on the api service AND add exactly that URL to the app’s Valid OAuth Redirect URIs in the Meta dashboard.`,
    })
  }

  if (metaEnabled && API_URL) {
    const apiHost = host(API_URL)
    checks.push({
      name: 'Meta App Domains', level: 'warn',
      detail: `Meta checks two separate things, and this one cannot be verified from here: "${apiHost}" must be listed in App Domains (App settings \u2192 Basic) as well as the callback being in Valid OAuth Redirect URIs.`,
      fix: `Subdomains are NOT covered by listing the parent domain \u2014 "${apiHost}" has to appear in its own right. Without it the dialog fails with "Can't load URL: The domain of this URL isn't included in the app's domains".`,
    })
  }

  // ── Instagram Login ───────────────────────────────────────────────────────
  // The route that does not need Business Verification. Worth reporting
  // separately from the Meta app, because an app can be configured for one and
  // not the other, and the credentials are different numbers.
  if (!instagramLoginEnabled) {
    checks.push({
      name: 'Instagram Login', level: 'warn',
      detail: 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are not set, so Instagram can only be connected through Facebook — which needs advanced access, and that needs Business Verification.',
      fix: 'In the Meta App Dashboard open Instagram \u2192 API setup with Instagram login, and copy the *Instagram* app id and secret from step 3 (they are NOT the same numbers as META_APP_ID / META_APP_SECRET). Set them as INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET on the api service.',
    })
  } else {
    checks.push({
      name: 'Instagram Login', level: 'pass',
      detail: `Configured. Reads go to ${IG_API_BASE}, and the scopes used (instagram_business_basic, instagram_business_manage_insights) work at standard access.`,
    })
    const expected = `${API_URL ?? ''}/api/connect/instagram/callback`
    checks.push(instagramRedirectUri === expected ? {
      name: 'Instagram redirect URI', level: 'pass', detail: instagramRedirectUri,
    } : {
      name: 'Instagram redirect URI', level: 'fail',
      detail: `INSTAGRAM_REDIRECT_URI is "${instagramRedirectUri}" but this API expects "${expected}".`,
      fix: `Set INSTAGRAM_REDIRECT_URI to ${expected} on the api service.`,
    })
    checks.push({
      name: 'Instagram OAuth settings', level: 'warn',
      detail: `This cannot be verified from here: "${instagramRedirectUri}" must be listed under Instagram \u2192 API setup with Instagram login \u2192 "Set up Instagram business login" as an OAuth Redirect URI.`,
      fix: 'That is a different list from Facebook Login\u2019s Valid OAuth Redirect URIs \u2014 adding the URL to one does not add it to the other. Also confirm the account being connected is a Professional (Business or Creator) Instagram account; a personal account can authorise but serves no insights.',
    })
  }

  // ── email ─────────────────────────────────────────────────────────────────
  checks.push(emailConfigured ? {
    name: 'Email', level: 'pass', detail: 'Resend is configured, so sign-in links are emailed.',
  } : {
    name: 'Email', level: 'warn',
    detail: 'No RESEND_API_KEY, so magic-link emails are written to the server log instead of sent. Email and password sign-in is unaffected.',
    fix: 'Optional. Set RESEND_API_KEY and EMAIL_FROM once you want emailed sign-in links.',
  })

  return checks
}

/** What the workspace's connections are actually producing right now. */
async function dataStatus(workspaceId: string) {
  if (!dbConfigured) return null
  const conns = (await pool!.query(
    `select pc.platform, pc.status, pc.data_source, sa.name,
            extract(epoch from (now() - pc.last_synced_at)) as synced_ago
       from platform_connections pc join social_accounts sa on sa.id = pc.social_account_id
      where sa.workspace_id = $1 order by sa.name, pc.platform`, [workspaceId])).rows
  const runs = (await pool!.query(
    `select sr.status, sr.source, sr.error, sr.metrics, sr.warnings, pc.platform, sa.name
       from sync_runs sr join platform_connections pc on pc.id = sr.connection_id
       join social_accounts sa on sa.id = pc.social_account_id
      where sa.workspace_id = $1 order by sr.started_at desc limit 6`, [workspaceId])).rows
  return {
    connections: conns.length,
    live: conns.filter((c) => c.data_source === 'live').length,
    needsReauth: conns.filter((c) => c.status === 'needs_reauth').length,
    channels: conns.map((c) => ({
      account: c.name, platform: c.platform, status: c.status, source: c.data_source,
      syncedMinAgo: c.synced_ago != null ? Math.round(Number(c.synced_ago) / 60) : null,
    })),
    recentRuns: runs,
  }
}

const COLOR: Record<Level, string> = { pass: '#15803d', warn: '#b45309', fail: '#b91c1c' }
const ICON: Record<Level, string> = { pass: '&#10003;', warn: '!', fail: '&#10007;' }
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function page(checks: Check[], data: Awaited<ReturnType<typeof dataStatus>>): string {
  const fails = checks.filter((c) => c.level === 'fail').length
  const warns = checks.filter((c) => c.level === 'warn').length
  const headline = fails
    ? `${fails} thing${fails === 1 ? '' : 's'} need${fails === 1 ? 's' : ''} fixing`
    : warns ? `Ready, with ${warns} optional item${warns === 1 ? '' : 's'}` : 'Everything checks out'

  const rows = checks.map((c) => `
    <div class="row">
      <span class="dot" style="background:${COLOR[c.level]}">${ICON[c.level]}</span>
      <div>
        <div class="name">${esc(c.name)}</div>
        <div class="detail">${esc(c.detail)}</div>
        ${c.fix ? `<div class="fix"><b>What to do:</b> ${esc(c.fix)}</div>` : ''}
      </div>
    </div>`).join('')

  let dataBlock = ''
  if (data) {
    if (!data.connections) {
      dataBlock = `<div class="row"><span class="dot" style="background:${COLOR.warn}">!</span><div>
        <div class="name">Connected accounts</div>
        <div class="detail">Nothing connected yet, so the Social pages show the demo roster.</div>
        <div class="fix"><b>What to do:</b> Open the app, go to Integrations, and press Connect.</div></div></div>`
    } else {
      const lvl: Level = data.live ? 'pass' : 'warn'
      dataBlock = `<div class="row"><span class="dot" style="background:${COLOR[lvl]}">${ICON[lvl]}</span><div>
        <div class="name">Connected accounts</div>
        <div class="detail">${data.connections} channel(s) connected; ${data.live} pulling live data from Meta${data.needsReauth ? `; ${data.needsReauth} need reconnecting` : ''}.</div>
        ${data.live ? '' : '<div class="fix"><b>What to do:</b> The numbers on screen are stand-ins. The most recent sync attempts are listed below &mdash; the error there says why the live pull did not succeed.</div>'}
        <table><tr><th>Account</th><th>Platform</th><th>Source</th><th>Synced</th></tr>
        ${data.channels.map((c) => `<tr><td>${esc(c.account)}</td><td>${esc(c.platform)}</td><td>${esc(c.source)}</td><td>${c.syncedMinAgo == null ? 'never' : c.syncedMinAgo + ' min ago'}</td></tr>`).join('')}
        </table></div></div>`
    }
    if (data.recentRuns.length) {
      dataBlock += `<h2>Recent sync attempts</h2><table class="wide">
        <tr><th>Account</th><th>Platform</th><th>Result</th><th>Metrics that answered</th><th>Problem</th></tr>
        ${data.recentRuns.map((r: any) => `<tr>
          <td>${esc(r.name)}</td><td>${esc(r.platform)}</td>
          <td>${esc(r.status)} / ${esc(r.source ?? '-')}</td>
          <td>${esc((r.metrics ?? []).join(', ') || '—')}</td>
          <td>${esc(r.error ?? ((r.warnings ?? []).join('; ') || '—'))}</td></tr>`).join('')}
        </table>`
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ReportBeacon setup check</title><style>
:root{color-scheme:light dark}
body{font:15px/1.55 system-ui,-apple-system,sans-serif;max-width:760px;margin:0 auto;padding:32px 16px;background:#fbfbfd;color:#15161c}
@media(prefers-color-scheme:dark){body{background:#131419;color:#e9e9ef}.row,table{background:#1b1c23!important;border-color:#2a2b35!important}.fix{background:#23242d!important}}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}
.sub{color:#6b6c7a;margin:0 0 22px;font-size:13.5px}
.row{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #e6e6ee;border-radius:10px;padding:13px 15px;margin-bottom:9px}
.dot{flex:none;width:20px;height:20px;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;margin-top:1px}
.name{font-weight:650;font-size:14px}
.detail{color:#4b4c5a;font-size:13.5px;margin-top:2px}
@media(prefers-color-scheme:dark){.detail{color:#a9aab8}.sub{color:#8b8c9a}}
.fix{margin-top:8px;font-size:13px;background:#f4f4f8;border-radius:7px;padding:8px 10px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px;background:#fff;border:1px solid #e6e6ee;border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:6px 9px;border-bottom:1px solid #eeeef4}th{font-weight:650;background:#f7f7fb}
@media(prefers-color-scheme:dark){th{background:#22232c}th,td{border-color:#2a2b35}}
tr:last-child td{border-bottom:none}
code{font-family:ui-monospace,monospace;font-size:12.5px}
</style></head><body>
<h1>${esc(headline)}</h1>
<p class="sub">Every requirement this deployment has, and what to change for the ones that aren&rsquo;t met.</p>
${rows}
${dataBlock ? `<h2>Your data</h2>${dataBlock}` : ''}
<p class="sub" style="margin-top:26px">Add <code>?format=json</code> for the machine-readable version.</p>
</body></html>`
}

export async function setupCheckHandler(req: Request, res: Response, workspaceId: string | null, rejectedOrigins: string[] = []) {
  const checks = await buildChecks(rejectedOrigins)
  const data = workspaceId ? await dataStatus(workspaceId).catch(() => null) : null
  const wantsJson = req.query.format === 'json' || !String(req.headers.accept ?? '').includes('text/html')
  if (wantsJson) {
    res.json({
      ok: !checks.some((c) => c.level === 'fail'),
      checks,
      data,
    })
    return
  }
  res.type('html').send(page(checks, data))
}

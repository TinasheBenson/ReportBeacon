/**
 * ReportBeacon API — the real backend behind the app's data seam.
 *
 * Email + password auth, multi-tenant workspaces, and the JSONB-backed app
 * stores (workspace state, seeded client roster, saved reports) the frontend
 * reads/writes instead of localStorage. Magic-link and Meta connect remain
 * available. Runs migrations and seeds the demo on boot.
 */
import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { dbConfigured, dbHealthy } from './db.js'
import { runMigrations } from './migrate.js'
import {
  requestMagicLink, verifyMagicLink, sessionUser, endSession, meFor, firstWorkspaceId, roleFor,
  SESSION_TTL_SECONDS, type SessionUser,
} from './auth.js'
import { registerUser, loginUser, AuthError } from './passwordAuth.js'
import {
  getWorkspaceState, putWorkspaceState, listClients,
  upsertClient, deleteClient,
  listReports, createReport, deleteReport,
} from './store.js'
import { emailConfigured } from './email.js'
import {
  metaEnabled, startAuthUrl, importFromMeta, importFromLinkedIn,
  listAccounts, syncWorkspace, listSyncRuns,
} from './meta.js'
import { linkedinEnabled, startAuthUrl as linkedinAuthUrl } from './linkedin.js'
import { signState, verifyState } from './crypto.js'
import { setupCheckHandler } from './setup.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '2mb' }))

/**
 * Read an environment variable, trimming surrounding whitespace.
 *
 * A value pasted into a dashboard can pick up a stray tab or newline, and the
 * result is a failure with no useful symptom: a tab in COOKIE_DOMAIN made the
 * cookie library reject the domain, so every sign-in returned a 500 and the app
 * said only "Could not sign in". Trimming costs nothing and removes a whole
 * class of invisible misconfiguration.
 */
function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

const prod = process.env.NODE_ENV?.trim() === 'production'
const APP_URL = env('APP_URL') ?? 'http://localhost:5173'
const COOKIE = 'rb_session'
const COOKIE_DOMAIN = env('COOKIE_DOMAIN')

/**
 * CORS. Credentialed requests need an exact Access-Control-Allow-Origin, so the
 * allow-list has to name every front end that talks to this API.
 *
 * CORS_ORIGINS holds exact origins. CORS_ORIGIN_SUFFIXES holds host suffixes
 * (e.g. ".tinashebenson.com") so a site's own subdomains work without
 * re-listing each one. A missing origin fails in a way that is near-impossible
 * to read from the browser: the preflight still answers 204, the real request
 * is never sent, and the app just says "Failed to fetch".
 *
 * Only ever suffix-match a domain you control. A shared hosting suffix such as
 * ".vercel.app" or ".netlify.app" would let *any* site on that host make
 * credentialed calls to this API and read the response with a signed-in user's
 * cookie. For a one-off preview deployment, add its exact URL to CORS_ORIGINS
 * instead.
 *
 * Which is why a rejected origin is logged, once each. Without it the only
 * evidence is an absence, and you cannot debug an absence.
 */
const origins = (env('CORS_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const originSuffixes = (env('CORS_ORIGIN_SUFFIXES') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const rejectedOrigins = new Set<string>()

function originAllowed(origin: string): boolean {
  if (origins.includes(origin)) return true
  if (!originSuffixes.length) return false
  let host: string
  try { host = new URL(origin).hostname } catch { return false }
  return originSuffixes.some((sfx) => host === sfx.replace(/^\./, '') || host.endsWith(sfx.startsWith('.') ? sfx : `.${sfx}`))
}

app.use(cors({
  credentials: true,
  origin(origin, cb) {
    // No Origin header: same-origin, curl, or a server-side call. Allow.
    if (!origin) return cb(null, true)
    // Nothing configured at all: allow any origin (dev convenience).
    if (!origins.length && !originSuffixes.length) return cb(null, true)
    if (originAllowed(origin)) return cb(null, true)
    if (!rejectedOrigins.has(origin)) {
      rejectedOrigins.add(origin)
      console.warn(`cors: rejected origin ${origin} — add it to CORS_ORIGINS, or its host suffix to CORS_ORIGIN_SUFFIXES`)
    }
    // Refuse without throwing: the browser reports the CORS failure, and the
    // rejection is now in the log above rather than invisible.
    cb(null, false)
  },
}))

function setSessionCookie(res: Response, token: string) {
  res.setHeader('set-cookie', serializeCookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: prod, path: '/',
    maxAge: SESSION_TTL_SECONDS, domain: COOKIE_DOMAIN,
  }))
}
function clearSessionCookie(res: Response) {
  res.setHeader('set-cookie', serializeCookie(COOKIE, '', {
    httpOnly: true, sameSite: 'lax', secure: prod, path: '/', maxAge: 0, domain: COOKIE_DOMAIN,
  }))
}
function readCookie(req: Request): string | undefined {
  const raw = req.headers.cookie
  return raw ? parseCookie(raw)[COOKIE] : undefined
}

declare global { // eslint-disable-next-line no-var
  namespace Express { interface Request { user?: SessionUser | null } }
}
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  try { req.user = await sessionUser(readCookie(req)) } catch { req.user = null }
  next()
})
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' })
  next()
}
/** Resolve the caller's primary workspace id or 400. */
async function scope(req: Request, res: Response): Promise<string | null> {
  const id = await firstWorkspaceId(req.user!.id)
  if (!id) { res.status(400).json({ error: 'no workspace' }); return null }
  return id
}

const started = Date.now()

app.get('/api/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'reportbeacon-api',
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
    database: dbConfigured ? (await dbHealthy() ? 'connected' : 'unreachable') : 'unconfigured',
    email: emailConfigured ? 'resend' : 'dev-console',
    time: new Date().toISOString(),
  })
})

/**
 * Setup check — every deployment requirement, pass/fail, with the fix.
 * Requires a session: it describes how this deployment is wired.
 */
app.get('/api/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    await setupCheckHandler(req, res, await firstWorkspaceId(req.user!.id), [...rejectedOrigins])
  } catch (err) {
    console.error('setup check:', err)
    res.status(500).json({ error: 'Setup check failed.' })
  }
})

// ── auth: email + password ────────────────────────────────────────────────────
async function respondWithSession(res: Response, userId: string, token: string) {
  setSessionCookie(res, token)
  const user = await sessionUser(token)
  const workspaces = await meFor(userId)
  res.json({ user, workspaces })
}

app.post('/api/auth/register', async (req: Request, res: Response) => {
  if (!dbConfigured) return res.status(503).json({ error: 'database not configured' })
  try {
    const { email, password, name } = req.body ?? {}
    const { sessionToken } = await registerUser(email, password, name ?? null)
    const who = await sessionUser(sessionToken)
    await respondWithSession(res, who!.id, sessionToken)
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    console.error('register:', err)
    res.status(500).json({ error: 'Could not create the account.' })
  }
})

app.post('/api/auth/login', async (req: Request, res: Response) => {
  if (!dbConfigured) return res.status(503).json({ error: 'database not configured' })
  try {
    const { email, password } = req.body ?? {}
    const { sessionToken } = await loginUser(email, password, req.ip ?? 'unknown')
    const who = await sessionUser(sessionToken)
    await respondWithSession(res, who!.id, sessionToken)
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    console.error('login:', err)
    res.status(500).json({ error: 'Could not sign in.' })
  }
})

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  await endSession(readCookie(req)).catch(() => {})
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, async (req: Request, res: Response) => {
  const workspaces = await meFor(req.user!.id)
  res.json({ user: req.user, workspaces })
})

// ── auth: magic link (kept) ─────────────────────────────────────────────────────
app.post('/api/auth/request', async (req: Request, res: Response) => {
  if (!dbConfigured) return res.status(503).json({ error: 'database not configured' })
  try {
    const { devLink } = await requestMagicLink(String(req.body?.email ?? ''))
    res.json({ ok: true, message: 'Check your email for a sign-in link.', ...(devLink ? { devLink } : {}) })
  } catch {
    res.status(400).json({ error: 'invalid email' })
  }
})

app.get('/api/auth/callback', async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '')
  const result = token ? await verifyMagicLink(token).catch(() => null) : null
  if (!result) return res.redirect(`${APP_URL}/app?auth=invalid`)
  setSessionCookie(res, result.sessionToken)
  res.redirect(`${APP_URL}/app`)
})

// ── app data: workspace state, clients, reports ─────────────────────────────────
app.get('/api/workspace', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  res.json({ state: await getWorkspaceState(ws) })
})

app.put('/api/workspace', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  const state = req.body?.state
  if (!state || typeof state !== 'object') return res.status(400).json({ error: 'state required' })
  await putWorkspaceState(ws, state)
  res.json({ ok: true })
})

app.get('/api/clients', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  res.json(await listClients(ws))
})

// Owner-only client editor: add/update or remove a client from the roster.
app.post('/api/clients', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  if ((await roleFor(req.user!.id, ws)) !== 'owner') return res.status(403).json({ error: 'Only the agency owner can edit clients.' })
  const client = req.body?.client
  const id = client?.id
  if (!client || typeof client !== 'object' || typeof id !== 'string' || !id) return res.status(400).json({ error: 'client with id required' })
  await upsertClient(ws, id, client, Boolean(req.body?.importable))
  res.json({ ok: true })
})

app.delete('/api/clients/:id', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  if ((await roleFor(req.user!.id, ws)) !== 'owner') return res.status(403).json({ error: 'Only the agency owner can remove clients.' })
  const ok = await deleteClient(ws, req.params.id)
  res.status(ok ? 200 : 404).json({ ok })
})

app.get('/api/reports', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  res.json({ reports: await listReports(ws) })
})

app.post('/api/reports', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ error: 'name required' })
  const config = (req.body?.config && typeof req.body.config === 'object') ? req.body.config : {}
  res.json({ report: await createReport(ws, req.user!.id, name, config) })
})

app.delete('/api/reports/:id', requireAuth, async (req: Request, res: Response) => {
  const ws = await scope(req, res); if (!ws) return
  const ok = await deleteReport(ws, req.params.id)
  res.status(ok ? 200 : 404).json({ ok })
})

// ── Meta connect (kept) ──────────────────────────────────────────────────────
app.get('/api/connect/meta/start', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = await firstWorkspaceId(req.user!.id)
  if (!workspaceId) return res.status(400).json({ error: 'no workspace' })
  const state = signState({ w: workspaceId, u: req.user!.id })
  res.redirect(startAuthUrl(state))
})

app.get('/api/connect/meta/callback', async (req: Request, res: Response) => {
  const state = verifyState<{ w: string }>(String(req.query.state ?? ''))
  const code = String(req.query.code ?? '')
  if (!state || !code) return res.redirect(`${APP_URL}/app/social/integrations?connect=invalid`)
  try {
    const { accounts, live } = await importFromMeta(state.w, code)
    res.redirect(`${APP_URL}/app/social/integrations?connected=meta&accounts=${accounts}&live=${live}`)
  } catch (err) {
    console.error('meta import:', err)
    res.redirect(`${APP_URL}/app/social/integrations?connect=error`)
  }
})

// ── LinkedIn connect ─────────────────────────────────────────────────────────
// Mirrors the Meta flow. LinkedIn's Community Management API is a vetted
// product, so until the app is approved these endpoints exist but every call
// fails at LinkedIn's end rather than ours.
app.get('/api/connect/linkedin/start', requireAuth, async (req: Request, res: Response) => {
  if (!linkedinEnabled) {
    return res.redirect(`${APP_URL}/app/social/integrations?connect=linkedin-unconfigured`)
  }
  const workspaceId = await firstWorkspaceId(req.user!.id)
  if (!workspaceId) return res.status(400).json({ error: 'no workspace' })
  res.redirect(linkedinAuthUrl(signState({ w: workspaceId, u: req.user!.id })))
})

app.get('/api/connect/linkedin/callback', async (req: Request, res: Response) => {
  const state = verifyState<{ w: string }>(String(req.query.state ?? ''))
  const code = String(req.query.code ?? '')
  // LinkedIn reports a refusal on the query string rather than by status.
  const denied = String(req.query.error ?? '')
  if (denied) return res.redirect(`${APP_URL}/app/social/integrations?connect=denied`)
  if (!state || !code) return res.redirect(`${APP_URL}/app/social/integrations?connect=invalid`)
  try {
    const { accounts, live } = await importFromLinkedIn(state.w, code)
    res.redirect(`${APP_URL}/app/social/integrations?connected=linkedin&accounts=${accounts}&live=${live}`)
  } catch (err) {
    console.error('linkedin import:', err)
    // The message is the useful part here — "administers no company pages" and
    // "not approved for this API" need different actions from the user.
    const msg = encodeURIComponent(String((err as Error).message).slice(0, 200))
    res.redirect(`${APP_URL}/app/social/integrations?connect=error&reason=${msg}`)
  }
})

app.get('/api/social/accounts', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = await firstWorkspaceId(req.user!.id)
  if (!workspaceId) return res.json({ accounts: [], connected: false })
  const accounts = await listAccounts(workspaceId)
  res.json({
    accounts,
    connected: accounts.length > 0,
    // Whether a Meta app is configured at all, and whether these particular
    // numbers came from it — the UI labels seeded data rather than passing it
    // off as real.
    metaConfigured: metaEnabled,
    linkedinConfigured: linkedinEnabled,
    source: accounts.some((a) => a.dataSource === 'live') ? 'live' : 'none',
  })
})

// Refresh the numbers without sending the user back through OAuth.
app.post('/api/social/sync', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = await firstWorkspaceId(req.user!.id)
  if (!workspaceId) return res.status(400).json({ error: 'no workspace' })
  if ((await roleFor(req.user!.id, workspaceId)) === 'viewer') {
    return res.status(403).json({ error: 'Viewers cannot trigger a sync.' })
  }
  try {
    const result = await syncWorkspace(workspaceId)
    res.json({ ok: true, ...result, accounts: await listAccounts(workspaceId) })
  } catch (err) {
    console.error('social sync:', err)
    res.status(500).json({ error: 'Sync failed.' })
  }
})

// The audit trail: what each run fetched, which metrics answered, what didn't.
app.get('/api/social/sync-runs', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = await firstWorkspaceId(req.user!.id)
  if (!workspaceId) return res.json({ runs: [] })
  res.json({ runs: await listSyncRuns(workspaceId) })
})

const port = Number(process.env.PORT) || 8080
runMigrations()
  .catch((e) => console.error('boot (migrate) failed:', e))
  .finally(() => {
    app.listen(port, () => console.log(`reportbeacon-api on :${port} (database ${dbConfigured ? 'configured' : 'unconfigured'}, email ${emailConfigured ? 'resend' : 'dev'})`))
  })

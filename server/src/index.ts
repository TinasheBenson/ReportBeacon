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
  requestMagicLink, verifyMagicLink, sessionUser, endSession, meFor, firstWorkspaceId,
  SESSION_TTL_SECONDS, type SessionUser,
} from './auth.js'
import { registerUser, loginUser, AuthError } from './passwordAuth.js'
import { seedDemo } from './seed.js'
import {
  getWorkspaceState, putWorkspaceState, listClients, seedClientsForWorkspace,
  listReports, createReport, deleteReport,
} from './store.js'
import { emailConfigured } from './email.js'
import { metaEnabled, startAuthUrl, importFromMeta, listAccounts } from './meta.js'
import { signState, verifyState } from './crypto.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '2mb' }))

const prod = process.env.NODE_ENV === 'production'
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'
const COOKIE = 'rb_session'
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined

const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
app.use(cors({ origin: origins.length ? origins : true, credentials: true }))

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
  await seedClientsForWorkspace(ws).catch(() => {}) // heal older workspaces
  res.json(await listClients(ws))
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

app.get('/api/connect/meta/mock', (req: Request, res: Response) => {
  const state = String(req.query.state ?? '')
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Authorize (mock)</title>
    <div style="font-family:system-ui;max-width:420px;margin:80px auto;padding:24px;border:1px solid #e5e5ef;border-radius:14px">
      <h2 style="margin:0 0 8px">Connect Meta <span style="font:600 11px system-ui;color:#fff;background:#c2410c;padding:2px 7px;border-radius:6px;vertical-align:middle">MOCK</span></h2>
      <p style="color:#556;font-size:14px">No Meta app is configured, so this stands in for Facebook's consent screen. Authorizing imports sample connected accounts.</p>
      <a href="/api/connect/meta/callback?code=mock-code&state=${encodeURIComponent(state)}"
         style="display:inline-block;background:#1877f2;color:#fff;text-decoration:none;font:600 14px system-ui;padding:10px 16px;border-radius:8px">Authorize ReportBeacon</a>
    </div>`)
})

app.get('/api/connect/meta/callback', async (req: Request, res: Response) => {
  const state = verifyState<{ w: string }>(String(req.query.state ?? ''))
  const code = String(req.query.code ?? '')
  if (!state || !code) return res.redirect(`${APP_URL}/app/social/integrations?connect=invalid`)
  try {
    const { accounts } = await importFromMeta(state.w, code)
    res.redirect(`${APP_URL}/app/social/integrations?connected=meta&accounts=${accounts}`)
  } catch (err) {
    console.error('meta import:', err)
    res.redirect(`${APP_URL}/app/social/integrations?connect=error`)
  }
})

app.get('/api/social/accounts', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = await firstWorkspaceId(req.user!.id)
  if (!workspaceId) return res.json({ accounts: [] })
  res.json({ accounts: await listAccounts(workspaceId), source: metaEnabled ? 'meta' : 'stub' })
})

const port = Number(process.env.PORT) || 8080
runMigrations()
  .then(() => seedDemo())
  .catch((e) => console.error('boot (migrate/seed) failed:', e))
  .finally(() => {
    app.listen(port, () => console.log(`reportbeacon-api on :${port} (database ${dbConfigured ? 'configured' : 'unconfigured'}, email ${emailConfigured ? 'resend' : 'dev'})`))
  })

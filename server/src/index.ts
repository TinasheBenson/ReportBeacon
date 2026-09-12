/**
 * ReportBeacon API — the real backend behind the app's lib/api.ts seam.
 *
 * M1: magic-link auth, multi-tenant workspaces, and /api/me. Runs migrations on
 * boot. The social data endpoints stay 501 until M2 wires real Meta data.
 */
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { dbConfigured, dbHealthy } from './db.js'
import { runMigrations } from './migrate.js'
import {
  requestMagicLink, verifyMagicLink, sessionUser, endSession, meFor,
  SESSION_TTL_SECONDS, type SessionUser,
} from './auth.js'
import { emailConfigured } from './email.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json())

const prod = process.env.NODE_ENV === 'production'
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'
const COOKIE = 'rb_session'
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined

// The demo and the product frontend call this API from another origin; reflect
// known origins and allow credentials so the session cookie rides along.
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

// Attach the current user (or null) to every request.
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

// ── auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/request', async (req: Request, res: Response) => {
  if (!dbConfigured) return res.status(503).json({ error: 'database not configured' })
  const email = String(req.body?.email ?? '')
  try {
    const { devLink } = await requestMagicLink(email)
    // Always the same response, so the endpoint can't be used to probe accounts.
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

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  await endSession(readCookie(req)).catch(() => {})
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, async (req: Request, res: Response) => {
  const workspaces = await meFor(req.user!.id)
  res.json({ user: req.user, workspaces })
})

// ── data endpoints (M2+) ─────────────────────────────────────────────────────
const NOT_YET = (name: string) => (_req: Request, res: Response) =>
  res.status(501).json({ error: 'not_implemented', endpoint: name, note: 'See server/SCOPE.md' })

app.get('/api/social/accounts', requireAuth, NOT_YET('GET /api/social/accounts'))
app.get('/api/social/accounts/:id', requireAuth, NOT_YET('GET /api/social/accounts/:id'))
app.get('/api/connect/meta/start', requireAuth, NOT_YET('GET /api/connect/meta/start'))
app.get('/api/connect/meta/callback', NOT_YET('GET /api/connect/meta/callback'))

const port = Number(process.env.PORT) || 8080
runMigrations()
  .catch((e) => console.error('migrate failed:', e))
  .finally(() => {
    app.listen(port, () => console.log(`reportbeacon-api on :${port} (database ${dbConfigured ? 'configured' : 'unconfigured'}, email ${emailConfigured ? 'resend' : 'dev'})`))
  })

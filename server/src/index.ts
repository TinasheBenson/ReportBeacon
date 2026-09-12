/**
 * ReportBeacon API — the real backend behind the app's lib/api.ts seam.
 *
 * This is the deployable skeleton: it boots on Railway, reports health
 * (including database connectivity), and exposes the endpoint surface the
 * frontend already names in lib/api.ts. The data endpoints are stubbed 501
 * until the schema and the first platform integration (Meta) are signed off —
 * see server/SCOPE.md. Nothing here assumes a schema or an auth model yet, so
 * the service can run before those decisions land.
 */
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { dbConfigured, dbHealthy } from './db.js'

const app = express()
app.use(express.json())

// The demo (Vercel) and, later, the product frontend call this API from another
// origin. Lock this to known origins once the product domain is fixed.
const origins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors({ origin: origins.length ? origins : true, credentials: true }))

const started = Date.now()

app.get('/api/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'reportbeacon-api',
    version: process.env.npm_package_version ?? '0.1.0',
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
    database: dbConfigured ? (await dbHealthy() ? 'connected' : 'unreachable') : 'unconfigured',
    time: new Date().toISOString(),
  })
})

// Endpoint surface mirrors lib/api.ts. Each returns 501 until it is built
// against a real schema + Meta data. Kept explicit so the contract is visible.
const NOT_YET = (name: string) => (_req: Request, res: Response) =>
  res.status(501).json({ error: 'not_implemented', endpoint: name, note: 'See server/SCOPE.md' })

app.get('/api/clients', NOT_YET('GET /api/clients'))
app.get('/api/clients/:id', NOT_YET('GET /api/clients/:id'))
app.get('/api/social/accounts', NOT_YET('GET /api/social/accounts'))
app.get('/api/social/accounts/:id', NOT_YET('GET /api/social/accounts/:id'))
app.get('/api/alerts', NOT_YET('GET /api/alerts'))

// Meta (Facebook + Instagram) OAuth — the first real integration. Stubbed until
// the Meta app and its credentials exist (SCOPE.md lists what's needed).
app.get('/api/connect/meta/start', NOT_YET('GET /api/connect/meta/start'))
app.get('/api/connect/meta/callback', NOT_YET('GET /api/connect/meta/callback'))

const port = Number(process.env.PORT) || 8080
app.listen(port, () => {
  console.log(`reportbeacon-api listening on :${port} (database ${dbConfigured ? 'configured' : 'unconfigured'})`)
})

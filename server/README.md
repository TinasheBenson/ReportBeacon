# ReportBeacon API

The real backend behind the app's `src/lib/api.ts` seam, deployed on Railway.
This is the deployable skeleton: it boots, reports health, and exposes the
endpoint surface the frontend already names. Data endpoints return `501` until
the schema and the first platform integration are signed off (see `SCOPE.md`).

The frontend demo on Vercel keeps running unchanged on localStorage. This
service is a separate deployment that the product build talks to.

## Run locally

```bash
cd server
cp .env.example .env      # optional; the API boots without a database
npm install
npm run dev               # http://localhost:8080/api/health
```

`GET /api/health` reports `database: "unconfigured"` until `DATABASE_URL` is set.

## Deploy on Railway

1. New project, "Deploy from GitHub repo", pick `reporting-dashboard-demo`.
2. Set the service **Root Directory** to `server`. Railway auto-detects Node
   (Nixpacks), runs `npm install`, then `npm start`. `railway.json` sets the
   health check to `/api/health`.
3. Add a **Postgres** plugin to the project. Railway injects `DATABASE_URL`
   into the service automatically; redeploy and health flips to `connected`.
4. Set service variables from `.env.example` (`CORS_ORIGINS`, and the Meta app
   values when that integration is built).

The Vercel demo stays as-is. Point the product frontend at this service with a
`VITE_API_BASE` env var once the data endpoints are live.

## Endpoints

Live now (M1):

- `GET /api/health` — status, database and email transport.
- `POST /api/auth/request` — `{ email }`, sends a magic link (dev: logged to console).
- `GET /api/auth/callback?token=…` — verifies, sets the session cookie, redirects to the app.
- `POST /api/auth/logout` — ends the session.
- `GET /api/me` — the signed-in user and their workspaces (401 when signed out).

Stubbed `501` until M2 (real Meta data):

- `GET /api/social/accounts`, `GET /api/social/accounts/:id`
- `GET /api/connect/meta/start`, `GET /api/connect/meta/callback`

## Database

Schema lives in `migrations/*.sql`; `runMigrations()` runs on boot (and
`npm run migrate` runs it standalone). Multi-tenant: a `workspace` is the tenant
boundary and every data row carries a `workspace_id`. Auth is magic-link with
server sessions; only hashes of link tokens and session tokens are stored.

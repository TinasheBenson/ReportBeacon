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

## Endpoint surface

Mirrors `src/lib/api.ts`. All data routes are `501` until built:

- `GET /api/health` — live now.
- `GET /api/clients`, `GET /api/clients/:id`
- `GET /api/social/accounts`, `GET /api/social/accounts/:id`
- `GET /api/alerts`
- `GET /api/connect/meta/start`, `GET /api/connect/meta/callback` — first real integration.

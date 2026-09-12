# Deploying the API to Railway

~10 minutes. This puts the backend online at a public HTTPS URL so Meta's OAuth
can reach it and real logins work. The demo on Vercel is untouched.

## 1. Create the service

1. On **railway.app**, New Project → **Deploy from GitHub repo** →
   `tinashe-benson/reporting-dashboard-demo`.
2. Open the service → **Settings → Root Directory** = `server`. Railway
   auto-detects Node, runs `npm install`, then `npm start`. `railway.json` sets
   the health check to `/api/health`.

## 2. Add the database

3. In the project, **New → Database → PostgreSQL**. Railway injects
   `DATABASE_URL` into the service automatically. Migrations run on the next
   boot; health flips to `database: connected`.

## 3. Set environment variables

Service → **Variables**. Public/config values are fine to type here; the two
marked secret are passwords — set them here and nowhere else (never in the repo
or in chat).

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://app.tinashebenson.com` |
| `API_URL` | `https://api.tinashebenson.com` |
| `CORS_ORIGINS` | `https://app.tinashebenson.com,https://demo.tinashebenson.com` |
| `COOKIE_DOMAIN` | `.tinashebenson.com` |
| `TOKEN_ENC_KEY` *(secret)* | a fresh 32-byte base64 key (below) |
| `META_APP_ID` | your Meta App ID |
| `META_APP_SECRET` *(secret)* | from your Meta app → Settings → Basic |
| `META_REDIRECT_URI` | `https://api.tinashebenson.com/api/connect/meta/callback` |
| `RESEND_API_KEY` | from resend.com (needed for real login emails) |
| `EMAIL_FROM` | `ReportBeacon <login@tinashebenson.com>` |

Generate the encryption key locally and paste the output as `TOKEN_ENC_KEY`:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Without `RESEND_API_KEY` the magic link is written to the server log instead of
emailed, which is fine for a first smoke test but not for real users. A Resend
account is free to start and needs `tinashebenson.com` verified for sending.

## 4. Domains

4. Service → **Settings → Networking → Custom Domain**, add
   `api.tinashebenson.com`. Railway shows a CNAME target; add that CNAME at your
   DNS provider. Point `app.tinashebenson.com` at wherever the product frontend
   will live (that deploy comes with the frontend wiring).

## Check it

- `https://api.tinashebenson.com/api/health` → `database: connected`,
  `email: resend` (or `dev-console` if Resend isn't set yet).

## Then go live with Meta

Once deployed, in the Meta app make sure the redirect URI matches
`https://api.tinashebenson.com/api/connect/meta/callback`, and that you and any
first clients have a role on the app (dev mode). The connect flow switches from
stub to live automatically because `META_APP_ID` / `META_APP_SECRET` are set.

# Deploying the frontend to Railway

The API deploy is documented in [`server/DEPLOY.md`](server/DEPLOY.md). This is
the app itself — the Vite/React build served as a static SPA at
`app.tinashebenson.com`, talking to the API at `api.tinashebenson.com`.

## Before anything else: rotate `TOKEN_ENC_KEY`

Do this **before connecting a real Meta account**, not after.

Platform access tokens are encrypted at rest with `TOKEN_ENC_KEY`. A key that
has been pasted into a chat should be treated as burned. Rotating it *after* an
account is connected makes the stored tokens undecryptable and forces everyone
to reconnect; rotating now, while nothing real is encrypted, costs nothing.

1. Generate one locally — not in a chat window:
   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Set it as `TOKEN_ENC_KEY` on the Railway **api** service (Variables). Do not
   commit it.
3. Let the service redeploy and confirm `GET /api/health` still reports
   `"database":"connected"`.

## 1. Create the service

In the **same Railway project** as the API:

- **New service → GitHub repo →** this repository.
- **Root directory:** `/` (the repo root — *not* `server`).

The repo root ships a `railway.json` that Railway picks up:

```json
{ "build": { "builder": "NIXPACKS", "buildCommand": "npm run build" },
  "deploy": { "startCommand": "npm start" } }
```

`npm start` runs `serve -s dist -l $PORT`. The `-s` flag is what makes this an
SPA host: any unknown path returns `index.html` so react-router deep links such
as `/app/social/integrations` work on a hard refresh, instead of 404ing.

## 2. Set the build-time variable

Vite inlines `import.meta.env.VITE_*` **at build time**, so this has to be a
service variable before the build runs, not a runtime one:

```
VITE_API_BASE=https://api.tinashebenson.com
```

Leave it unset and the app calls same-origin `/api/...`, which is what the
zero-backend Vercel demo wants — so the same commit serves both.

## 3. Custom domain

- Add `app.tinashebenson.com` under the service's **Networking → Custom domain**.
- Add the CNAME Railway shows at the DNS provider for `tinashebenson.com`.

The API side already lines up: `CORS_ORIGINS` includes
`https://app.tinashebenson.com`, and `COOKIE_DOMAIN=.tinashebenson.com` means
the session cookie set by `api.` is sent to `app.`.

## 4. Check it

1. Open `https://app.tinashebenson.com` and sign in.
2. **Integrations → Connect** (Instagram or Facebook) and authorise with a Meta
   account that has a role on the app — dev mode only covers those.
3. The badge at the top of Social overview should read **Live**. If it reads
   **Sample data**, the connect worked but the numbers are stand-ins — see
   below.

## When the badge says "Sample data"

That label is deliberate: connected accounts whose live pull did not succeed
show seeded numbers rather than silently presenting fiction as fact. To find
out why, read the audit trail:

```sh
curl -s https://api.tinashebenson.com/api/social/sync-runs -H "Cookie: rb_session=..."
```

Each run records `status`, `source` (`live` or `seed`), the `metrics` that
actually resolved, and any `warnings`. Common causes:

- **`token rejected — reconnect required`** — the page token expired or the
  permission was revoked. The channel is flagged `needs_reauth`; reconnect.
- **`no reach/views metric available on this Graph version`** — Meta retired the
  metric names this version serves. Set `META_GRAPH_VERSION` to a current
  version and sync again.
- **`live pull returned no data for this window`** — the account genuinely has
  no activity in the last 60 days, or the IG account is not a Business/Creator
  account (personal accounts have no insights).

`POST /api/social/sync` re-pulls without another trip through OAuth.

# Backend scope — decisions to lock before building

This is the brief to react to. It proposes the architecture, the database
schema, the auth model, and the first real integration, and lists what I need
from you. Nothing in the app's data logic is built against these choices yet, so
they are cheap to change now and expensive to change later. Mark each open
decision and I will build to it.

## Decisions (locked)

- **Auth:** email magic link, via Resend, with a dev transport that logs the link
  to the console so it builds and tests without an email provider. Server
  sessions in an httpOnly cookie.
- **First integration:** Meta (Facebook + Instagram) at M2.
- **Domains:** `app.tinashebenson.com` (product) and `api.tinashebenson.com`
  (this API). Demo stays on `demo.tinashebenson.com`.
- **Deployment:** demo stays on Vercel (sample data); product is a separate
  Railway deployment on real data. One frontend, an env flag switches the
  `lib/api.ts` seam.
- **Tenancy:** multi-tenant, pooled. A `workspace` is the tenant boundary; every
  data row carries a `workspace_id`; users reach a workspace only via a
  `membership`. Schema shipped as proposed below.

**M1 is built and verified** (magic-link auth, multi-tenant workspaces,
`/api/me`, migrations). Outstanding from you, at deploy/M2 time only: a Meta
developer app (App ID + Secret) and DNS for the two subdomains; a Resend API key
when you want real emails instead of the dev console.

## 1. The shape of the thing

Two deployments, one frontend codebase:

- **Demo** (Vercel, localStorage) stays exactly as it is. It is the sales tool:
  open, rebrand live, no login. We do not touch it.
- **Product** (Railway) is this API plus Postgres, with the same frontend built
  with `VITE_API_BASE` pointing at it. The `lib/api.ts` seam flips each read
  from localStorage to `fetch`. The store and UI above it do not change.

Railway is the right host here specifically because the product needs a
long-running server, a database, and a background sync worker. The demo does
not, which is why it stays on Vercel.

## 2. First real value: Meta, not a mock

The first endpoint to build is **not** the demo data re-served behind an API
(that adds latency and a server to babysit with no new value). It is a real
Instagram + Facebook connection through the Meta Graph API: OAuth in, store the
token, pull real reach / engagement / post metrics, show them in the Social
face that already exists. One platform, end to end. It proves the whole
pipeline and is something a prospect cannot get anywhere else.

Meta first because it covers two of the four platforms. TikTok and LinkedIn
follow the same pattern once Meta is proven.

## 3. Proposed database schema (Postgres)

Minimal, and shaped to grow. Names are proposals.

- **users** — `id`, `email`, `name`, `created_at`. A real person who logs in.
- **workspaces** — `id`, `agency_name`, `logo_url`, `brand` (jsonb: the per-face
  palette we already model), `created_at`. One agency.
- **memberships** — `user_id`, `workspace_id`, `role` (`owner|manager|viewer`).
  Maps the seats/RBAC the app already has onto real users.
- **social_accounts** — `id`, `workspace_id`, `name`, `handle`, `niche`,
  `location`, `created_at`. A managed brand/creator.
- **platform_connections** — `id`, `social_account_id`, `platform`
  (`instagram|facebook|tiktok|linkedin`), `external_id`, `access_token`
  (encrypted at rest), `token_expires_at`, `scopes`, `status`, `connected_at`.
- **metrics_daily** — `platform_connection_id`, `date`, `followers`, `reach`,
  `impressions`, `engagement_rate`, ... One row per channel per day. This is the
  60-day series the charts already read.
- **posts** — `id`, `platform_connection_id`, `external_id`, `type`, `caption`,
  `posted_at`, `reach`, `impressions`, `likes`, `comments`, `shares`, `saves`,
  `video_views`.
- **sync_runs** — `id`, `platform_connection_id`, `started_at`, `finished_at`,
  `status`, `error`. So a failed pull is visible, not silent.

Alerts and recommendations stay **computed**, not stored: the engines in
`lib/alerts.ts` and `lib/social.ts` run over the rows above. No schema for them.

Tokens are the one hard security requirement: encrypted at rest, never sent to
the browser, refreshed by the worker before expiry.

## 4. Auth model — needs your call

Three options, in order of my preference:

1. **Email magic link** (recommended). No passwords to store or leak, low
   friction, fits an agency tool. Needs a transactional email sender.
2. **OAuth sign-in with Google.** Zero password handling, but ties every user
   to a Google account.
3. **Email + password.** Familiar, but you own password storage, resets, and
   breach risk. I would avoid it.

Sessions as httpOnly cookies either way. The seat picker in the demo becomes a
real login in the product; roles map straight onto `memberships`.

## 5. Sync worker

A scheduled job (Railway cron or a small worker service) that, per connection,
pulls the latest metrics and posts from the platform API, writes `metrics_daily`
and `posts`, refreshes tokens, and records a `sync_run`. Start at every 6 hours;
tune to each platform's rate limits.

## 6. Milestones

1. **M0 — skeleton (done):** service boots on Railway, `/api/health` green,
   Postgres attachable.
2. **M1 — auth + workspace (done):** magic-link login, `users` / `workspaces` /
   `memberships` / `sessions`, `/api/me`, migrations on boot. Verified end to end
   against Postgres. Frontend seat picker becomes a real login behind the flag
   (that wiring is a frontend task, tracked for when the product build turns on).
3. **M2 — Meta connect (built; stub-verified, live pending your app):** OAuth
   start/callback with a CSRF-signed state, `platform_connections` with
   AES-256-GCM encrypted tokens, an import that lands accounts + channels + a
   seeded 60-day history, and `GET /api/social/accounts` reading it back,
   workspace-scoped. Runs in a stub (sample accounts) until META_APP_ID /
   META_APP_SECRET are set; the real Graph path is written and needs a live app
   to verify. See `META_SETUP.md`. Remaining live-only piece: swap the seeded
   metrics for real Graph insights.
4. **M3 — sync worker + real Social face:** scheduled pulls populate
   `metrics_daily` / `posts`; `lib/api.ts` social reads switch to the API for a
   product build. Demo untouched.
5. **M4 — TikTok + LinkedIn** on the same pattern.

## 7. What I need from you

- [ ] Auth model: magic link (rec) / Google / password?
- [ ] A Meta developer app (I'll list exact steps), or confirm you'll create it
      so I can wire `META_APP_ID` / `META_APP_SECRET` / redirect URI.
- [ ] Product domain for the app + API (e.g. `app.` and `api.tinashebenson.com`)
      so CORS and the OAuth redirect are fixed.
- [ ] Confirm the demo stays on Vercel and the product is a separate Railway
      deployment (vs. moving everything).
- [ ] Anything in the schema above you want different.

Answer these and M1 starts against real decisions instead of guesses.

# Meta app setup (Facebook + Instagram)

> **Connecting Instagram only?** You probably want
> [`INSTAGRAM_SETUP.md`](./INSTAGRAM_SETUP.md) instead. The route below needs
> advanced access, and that needs Business Verification; Instagram Login does
> not. This document is what you need for **Facebook Pages**, and for having
> Instagram and its Page arrive together.

This is the one thing only you can do. It gets us an **App ID** and **App
Secret** so ReportBeacon can pull real Instagram and Facebook numbers. About 15
minutes. Until it's done, Connect has nothing to connect to — there is no stub
and no sample data, so the Social pages stay empty rather than showing figures
that did not come from anywhere.

## Before you start

The Instagram accounts you want to report on must be **Business or Creator**
accounts, each connected to a **Facebook Page**. That's how Meta exposes
Instagram insights. Personal IG accounts won't work (this is Meta's rule, not
ours).

## Steps

1. Go to **developers.facebook.com**, log in, and accept the developer terms if
   prompted.
2. **My Apps → Create App.** Choose use case **"Other" → Business**. Name it
   `ReportBeacon`, set a contact email, create.
3. In the app, **Add products** and add **Facebook Login for Business**.
4. **App settings → Basic.** Copy the **App ID** and **App Secret** (click Show).
   Fill in a Privacy Policy URL (your site is fine) and add **App Domain**
   `api.tinashebenson.com`. Save.
5. **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**, add:
   - `https://api.tinashebenson.com/api/connect/meta/callback`
   - `http://localhost:8080/api/connect/meta/callback` (for local testing)
6. **Permissions.** The connect flow requests these scopes:
   `pages_show_list`, `pages_read_engagement`, `instagram_basic`,
   `instagram_manage_insights`, `read_insights`. While the app is in
   **Development mode** these work immediately for anyone with a role on the app
   (below), no review needed.
7. **App roles → Roles.** Add yourself, and add each client whose accounts
   you'll connect, as **Administrators or Testers**. In Development mode only
   people with a role can authorize, which is exactly what you want for the
   first clients.

## Hand it over

Send me:

- **META_APP_ID** — fine to paste here.
- **META_APP_SECRET** — do **not** paste it in chat. Set it directly in Railway's
  service variables (or send it through something secure). Treat it like a
  password.
- Confirm the redirect URI above matches.

I'll set `META_APP_ID`, `META_APP_SECRET` and `META_REDIRECT_URI`. We test with
one of your real accounts, and I tune the live insights pull against real
responses.

## One thing to know about going wide

Development mode is perfect for you and your first clients. To let **any** client
connect their accounts (public launch), Meta requires **App Review** for those
permissions plus **Business Verification**. That takes days to weeks and is a
separate step we plan when you're ready to open it up. It does not block
building, testing, or onboarding your first clients as app testers.

## What the live pull actually asks Meta for

Once `META_APP_ID` / `META_APP_SECRET` are set, `server/src/metaInsights.ts`
pulls a 60-day window per connected channel and writes it into `metrics_daily`
and `posts`.

**Instagram** (business/creator account, page token):
- `followers_count` — a field on the account node, not an insight.
- `/insights?period=day` for `reach`, `views`, `follower_count`,
  `total_interactions`, in 30-day chunks (Meta caps the window).
- `/media` plus per-media `/insights` for `reach`, `views`, `saved`, `shares`.

**Facebook Page** (page token):
- `followers_count` on the page node (falling back to `fan_count`).
- `/insights?period=day` for reach, views, interactions and follows.
- `/posts` plus per-post `/insights`.

Follower history is reconstructed by walking today's total backwards through the
daily net-new series, because Meta reports the current total plus deltas rather
than a curve. Engagement rate is engagement ÷ reach × 100 — the same definition
the UI reads — computed from the account-level interactions series, or folded
from post engagement when that series isn't available.

### Metric names move, so the code treats them as candidates

Meta retires insights metrics on a rolling schedule, and a request naming one
retired metric fails *whole* — healthy metrics in the same call are lost with
it. Two changes matter here:

- **Instagram**: `impressions` and `plays` gave way to `views` in **v22.0**
  (April 2025). Requests for `impressions` now error rather than degrade.
- **Pages**: `page_impressions` and `page_fans` were retired from **15 November
  2025**, with further Page and Post metrics removed through 2026, in favour of
  views/follows-style metrics.

So each logical field is a *priority list* of candidate metric names. The batch
request is tried first; if Meta rejects it for a dead metric, the code falls back
to asking per metric and keeps the survivors. A deprecation costs one field
rather than the whole sync.

Two things follow from that:

- `META_GRAPH_VERSION` (default `v23.0`) is env-configurable. Bump it when Meta
  sunsets the pinned version.
- `GET /api/social/sync-runs` reports, per run, which metric names actually
  answered and what warned. **Check it after the first real connect** — it is how
  you tell a genuine zero from a metric that quietly stopped existing.

### Proving the numbers are real

1. Connect with an account that has a role on the app (dev mode covers only those).
2. `GET /api/social/accounts` — `source` should be `live`, and the account names
   should be your real Pages/IG profiles.
3. `GET /api/social/sync-runs` — the newest runs should read `status: ok`,
   `source: live`, with a non-empty `metrics` array.
4. Spot-check one figure against Meta's own Insights UI before sending a client
   report off the back of it.

If the Social pages are empty after a successful connect, the pull returned
nothing and the sync run says why. That is intentional: a failed pull stores
nothing rather than filling the gap, because a stand-in that reaches a client
report is worse than a gap that is obviously a gap.

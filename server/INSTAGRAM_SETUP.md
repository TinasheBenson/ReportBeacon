# Instagram setup (without Facebook)

This is the route that works **today**, without Business Verification.

## Why this exists

`META_SETUP.md` describes connecting Instagram the long way round: a Facebook
app, Facebook Login, the Pages you administer, and the Instagram account linked
to each Page. That route needs `instagram_basic` and `pages_show_list` at
**advanced** access, and Meta only grants advanced access after **Business
Verification** — which is why the connect dialog currently refuses anyone who
does not hold a role on the app.

**Instagram API with Instagram Login** is a different product with its own door.
The user authorises on `instagram.com` rather than `facebook.com`, Instagram
issues the token, and every read goes to `graph.instagram.com`. The two
permissions it needs — `instagram_business_basic` and
`instagram_business_manage_insights` — work at **standard** access.

What it costs: **Instagram only**. No Facebook Page comes with it. When Business
Verification comes through, the Meta route becomes available again for Pages,
and both can be used side by side — the connection records which door it came
through so each syncs against the API that issued its token.

Either way, the account being connected must be a **Professional (Business or
Creator)** Instagram account. A personal account can complete the login and then
serve no insights at all, so the connect refuses it with that message rather than
letting it fail silently later.

## What you need to do

In the Meta App Dashboard for the existing app:

1. Add the **Instagram** product if it is not already there, and open
   **Instagram → API setup with Instagram login**.
2. In the step headed **"Set up Instagram business login"**, add this as an
   **OAuth Redirect URI**:

   ```
   https://api.tinashebenson.com/api/connect/instagram/callback
   ```

   This is a *different list* from Facebook Login's Valid OAuth Redirect URIs.
   Adding the URL to one does not add it to the other.
3. From the same page, copy the **Instagram app ID** and **Instagram app
   secret**. These are **not** the same numbers as `META_APP_ID` /
   `META_APP_SECRET`, even though they belong to the same app. Sending the
   Facebook app id to the Instagram token endpoint fails with an unhelpful
   "Invalid platform app".

Then set on the Railway `api` service:

| Variable | Value |
| --- | --- |
| `INSTAGRAM_APP_ID` | the Instagram app id |
| `INSTAGRAM_APP_SECRET` | the Instagram app secret — set it in Railway directly, never paste it in chat |
| `INSTAGRAM_REDIRECT_URI` | `https://api.tinashebenson.com/api/connect/instagram/callback` (optional; derived from `API_URL` when unset) |

`GET /api/setup` then reports whether the server agrees, including whether the
redirect URI it will send matches the one you registered.

> The dashboard's layout and wording change often, and these steps were written
> from Meta's documentation rather than from the live dashboard. If a label
> does not match, what matters is unchanged: the **Instagram** app id/secret, and
> the callback URL registered under the **Instagram** login settings.

## What the app does with it

`server/src/instagramLogin.ts` handles the OAuth; the metrics pull is the same
code as the Meta route, pointed at a different host.

1. **Authorise** — `https://www.instagram.com/oauth/authorize` with
   `instagram_business_basic,instagram_business_manage_insights`.
2. **Exchange** — the code buys a token good for about an hour, which is
   immediately swapped for a **long-lived (60-day)** one. Only the long-lived
   token is stored, encrypted.
3. **Refresh** — every sync refreshes a token within 14 days of expiry. A
   workspace that syncs at all stays connected without anyone re-authorising; a
   token that has already lapsed cannot be refreshed and the connection asks for
   a reconnect.
4. **Read** — profile, `/insights?period=day` in 30-day chunks, `/media`, and
   per-media `/insights`, all against `graph.instagram.com`. The metric names and
   the candidate-list handling are exactly as `META_SETUP.md` describes, because
   it is the same code.

## Proving it worked

1. Open **Integrations** and press **Connect** on the Instagram tile.
2. `GET /api/social/sync-runs` — the newest run should read `status: ok`,
   `source: live`, with a non-empty `metrics` array. This is the audit trail;
   check it after the first connect rather than trusting the chart.
3. Spot-check one figure against Instagram's own Insights before sending a
   client report off the back of it.

An empty chart means the pull returned nothing and the sync run says why. It
never means a stand-in was substituted — nothing on the Social face is invented.

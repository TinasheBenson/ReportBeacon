# Getting ReportBeacon live — step by step

Most of this is already done. What is left is one DNS record, a check in the
Meta dashboard, and connecting your account.

If anything goes wrong at any point, skip to **"When something isn't working"**
at the bottom. There is a page that tells you what's broken in plain English.

---

## Already done

These were done for you directly against Railway on 18 September, each verified
in the deploy logs rather than assumed:

- **The code is merged and live.** The API redeployed from `main`.
- **The database migration ran** — log line `migrate: applied 003_live_sync.sql`.
  That is the fix that stops reconnecting from duplicating your accounts.
- **`TOKEN_ENC_KEY` was rotated** to a fresh key and a redeploy was forced so the
  new key is the one actually running. Setting the variable alone would not have
  done that — the old key stays live until the next deploy.
- **`META_GRAPH_VERSION=v23.0`** set on the API.
- **The app service exists**: `ReportBeacon App`, root directory `/`,
  `VITE_API_BASE=https://api.tinashebenson.com`, serving the built site with SPA
  fallback (`Accepting connections at http://localhost:8080`).
- **`app.tinashebenson.com` is attached** to that service.

One caveat on the encryption key: it was generated inside a chat session, so it
exists in that transcript. If you want one that never has, generate your own and
paste it over the current value in Railway — but do it **before** you first press
Connect on Meta. After that, changing it means reconnecting everything.

---

## Step 1 — Add the DNS record (the only thing left before the app loads)

Wherever DNS for `tinashebenson.com` is managed, add:

| Type | Name | Value |
|---|---|---|
| CNAME | `app` | `y12bqmob.up.railway.app` |

You have done this before — `api` already points at `mhno75un.up.railway.app`
and is verified with a valid certificate, so the same place and the same kind of
record.

Railway issues the certificate automatically once it sees the record. That
usually takes a few minutes and can take up to an hour.

Until then `app.tinashebenson.com` will not load. That is expected and is not a
sign anything is broken.

---

## Step 2 — Point Meta at the right address

In the Meta app dashboard, under **Facebook Login → Settings → Valid OAuth
Redirect URIs**, make sure this exact URL is listed:

```
https://api.tinashebenson.com/api/connect/meta/callback
```

It has to match character for character or Meta refuses the connection.

Also check that **your own Facebook account has a role on the app** (Roles →
Administrators or Testers). While the app is in development mode, only accounts
with a role can connect — that's normal and doesn't block you.

One more thing: the Instagram account has to be a **Business** or **Creator**
account. Personal Instagram accounts return no statistics at all, so there'd be
nothing to show.

---

## Step 3 — Connect and check the numbers are real

1. Open `https://app.tinashebenson.com` and sign in.
2. Go to **Integrations** and press **Connect**.
3. Authorise with your Facebook account.

Now look at the badge at the top of the Social overview page:

- **Live** (green) — these are your real numbers.
- **Sample data** (orange) — the accounts connected, but pulling the real figures
  didn't work, so you're looking at placeholders.

That orange badge is deliberate. Placeholder numbers are always labelled, so a
stand-in figure can never quietly end up in a client report.

Before sending anything to a client, open one account and compare a single
number — follower count is easiest — against what Instagram or Facebook shows
you directly.

---

## When something isn't working

Sign in, go to **Integrations**, and press **Setup check** (top of the page).

It opens a page listing every requirement: what's fine, what isn't, and exactly
what to change for anything that isn't. It also shows your connected accounts
and the last few attempts to fetch data, including the reason any of them
failed.

The usual answers:

| What you see | What it means |
|---|---|
| Signing in does nothing | `COOKIE_DOMAIN` on the API service must be `.tinashebenson.com` |
| Page loads but has no data | `CORS_ORIGINS` must include `https://app.tinashebenson.com` |
| Connecting fails at Facebook | The redirect URI doesn't match — see step 4 |
| Badge says **Sample data** | The setup check's "Recent sync attempts" table gives the reason |
| "needs reconnecting" | The Meta permission expired. Press Connect again |

If the setup check says everything passes but the badge still reads **Sample
data**, send me what the "Recent sync attempts" table shows. That means Meta
accepted the request but didn't return the figures we asked for — usually
because they've renamed a statistic again, which is fixed by adjusting one
setting.

---

## Later, when you're ready

None of this blocks you:

- **Emailed sign-in links** — set `RESEND_API_KEY` and `EMAIL_FROM`. Until then
  password sign-in works normally and magic links go to the server log.
- **TikTok and LinkedIn** — not built yet.
- **Connecting clients' accounts** — needs Meta App Review and Business
  Verification, which takes weeks. Only needed to go beyond your own accounts
  and people you add as testers.

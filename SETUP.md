# Getting ReportBeacon live — step by step

Everything below is done in a browser: Railway, your DNS provider, and Meta.
No terminal, except one command in step 2.

If anything goes wrong at any point, skip to **"When something isn't working"**
at the bottom. There is a page that tells you what's broken in plain English.

---

## Step 1 — Merge the code

The new work sits on a branch. Railway only deploys what's on your main branch,
so nothing changes until this is merged.

Open the pull request, press **Merge pull request**, then **Confirm merge**.

Railway will notice and redeploy the API on its own. Wait for it to go green.

---

## Step 2 — Set the encryption key

**Do this before you connect any Meta account.** This key scrambles your Meta
access tokens in the database. If you set it *after* connecting, everything that
was already connected stops working and has to be reconnected.

Run this once, anywhere you have a terminal (your Mac's Terminal app is fine):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

It prints a line of random characters. That's the key.

Then in Railway: **your project → the `ReportBeacon` api service → Variables →
New Variable**

| Name | Value |
|---|---|
| `TOKEN_ENC_KEY` | the line you just generated |

Don't paste that value into a chat or a commit. If it ever leaks, generate a new
one — you'll just have to reconnect your Meta accounts afterwards.

---

## Step 3 — Create the service that serves the app

The API is already deployed. This is the app itself — the part people look at.

In Railway, in the **same project** as the API:

1. **New → GitHub Repo → `TinasheBenson/ReportBeacon`**
2. Open the new service → **Settings → Root Directory** → set it to `/`
   *(This matters. The API uses `server`; the app uses `/`. If you leave it on
   `server` you'll get a second copy of the API instead of the app.)*
3. **Variables → New Variable:**

| Name | Value |
|---|---|
| `VITE_API_BASE` | `https://api.tinashebenson.com` |

   *(This one is read while the app is being built, not while it runs. If you add
   it later, press Redeploy or it won't take effect.)*

4. **Settings → Networking → Custom Domain** → `app.tinashebenson.com`
5. Railway shows you a CNAME record. Add it at whoever manages DNS for
   `tinashebenson.com`. It can take a few minutes to start working.

Nothing needs changing on the API side — it already expects the app at that
address.

---

## Step 4 — Point Meta at the right address

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

## Step 5 — Connect and check the numbers are real

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

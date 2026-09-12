# Meta app setup (Facebook + Instagram)

This is the one thing only you can do. It gets us an **App ID** and **App
Secret** so ReportBeacon can pull real Instagram and Facebook numbers. About 15
minutes. Until it's done, the connect flow runs in a stub that imports sample
accounts, so nothing is blocked on your side.

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

I'll set `META_APP_ID`, `META_APP_SECRET`, and `META_REDIRECT_URI` and switch the
connect flow from stub to live. We test with one of your real accounts, and I
tune the live insights pull against real responses.

## One thing to know about going wide

Development mode is perfect for you and your first clients. To let **any** client
connect their accounts (public launch), Meta requires **App Review** for those
permissions plus **Business Verification**. That takes days to weeks and is a
separate step we plan when you're ready to open it up. It does not block
building, testing, or onboarding your first clients as app testers.

# Client Reporting Dashboard — Demo

A self-contained sales demo: **one dashboard that replaces four platform
logins.** It blends Local Services Ads, Google Ads, Google Business Profile,
Meta Ads and SEMrush for a roster of fictional home-service clients (HVAC,
plumbing, roofing, pest control), and lets the agency build and present a
branded client report without leaving the page.

No backend, no auth, no live integrations — every figure is realistic mock
data (`src/lib/dashboardData.ts`). It opens straight into the dashboard.

## Features

- **Client switcher** across four trades — switching updates every number.
- **Blended overview** — cross-platform leads, blended cost per lead, total
  spend, Google rating, and a live connected-sources status row.
- **Per-platform breakdown** — a tab for each of the five sources with its own
  KPIs and charts.
- **Role-based access** — Agency Owner (full roster + margin), Account Manager
  (roster, no margin), and Client View (one read-only account).
- **Report & Presentation builder** — pick a date range and sections with
  tactile clay controls (radios, toggles, a draggable rotary knob), watch a
  branded report assemble live, "send" it, or step into a fullscreen,
  client-facing **Presentation mode**.

## Design

A claymorphic / neumorphic surface — one warm putty ground where every panel is
extruded from or pressed into it. Space Grotesk (display), Inter (body),
JetBrains Mono (numbers). All styling is scoped to `.clay-root` in
`src/index.css`.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # type-check + production build to dist/
npm run preview
```

## Deploy

**Vercel (the zero-backend demo).** Auto-detects Vite. Build command
`npm run build`, output `dist/` (also declared in `vercel.json`). With no
`VITE_API_BASE` set, the app runs entirely on the demo roster in
`src/lib/data.ts` / `src/lib/social.ts` — no server required.

**Railway (the real app).** Set `VITE_API_BASE` to the API origin at build time
and the Social face reads live data from the backend instead. See
[`DEPLOY_FRONTEND.md`](DEPLOY_FRONTEND.md) for the service, the SPA fallback and
the custom domain, and [`server/DEPLOY.md`](server/DEPLOY.md) for the API.

# ReportBeacon — PRD / Working Notes

## Problem statement
User (TinasheBenson) owns ReportBeacon, a Vite + React + TS agency client-reporting
dashboard demo (blends Google Ads / Meta / GBP / LSA / SEMrush for fictional clients,
with role-based seats, an OpenRouter AI recommendation engine, and a branded report
builder). Asked to "clean this up and make it way better" — backend and UI/UX.

## Locked decisions (from user)
- Keep the existing **Node/Express + PostgreSQL** backend (deploys on Railway; Railway
  already provisions Postgres). **No MongoDB.**
- **Real email + password auth** with roles (owner / manager / viewer).
- It is a **polished demo**, not a full SaaS: seeded fake clients in Postgres so
  prospects can sign in and explore freely. No live data pulling.
- **Keep OpenRouter bring-your-own-key** for AI recommendations.

## Architecture (as built)
- Frontend: Vite + React 19 + TS (unchanged stack). Supervisor prog `rb-web` :3000.
- Backend: Node/Express + `pg`, `/app/server`. Supervisor prog `rb-api` :8001. dotenv loads `/app/server/.env`.
- DB: PostgreSQL (supervisor prog `postgres`). Migrations auto-run on boot; demo seeded on boot.
- Same-origin in preview: `/api/*` -> :8001, everything else -> :3000. Session = httpOnly cookie `rb_session`.

## Implemented (2026-06 / this session)
- **Auth**: email+password (bcrypt, cost 12), server sessions, brute-force lockout
  (5 fails / 15 min), register provisions a personal owner workspace + seeds the roster.
  Endpoints: /api/auth/register|login|logout, /api/me. Magic-link + Meta connect kept.
- **Persistence** (Postgres, migration 002): `workspace_state` (JSONB blob the frontend
  reads/writes), `clients` (seeded roster per workspace), `reports` (saved reports),
  `login_attempts`. Endpoints: GET/PUT /api/workspace, GET /api/clients, GET/POST/DELETE /api/reports.
- **Seed**: 3 shared demo accounts (owner/manager/viewer) on one workspace, scoped by role.
  6 seed clients (4 imported + 2 importable: lakeside-vet, summit-realty).
- **Frontend wiring**: replaced the mock localStorage seat-picker with real auth
  (`context/app.tsx` resolves /api/me), redesigned split-panel Login with demo role cards,
  workspace store now hydrates catalog + state from the API and writes changes back
  (debounced PUT), localStorage kept only as offline fallback. Reports "Save report"
  persists to the API.
- **Testing**: backend 13/13 pytest + frontend Playwright flows — 100% (iteration_1.json).
  Fixed a critical register bug (session insert before tx commit → FK violation).

## Implemented (iteration 2 — the four follow-ups)
- **Visual refresh** (token-level, cascades every screen): warm "paper" ground, jade/teal accent
  (dropped the generic indigo), Bricolage Grotesque display typeface for all headings, richer
  cards (larger radius) + deeper warm shadows. Light + dark both retuned. `src/index.css`,
  `index.html`, `components/ui/kit.tsx`.
- **Saved Reports list**: Reports page lists saved reports with reopen (loads config back into the
  builder), resend (demo), and delete — backed by GET/POST/DELETE /api/reports.
- **Client Editor** (owner-only): Add / Edit / Remove clients on the Accounts page via a modal;
  `makeAccount()` synthesises a full 60-day Account from a few fields so charts/health/reports work.
  New endpoints POST /api/clients + DELETE /api/clients/:id (owner-guarded via `roleFor`), persisted
  in Postgres; catalog updates live in the workspace store.
- **Live AI**: confirmed already wired — browser-side OpenRouter (BYOK) in `lib/llm.ts`, tested on
  Integrations, generates real per-account recommendations with graceful rule-engine fallback.
- **Client logos**: owners can upload a per-client logo in the Client Editor (auto-downscaled to a
  small PNG data URL, stored on the client's Account JSONB). A new shared `ClientMark` component
  renders the logo everywhere a client mark appears (roster, Accounts table, Reports, Team,
  Integrations, Automations, all Social pages), falling back to the coloured monogram.

## Backlog / next
- P1: Full UI/UX visual refresh across the 20+ pages (Portfolio/Accounts/Reports/Social)
  via design_agent — this session focused on backend + auth + the Login surface.
- P1: Saved-reports list UI (rows are persisted; surface a list + re-open/delete on Reports).
- P2: Persist team members / invitations as real users (currently in the workspace blob).
- P2: Live OpenRouter test wiring UI polish; Meta live connect (needs META_APP_ID/SECRET).
- Deploy: on Railway set NODE_ENV=production, DATABASE_URL (Postgres plugin),
  APP_URL/API_URL/CORS_ORIGINS to the real domain(s), TOKEN_ENC_KEY, OAUTH_STATE_SECRET,
  DEMO_PASSWORD. See /app/server/.env.example and /app/server/DEPLOY.md.

## Credentials
See /app/memory/test_credentials.md. Demo: owner|manager|viewer @reportbeacon.demo / demo1234.

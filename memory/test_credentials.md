# ReportBeacon — Test Credentials

Real email + password auth (server sessions via httpOnly cookie `rb_session`).
Backend: Node/Express + PostgreSQL at `/app/server` on port 8001. Frontend: Vite/React on 3000.

## Demo accounts (all share one workspace "Northstar Digital", scoped by role)
Password for all three: `demo1234`

| Role    | Email                        | Sees |
|---------|------------------------------|------|
| Owner   | owner@reportbeacon.demo      | Full roster + agency economics |
| Manager | manager@reportbeacon.demo    | Only assigned accounts (Dana's book) |
| Viewer  | viewer@reportbeacon.demo     | Read-only, all accounts |

New sign-ups (register) get their own workspace provisioned with the seeded demo roster and an `owner` role.

## Auth endpoints (prefix /api)
- POST /api/auth/register  {email, password, name}
- POST /api/auth/login     {email, password}
- POST /api/auth/logout
- GET  /api/me
- GET/PUT /api/workspace   (persisted workspace blob)
- GET  /api/clients        (seeded client roster + importableIds)
- GET/POST /api/reports, DELETE /api/reports/:id
- GET  /api/health

## Frontend routes
- `/`          Landing (public)
- `/app`       Login when signed out; Portfolio dashboard when signed in
- Demo quick-login buttons on the login screen (data-testid: demo-login-agency / demo-login-account / demo-login-viewer)

## Notes
- Login form testids: auth-email-input, auth-password-input, auth-submit-button, switch-to-signup, switch-to-signin, auth-error
- Reports: report-export-button, report-save-button

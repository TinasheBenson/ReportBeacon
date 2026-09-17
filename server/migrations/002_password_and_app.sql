-- Password auth + application persistence.
-- Adds password credentials to users, brute-force tracking, and the JSONB-backed
-- app stores (workspace state, seeded clients, saved reports) that the frontend
-- reads/writes through the API instead of localStorage.

alter table users add column if not exists password_hash text;

create table if not exists login_attempts (
  identifier   text primary key,        -- "{ip}:{email}"
  count        int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- The whole persisted workspace blob the frontend already models (brand, roster
-- scoping, schedules, alert rules + lifecycle, invitations, mode). Stored as
-- JSONB so the server stays a dumb, forward-compatible store of the client shape.
create table if not exists workspace_state (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  state        jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- The demo client roster, per workspace. Each row is a full Account object the
-- Performance face renders. Seeded on workspace creation; editable later.
create table if not exists clients (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id    text not null,
  data         jsonb not null,
  importable   boolean not null default false,   -- discoverable, not yet imported
  created_at   timestamptz not null default now(),
  primary key (workspace_id, client_id)
);

-- Saved / sent branded reports.
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id    uuid references users(id) on delete set null,
  name         text not null,
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_reports_workspace on reports(workspace_id);

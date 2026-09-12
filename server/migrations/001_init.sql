-- ReportBeacon schema, v1. Multi-tenant: a workspace is the tenant boundary,
-- every data row is scoped to a workspace_id, and users reach a workspace only
-- through a membership. Auth is magic-link + server sessions.

create extension if not exists pgcrypto;

-- ── identity ────────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  created_at  timestamptz not null default now()
);

create table if not exists workspaces (
  id           uuid primary key default gen_random_uuid(),
  agency_name  text not null default 'Your Agency',
  logo_url     text,
  brand        jsonb not null default '{}'::jsonb, -- per-face palette, same shape the app models
  created_at   timestamptz not null default now()
);

create table if not exists memberships (
  user_id       uuid not null references users(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner','manager','viewer')),
  created_at    timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
create index if not exists idx_memberships_workspace on memberships(workspace_id);

-- ── auth (magic link + sessions) ─────────────────────────────────────────────
-- Only the SHA-256 of each secret is stored; the raw value lives only in the
-- emailed link / the cookie.
create table if not exists magic_link_tokens (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  token_hash  text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mlt_token on magic_link_tokens(token_hash);

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sessions_user on sessions(user_id);

-- ── tenant data (populated from M2 onward; defined now so tenancy is complete) ─
create table if not exists social_accounts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  handle        text,
  niche         text,
  location      text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_social_accounts_workspace on social_accounts(workspace_id);

create table if not exists platform_connections (
  id                 uuid primary key default gen_random_uuid(),
  social_account_id  uuid not null references social_accounts(id) on delete cascade,
  platform           text not null check (platform in ('instagram','facebook','tiktok','linkedin')),
  external_id        text,
  access_token_enc   bytea,        -- encrypted at the app layer; never returned to the browser
  token_expires_at   timestamptz,
  scopes             text,
  status             text not null default 'connected',
  connected_at       timestamptz not null default now()
);
create index if not exists idx_platform_connections_account on platform_connections(social_account_id);

create table if not exists metrics_daily (
  connection_id    uuid not null references platform_connections(id) on delete cascade,
  date             date not null,
  followers        integer,
  reach            integer,
  impressions      integer,
  engagement_rate  numeric(6,2),
  primary key (connection_id, date)
);

create table if not exists posts (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references platform_connections(id) on delete cascade,
  external_id    text,
  type           text,
  caption        text,
  posted_at      timestamptz,
  reach          integer,
  impressions    integer,
  likes          integer,
  comments       integer,
  shares         integer,
  saves          integer,
  video_views    integer
);
create index if not exists idx_posts_connection on posts(connection_id);

create table if not exists sync_runs (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references platform_connections(id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running',
  error          text
);
create index if not exists idx_sync_runs_connection on sync_runs(connection_id);

-- Live sync: make importing from Meta repeatable.
--
-- The first import always INSERTed, so reconnecting a Meta account duplicated
-- the whole roster and every post. Real data has to be re-pullable — followers
-- and reach change daily — so this migration adds the natural keys the sync
-- upserts against, plus room to record what a run actually fetched.

-- ── de-duplicate before the unique indexes go on ─────────────────────────────
-- Existing rows may already contain duplicates from earlier connects. Keep the
-- oldest of each group and re-point children at it so nothing is orphaned.

-- posts: same connection + same external id is the same post.
delete from posts p using posts q
  where p.external_id is not null and p.external_id = q.external_id
    and p.connection_id = q.connection_id and p.ctid > q.ctid;

-- platform_connections: one connection per (account, platform, external id).
with keep as (
  select distinct on (social_account_id, platform, external_id) id
    from platform_connections
   order by social_account_id, platform, external_id, connected_at
), dupes as (
  select pc.id as dup_id, k.id as keep_id
    from platform_connections pc
    join platform_connections o
      on o.social_account_id = pc.social_account_id
     and o.platform = pc.platform
     and o.external_id is not distinct from pc.external_id
    join keep k on k.id = o.id
   where pc.id <> k.id
)
update metrics_daily m set connection_id = d.keep_id from dupes d
 where m.connection_id = d.dup_id
   and not exists (select 1 from metrics_daily x where x.connection_id = d.keep_id and x.date = m.date);
delete from platform_connections pc
 where exists (
   select 1 from platform_connections o
    where o.social_account_id = pc.social_account_id
      and o.platform = pc.platform
      and o.external_id is not distinct from pc.external_id
      and o.connected_at < pc.connected_at
 );

-- social_accounts: one account per (workspace, name).
delete from social_accounts sa
 where exists (
   select 1 from social_accounts o
    where o.workspace_id = sa.workspace_id
      and o.name = sa.name
      and o.created_at < sa.created_at
 );

-- ── natural keys the sync upserts against ───────────────────────────────────
create unique index if not exists uq_social_accounts_ws_name
  on social_accounts (workspace_id, name);

create unique index if not exists uq_platform_connections_natural
  on platform_connections (social_account_id, platform, external_id);

create unique index if not exists uq_posts_connection_external
  on posts (connection_id, external_id)
  where external_id is not null;

-- ── provenance ──────────────────────────────────────────────────────────────
-- Whether a connection's numbers came from Meta or from the seed, and when they
-- were last refreshed — the Social face shows "synced N minutes ago" from this,
-- and it is how a live pull is told apart from a fallback without guessing.
alter table platform_connections add column if not exists last_synced_at timestamptz;
alter table platform_connections add column if not exists data_source text
  not null default 'seed' check (data_source in ('live', 'seed'));

-- What a sync run actually fetched: the metric names that resolved and any
-- non-fatal gaps, so a run can be audited against Meta's own Insights UI.
alter table sync_runs add column if not exists source text;
alter table sync_runs add column if not exists metrics jsonb not null default '[]'::jsonb;
alter table sync_runs add column if not exists warnings jsonb not null default '[]'::jsonb;

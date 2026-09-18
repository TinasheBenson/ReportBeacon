-- Remove the demo data that earlier boots wrote into this database.
--
-- Three separate problems, in order of seriousness:
--
--  1. Seeding created three real, loginable accounts —
--     owner@reportbeacon.demo, manager@… and viewer@… — whose password
--     defaulted to a hardcoded literal and was RESET to it on every boot. On a
--     public API that is a known-credential owner account, not test data. The
--     seeding code is gone; these rows have to go with it.
--
--  2. Every new workspace was given a generated client roster, so a real
--     workspace came pre-filled with invented clients.
--
--  3. A failed Meta pull used to store synthetic metrics. Those rows are
--     indistinguishable from real ones once rendered, which is exactly why they
--     cannot be left behind now that real numbers are arriving.
--
-- Deliberately NOT touched: the `clients` table for real workspaces. Emptying
-- it would leave the Performance face — which has no backend yet — with nothing
-- to render, so that is a product decision rather than a cleanup.

-- ── 1. widen the provenance constraint, before anything writes the new value ──
-- 'seed' is no longer a value the application can produce; 'none' means no
-- successful pull has stored anything yet. This has to come first: the updates
-- below set 'none', which the original constraint rejects.
alter table platform_connections drop constraint if exists platform_connections_data_source_check;
alter table platform_connections
  add constraint platform_connections_data_source_check
  check (data_source in ('live', 'none', 'seed'));
alter table platform_connections alter column data_source set default 'none';

-- ── 2. the demo workspace and its seeded accounts ───────────────────────────
-- Cascades to memberships, clients, social_accounts and everything under them.
delete from workspaces where id = '00000000-0000-0000-0000-0000000000d0';

-- The demo users themselves. Scoped to the exact addresses the seeder used, so
-- a real account that merely looks similar is untouched.
delete from users where email in (
  'owner@reportbeacon.demo',
  'manager@reportbeacon.demo',
  'viewer@reportbeacon.demo'
);

-- ── 3. synthetic metrics and posts ──────────────────────────────────────────
-- Posts the seeder wrote are identifiable by their external_id prefix; the
-- daily metrics by the connection being marked as seeded.
delete from posts
 where external_id like 'seed\_%' escape '\'
    or external_id like 'stub\_%' escape '\';

delete from posts where connection_id in (
  select id from platform_connections where data_source = 'seed'
);
delete from metrics_daily where connection_id in (
  select id from platform_connections where data_source = 'seed'
);

-- Any connection whose only data was synthetic keeps its credentials but is
-- marked as never synced, so the next sync is treated as its first.
update platform_connections
   set data_source = 'none', last_synced_at = null
 where data_source = 'seed';

-- Sync runs that recorded a seeded fallback describe an event that no longer
-- has any stored result, so they would misreport history.
delete from sync_runs where source = 'seed';


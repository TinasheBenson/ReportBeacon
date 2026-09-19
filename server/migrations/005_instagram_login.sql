-- Instagram API with Instagram Login: a second way to reach the same platform.
--
-- Until now every Instagram connection came through Facebook Login — the user
-- authorises a Facebook app, we read their Pages, and the IG account hangs off
-- a Page. That route needs `instagram_basic` at *advanced* access, which Meta
-- only grants after Business Verification, so a brand-new app cannot connect
-- anybody's account but its own developers'.
--
-- Instagram Login is the other door: the user authorises on instagram.com, the
-- token is issued by Instagram rather than Facebook, and the reads go to
-- graph.instagram.com. No Page, no Business Verification, and the insights
-- permission is available at standard access.
--
-- Both produce a row with platform='instagram', and they can even be the same
-- Instagram account — but the token is only valid against the API that issued
-- it. So the row has to record which door it came through, or a sync would call
-- graph.facebook.com with a token Facebook has never heard of.
alter table platform_connections add column if not exists provider text
  not null default 'meta'
  check (provider in ('meta', 'instagram_login', 'linkedin'));

-- Existing rows all predate this column. LinkedIn connections are named for
-- what they are; everything else came through the Meta/Facebook flow, which is
-- what the default already says.
update platform_connections set provider = 'linkedin'
 where platform = 'linkedin' and provider <> 'linkedin';

comment on column platform_connections.provider is
  'Which API issued this connection''s token, and therefore which API can spend it.';

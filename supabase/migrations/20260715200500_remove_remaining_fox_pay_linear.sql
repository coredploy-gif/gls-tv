-- Exact reviewed Fox sports pay-linear rows missed by the first cleanup.
-- Local affiliates, Fox Weather, Fox Soul, news, and business remain intact.

update public.channels
set is_online = false,
    featured = false,
    active_source_url = null,
    health_status = 'dead',
    updated_at = now()
where slug = any (array[
  'fox-sports-1080p-geo-blocked',
  'foxdeportes-us-sd',
  'foxsoccerplus-us-sd'
]::text[]);

update public.channel_sources
set health_status = 'dead',
    updated_at = now()
where channel_id in (
  select id
  from public.channels
  where slug = any (array[
    'fox-sports-1080p-geo-blocked',
    'foxdeportes-us-sd',
    'foxsoccerplus-us-sd'
  ]::text[])
);

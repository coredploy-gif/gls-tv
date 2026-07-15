-- Unpublish the reviewed built-in pay-TV rows without deleting history.
-- Exact slugs only: do not broaden this to substring matching (TeleArena and
-- other unrelated public channels must remain untouched).

update public.stream_seeds
set is_active = false,
    updated_at = now()
where slug = any (array[
  'fox-sports',
  'fox-sports-1',
  'fox-sports-2',
  'foxsports1-us-hd',
  'tsn1-ca-sd',
  'tsn2-ca-sd',
  'tsn3-ca-sd',
  'tsn4-ca-sd',
  'tsn5-ca-sd'
]::text[]);

update public.channels
set is_online = false,
    featured = false,
    active_source_url = null,
    health_status = 'dead',
    updated_at = now()
where slug = any (array[
  'arenafight-rs-sd',
  'arenasport1-ba-sd',
  'arenasport1-hr-sd',
  'arenasport1-rs-sd',
  'arenasport1-si-sd',
  'arenasport1-sk-sd',
  'arenasport10-hr-sd',
  'arenasport10-rs-sd',
  'arenasport2-ba-sd',
  'arenasport2-hr-sd',
  'arenasport2-rs-sd',
  'arenasport2-si-sd',
  'arenasport2-sk-sd',
  'arenasport3-ba-sd',
  'arenasport3-hr-sd',
  'arenasport3-rs-sd',
  'arenasport3-si-sd',
  'arenasport4-ba-sd',
  'arenasport4-hr-sd',
  'arenasport4-rs-sd',
  'arenasport5-hr-sd',
  'arenasport5-rs-sd',
  'arenasport6-hr-sd',
  'arenasport6-rs-sd',
  'arenasport7-hr-sd',
  'arenasport7-rs-sd',
  'arenasport8-hr-sd',
  'arenasport8-rs-sd',
  'arenasport9-hr-sd',
  'arenasport9-rs-sd',
  'fox-sports',
  'foxsports-ar-sd',
  'foxsports1-us-hd',
  'foxsports2-ar-sd',
  'foxsports3-ar-sd',
  'tsn1-ca-sd',
  'tsn2-ca-sd',
  'tsn3-ca-sd',
  'tsn4-ca-sd',
  'tsn5-ca-sd',
  'vivacomarena-bg-sd'
]::text[]);

update public.channel_sources
set health_status = 'dead',
    updated_at = now()
where channel_id in (
  select id
  from public.channels
  where slug = any (array[
    'arenafight-rs-sd',
    'arenasport1-ba-sd',
    'arenasport1-hr-sd',
    'arenasport1-rs-sd',
    'arenasport1-si-sd',
    'arenasport1-sk-sd',
    'arenasport10-hr-sd',
    'arenasport10-rs-sd',
    'arenasport2-ba-sd',
    'arenasport2-hr-sd',
    'arenasport2-rs-sd',
    'arenasport2-si-sd',
    'arenasport2-sk-sd',
    'arenasport3-ba-sd',
    'arenasport3-hr-sd',
    'arenasport3-rs-sd',
    'arenasport3-si-sd',
    'arenasport4-ba-sd',
    'arenasport4-hr-sd',
    'arenasport4-rs-sd',
    'arenasport5-hr-sd',
    'arenasport5-rs-sd',
    'arenasport6-hr-sd',
    'arenasport6-rs-sd',
    'arenasport7-hr-sd',
    'arenasport7-rs-sd',
    'arenasport8-hr-sd',
    'arenasport8-rs-sd',
    'arenasport9-hr-sd',
    'arenasport9-rs-sd',
    'fox-sports',
    'foxsports-ar-sd',
    'foxsports1-us-hd',
    'foxsports2-ar-sd',
    'foxsports3-ar-sd',
    'tsn1-ca-sd',
    'tsn2-ca-sd',
    'tsn3-ca-sd',
    'tsn4-ca-sd',
    'tsn5-ca-sd',
    'vivacomarena-bg-sd'
  ]::text[])
);

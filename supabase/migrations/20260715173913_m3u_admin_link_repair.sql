-- Transactional, owner-scoped M3U replacement and supported system-link placements.
alter table public.user_playlist_channels
  drop constraint if exists user_playlist_channels_user_id_slug_key;

create unique index if not exists user_playlist_channels_playlist_slug_key
  on public.user_playlist_channels (playlist_id, slug);

alter table public.user_playlists
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_import_id uuid,
  add column if not exists import_stats jsonb not null default '{}'::jsonb;

alter table public.user_playlists
  drop constraint if exists user_playlists_status_check;
alter table public.user_playlists
  add constraint user_playlists_status_check
  check (status in ('queued', 'fetching', 'parsing', 'applying', 'ready', 'error'));

create or replace function public.apply_user_playlist_import(
  p_playlist_id uuid,
  p_name text,
  p_source_url text,
  p_raw_m3u text,
  p_import_id uuid,
  p_channels jsonb,
  p_stats jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_playlist public.user_playlists%rowtype;
  v_count integer := jsonb_array_length(p_channels);
  v_account_channels integer;
begin
  if v_user is null then raise exception 'M3U_UNAUTHORIZED'; end if;
  if p_import_id is null then raise exception 'M3U_IMPORT_ID_REQUIRED'; end if;
  if jsonb_typeof(p_channels) <> 'array' then raise exception 'M3U_CHANNELS_INVALID'; end if;
  if v_count < 1 or v_count > 2000 then raise exception 'M3U_CHANNEL_LIMIT'; end if;
  if length(btrim(coalesce(p_name, ''))) < 1 or length(p_name) > 80 then
    raise exception 'M3U_NAME_INVALID';
  end if;
  if p_source_url !~* '^https?://' then raise exception 'M3U_URL_INVALID'; end if;

  -- One writer per account; this also serializes new-playlist quota checks.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  if p_playlist_id is null then
    if (select count(*) from public.user_playlists where user_id = v_user) >= 10 then
      raise exception 'M3U_PLAYLIST_LIMIT';
    end if;
    insert into public.user_playlists (
      user_id, name, source_url, raw_m3u, channel_count, status,
      last_attempt_at, last_import_id, import_stats, updated_at
    ) values (
      v_user, btrim(p_name), p_source_url, p_raw_m3u, 0, 'applying',
      now(), p_import_id, coalesce(p_stats, '{}'::jsonb), now()
    ) returning * into v_playlist;
  else
    select * into v_playlist
    from public.user_playlists
    where id = p_playlist_id and user_id = v_user
    for update;
    if not found then raise exception 'M3U_PLAYLIST_NOT_FOUND'; end if;
    if v_playlist.last_attempt_at is not null
       and v_playlist.last_attempt_at > now() - interval '30 seconds' then
      raise exception 'M3U_REFRESH_COOLDOWN';
    end if;
  end if;

  select count(*) into v_account_channels
  from public.user_playlist_channels
  where user_id = v_user and playlist_id <> v_playlist.id;
  if v_account_channels + v_count > 5000 then raise exception 'M3U_ACCOUNT_CHANNEL_LIMIT'; end if;

  -- Validation occurs before deletion; any later error rolls the whole transaction back.
  if exists (
    select 1
    from jsonb_to_recordset(p_channels) as c(
      slug text, title text, stream_url text, poster text, backdrop text
    )
    where c.slug is null or c.slug = '' or length(c.slug) > 110
       or c.title is null or c.title = '' or length(c.title) > 200
       or c.stream_url !~* '^https?://'
       or (coalesce(c.poster, '') <> '' and c.poster !~* '^https?://')
       or (coalesce(c.backdrop, '') <> '' and c.backdrop !~* '^https?://')
  ) then
    raise exception 'M3U_CHANNEL_INVALID';
  end if;

  delete from public.user_playlist_channels where playlist_id = v_playlist.id;
  insert into public.user_playlist_channels (
    playlist_id, user_id, slug, title, description, poster, backdrop,
    categories, countries, tvg_id, stream_url, quality, format, sort_order
  )
  select
    v_playlist.id, v_user, c.slug, c.title, coalesce(c.description, ''),
    coalesce(c.poster, ''), coalesce(c.backdrop, ''),
    coalesce(c.categories, '{}'), coalesce(c.countries, '{}'), c.tvg_id,
    c.stream_url, coalesce(c.quality, 'Auto'), coalesce(c.format, 'hls'),
    c.sort_order
  from jsonb_to_recordset(p_channels) as c(
    slug text, title text, description text, poster text, backdrop text,
    categories text[], countries text[], tvg_id text, stream_url text,
    quality text, format text, sort_order integer
  );

  update public.user_playlists set
    name = btrim(p_name),
    source_url = p_source_url,
    raw_m3u = p_raw_m3u,
    channel_count = v_count,
    status = 'ready',
    error_message = null,
    last_synced_at = now(),
    last_attempt_at = now(),
    last_import_id = p_import_id,
    import_stats = coalesce(p_stats, '{}'::jsonb),
    updated_at = now()
  where id = v_playlist.id
  returning * into v_playlist;

  return jsonb_build_object(
    'id', v_playlist.id,
    'channel_count', v_playlist.channel_count,
    'last_synced_at', v_playlist.last_synced_at,
    'last_import_id', v_playlist.last_import_id,
    'status', v_playlist.status
  );
end;
$$;

revoke all on function public.apply_user_playlist_import(
  uuid, text, text, text, uuid, jsonb, jsonb
) from public, anon;
grant execute on function public.apply_user_playlist_import(
  uuid, text, text, text, uuid, jsonb, jsonb
) to authenticated;

update public.admin_system_links
set placement = 'nav'
where placement not in ('nav', 'footer');
alter table public.admin_system_links
  drop constraint if exists admin_system_links_placement_check;
alter table public.admin_system_links
  add constraint admin_system_links_placement_check
  check (placement in ('nav', 'footer'));

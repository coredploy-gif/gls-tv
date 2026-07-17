-- App-facing copy strings editable from /admin/content.
-- Code keeps hardcoded fallbacks via src/lib/copy.ts — DB overrides when present.

create table if not exists public.app_copy (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists app_copy_updated_at_idx
  on public.app_copy (updated_at desc);

alter table public.app_copy enable row level security;

-- Public read (no secrets in this table). Writes go through service role / admin API.
drop policy if exists "Anyone can read app copy" on public.app_copy;
create policy "Anyone can read app copy"
  on public.app_copy
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on table public.app_copy from anon, authenticated;
grant select on table public.app_copy to anon, authenticated;

insert into public.app_copy (key, value) values
  (
    'links.disclaimer',
    'You are responsible for any links you add. Only import media you have the right to watch. User-added links are not part of the GLS licensed catalog.'
  ),
  (
    'auth.error.invalid_credentials',
    'Email or password is incorrect. Use Show to check your password, then try again.'
  ),
  (
    'auth.error.breached_password',
    'That password appears in a known data breach. Choose a different, stronger password.'
  ),
  (
    'auth.error.signups_paused',
    'Signups are temporarily paused.'
  ),
  (
    'auth.info.verify_email',
    'Check your email for a verification link, then sign in. You’ll pick who’s watching next. One free 14-day trial per device.'
  ),
  (
    'player.geo_restricted',
    'This channel may be subject to regional or rights restrictions. Try one of the available news alternatives below.'
  ),
  (
    'faq.hero.eyebrow',
    'Help centre'
  ),
  (
    'faq.hero.lead',
    'Straight answers about membership, playback, regions, and why GLS doesn’t ship a VPN. Local-first streaming — not geo-bypass.'
  ),
  (
    'faq.aside.region_title',
    'Region reminder'
  ),
  (
    'faq.aside.region_body',
    'If a stream is blocked on your network, GLS will not provide a VPN to get around it. Try another title, or the official service for that content in your country.'
  )
on conflict (key) do nothing;

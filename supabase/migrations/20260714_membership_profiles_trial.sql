-- Membership: account flags, viewer profiles, avatars, device trial lock
-- Applied remotely via Supabase MCP (membership_profiles_trial_device)

alter table public.profiles
  add column if not exists email text,
  add column if not exists plan text default 'trial',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_bypassed boolean not null default false,
  add column if not exists is_admin_exception boolean not null default false,
  add column if not exists max_viewer_profiles int not null default 2,
  add column if not exists stripe_customer_id text;

create table if not exists public.viewer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar_id text not null default 'avatar-01',
  is_kids boolean not null default false,
  pin_hash text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_catalog (
  id text primary key,
  title text not null,
  url text not null,
  thumb_url text,
  sort_order int not null default 0,
  is_kids boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trial_device_claims (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique,
  ip_hash text,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  claimed_at timestamptz not null default now(),
  blocked_until timestamptz not null
);

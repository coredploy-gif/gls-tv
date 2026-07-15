-- P1 operational foundation. Existing/unknown content rights remain unapproved.
alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'deletion_pending', 'anonymized'));

create table if not exists public.admin_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'finance', 'support', 'catalog', 'ops')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role)
);
alter table public.admin_roles enable row level security;
revoke all on table public.admin_roles from anon, authenticated;
create index if not exists admin_roles_active_idx
  on public.admin_roles (user_id, role) where revoked_at is null;

create table if not exists public.feature_flags (
  key text primary key check (key in ('payments', 'playlist_imports', 'hls_proxy', 'catalog_publish')),
  enabled boolean not null default false,
  reason text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.feature_flags (key, enabled, reason) values
  ('payments', true, 'Existing payment flow'),
  ('playlist_imports', true, 'Existing member import flow'),
  ('hls_proxy', true, 'Existing protected proxy flow'),
  ('catalog_publish', false, 'Requires approved source rights')
on conflict (key) do nothing;
alter table public.feature_flags enable row level security;
revoke all on table public.feature_flags from anon, authenticated;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'cooling_off'
    check (status in ('cooling_off', 'cancelled', 'processing', 'completed', 'failed')),
  confirmation_phrase_verified boolean not null default false,
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null default (now() + interval '7 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  audit_meta jsonb not null default '{}'::jsonb
);
create unique index if not exists account_deletion_one_active_idx
  on public.account_deletion_requests (user_id)
  where status in ('cooling_off', 'processing');
alter table public.account_deletion_requests enable row level security;
create policy account_deletion_select_own on public.account_deletion_requests
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.account_deletion_requests from anon, authenticated;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sports boolean not null default true,
  activity boolean not null default true,
  product boolean not null default true,
  email_nonessential boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.notification_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);
alter table public.notification_states enable row level security;
create policy notification_states_own on public.notification_states
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.notification_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email')),
  template_key text not null,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'retry', 'failed', 'disabled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_delivery_jobs enable row level security;
revoke all on table public.notification_delivery_jobs from anon, authenticated;
create index if not exists notification_delivery_pending_idx
  on public.notification_delivery_jobs (status, next_attempt_at)
  where status in ('pending', 'retry');

create table if not exists public.helpdesk_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  created_at timestamptz not null default now()
);
alter table public.helpdesk_status_history enable row level security;
revoke all on table public.helpdesk_status_history from anon, authenticated;
create index if not exists helpdesk_status_history_ticket_idx
  on public.helpdesk_status_history (ticket_id, created_at);

create table if not exists public.content_rights (
  id uuid primary key default gen_random_uuid(),
  channel_id text references public.channels(id) on delete cascade,
  stream_seed_slug text references public.stream_seeds(slug) on delete cascade,
  rights_holder text,
  source_name text not null,
  evidence_reference text,
  territories text[] not null default '{}',
  commercial_use boolean not null default false,
  redistribution boolean not null default false,
  proxy_permission boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  review_at timestamptz,
  status text not null default 'unknown'
    check (status in ('unknown', 'pending', 'approved', 'expired', 'revoked', 'takedown')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  takedown_reference text,
  disable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel_id is not null)::integer + (stream_seed_slug is not null)::integer = 1)
);
alter table public.content_rights enable row level security;
revoke all on table public.content_rights from anon, authenticated;
create unique index if not exists content_rights_channel_idx
  on public.content_rights (channel_id) where channel_id is not null;
create unique index if not exists content_rights_seed_idx
  on public.content_rights (stream_seed_slug) where stream_seed_slug is not null;
create index if not exists content_rights_review_idx
  on public.content_rights (status, review_at, expires_at);

create table if not exists public.content_rights_history (
  id uuid primary key default gen_random_uuid(),
  rights_id uuid not null references public.content_rights(id) on delete cascade,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.content_rights_history enable row level security;
revoke all on table public.content_rights_history from anon, authenticated;

create table if not exists public.retention_policies (
  data_class text primary key,
  retention_days integer not null check (retention_days >= 1),
  enabled boolean not null default true,
  description text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.retention_policies (data_class, retention_days, description) values
  ('dismissed_reminders', 90, 'Dismissed in-app reminders'),
  ('device_ip_hashes', 30, 'Expired trial device and IP hashes'),
  ('support_content', 730, 'Closed support message content'),
  ('import_attempts', 90, 'Playlist import attempt metadata'),
  ('operational_logs', 90, 'Non-financial operational run logs')
on conflict (data_class) do nothing;
alter table public.retention_policies enable row level security;
revoke all on table public.retention_policies from anon, authenticated;

create table if not exists public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  reason text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
alter table public.legal_holds enable row level security;
revoke all on table public.legal_holds from anon, authenticated;
create index if not exists legal_holds_active_idx
  on public.legal_holds (entity_type, entity_id) where active;

create table if not exists public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  dry_run boolean not null default true,
  status text not null check (status in ('running', 'completed', 'failed')),
  counts jsonb not null default '{}'::jsonb,
  error_code text,
  initiated_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.retention_runs enable row level security;
revoke all on table public.retention_runs from anon, authenticated;

create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'reviewing', 'completed', 'failed')),
  period_start date not null,
  period_end date not null,
  source text not null default 'manual_csv',
  stable_total_cents bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (period_end >= period_start)
);
create table if not exists public.reconciliation_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.reconciliation_runs(id) on delete cascade,
  payment_request_id uuid references public.manual_payment_requests(id) on delete set null,
  settlement_reference text,
  amount_cents integer not null,
  status text not null check (status in ('unmatched', 'matched', 'duplicate', 'settled', 'adjusted')),
  note text,
  created_at timestamptz not null default now()
);
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_rows enable row level security;
revoke all on table public.reconciliation_runs, public.reconciliation_rows from anon, authenticated;
create index if not exists reconciliation_rows_run_status_idx
  on public.reconciliation_rows (run_id, status);

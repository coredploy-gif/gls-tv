-- Live chat soft-delete + notification sound preferences

alter table public.helpdesk_tickets
  add column if not exists deleted_at timestamptz,
  add column if not exists escalated_at timestamptz;

create index if not exists helpdesk_tickets_requester_active_idx
  on public.helpdesk_tickets (requester_user_id, updated_at desc)
  where deleted_at is null;

alter table public.notification_preferences
  add column if not exists sound_chat boolean not null default true,
  add column if not exists sound_system boolean not null default true,
  add column if not exists sound_admin boolean not null default true,
  add column if not exists sound_billing boolean not null default true;

update public.chat_widget_config
set
  primary_color = '#e50914',
  welcome_body = 'Ask anything — we search our knowledge base first, then connect you with an agent if needed.',
  ask_human_label = 'Speak to an agent',
  updated_at = now()
where id = 'default';

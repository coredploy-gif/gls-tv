-- Support UI: public contact inbox, durable rate limits, KB expansion, demo ticket.
-- Safe for production: demo ticket is clearly labelled [DEMO].

-- Expand helpdesk source for public contact → ticket conversion
alter table public.helpdesk_tickets drop constraint if exists helpdesk_tickets_source_check;
alter table public.helpdesk_tickets
  add constraint helpdesk_tickets_source_check
  check (source in ('chat', 'email', 'manual', 'system', 'contact'));

-- Durable API rate-limit buckets (service-role only)
create table if not exists public.api_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (bucket, key_hash, window_started_at)
);
create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits (window_started_at);
alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;

-- Public contact enquiries (no sign-in required to submit; admin-only read via service role)
create table if not exists public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null,
  phone text not null default '',
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'replied', 'closed')),
  internal_notes text not null default '',
  converted_ticket_id uuid references public.helpdesk_tickets(id) on delete set null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  replied_at timestamptz,
  closed_at timestamptz
);
create index if not exists contact_enquiries_status_idx
  on public.contact_enquiries (status, created_at desc);
create index if not exists contact_enquiries_created_idx
  on public.contact_enquiries (created_at desc);
alter table public.contact_enquiries enable row level security;
revoke all on table public.contact_enquiries from anon, authenticated;

-- Expanded knowledge base covering the whole GLS TV system
insert into public.kb_articles (slug, title, summary, body_md, category, tags, sort_order)
values
  (
    'yoco-eft-payment',
    'Yoco payment link & EFT',
    'How to pay with Yoco or bank transfer and what happens next.',
    E'## Paying for membership\n\n1. Open **Pricing** or **Membership & receipts** and choose a plan (R55 / R65 / R75).\n2. **Yoco payment link** — complete payment on the secure Yoco page. Access unlocks after confirmation.\n3. **EFT / bank transfer** — follow the on-screen bank details and reference. Keep your proof of payment.\n\nAdmin verifies EFT before premium is activated. If payment is pending longer than expected, open Support chat with your reference.\n\nNever share card PINs or OTP codes with anyone claiming to be GLS support.',
    'billing',
    array['yoco', 'eft', 'payment', 'billing'],
    25
  ),
  (
    'receipts-billing',
    'Receipts and billing history',
    'Where to find receipts, plan status, and renewal reminders.',
    E'## Receipts\n\nSigned-in members can open **Membership & receipts** from the avatar menu.\n\nYou will see:\n- Current plan and trial/renewal dates\n- Payment history and manual billing status\n- Links to update or renew\n\nIn-app reminders and the notification bell also surface renewal and past-due notices. Turn notification preferences on or off under **Account**.',
    'billing',
    array['receipts', 'billing', 'renewal'],
    26
  ),
  (
    'channel-health-geo',
    'Channel health and geo limits',
    'Why a channel may fail and what geo or source limits mean.',
    E'## Channel health\n\nSome live sources are third-party FAST streams. They can go offline, buffer, or block certain regions.\n\nTips:\n1. Wait a few seconds for HLS to buffer\n2. Try another channel in the same pack\n3. Switch networks (Wi‑Fi ↔ mobile data)\n4. Report the channel via Support with the channel name and your approximate region\n\nGeo-limited sources may not play outside their licensed region. That is expected behaviour, not an account fault.',
    'watching',
    array['channels', 'geo', 'hls', 'health'],
    55
  ),
  (
    'notifications-bell',
    'Notifications and reminders',
    'How the bell, portal, and account preferences work.',
    E'## Notifications\n\n- The **bell** in the top bar shows unread in-app notices (billing, support replies, sports, activity).\n- Open **Notifications** from the avatar menu (or `/notifications`) for full history, filters, and dismiss.\n- Marking an item read syncs across devices when you are signed in.\n- Manage sports / activity / product preferences under **Account → Notifications**.',
    'account',
    array['notifications', 'bell', 'reminders'],
    45
  ),
  (
    'support-tickets',
    'Live chat and tickets',
    'How member chat, tickets (GLS-####), and admin replies work.',
    E'## Support\n\n1. Tap the chat button (bottom right) to search the knowledge base.\n2. Ask for a human to open a ticket numbered **GLS-####**.\n3. Continue the conversation in chat or at **/support**.\n4. Admin replies create an in-app notification linking back to that ticket.\n\nInclude your account email, device, and what you were watching when reporting playback issues.',
    'support',
    array['chat', 'ticket', 'helpdesk'],
    72
  ),
  (
    'account-export-deletion',
    'Export data and delete account',
    'How to download your data or request account deletion.',
    E'## Account data\n\nOpen **Account** while signed in.\n\n- **Export** — download a copy of account-related data where available.\n- **Delete account** — starts a cooling-off period before irreversible deletion. You can cancel during that window.\n\nBilling records required for tax/compliance may be retained as described in the legal pages.',
    'account',
    array['export', 'deletion', 'privacy'],
    80
  ),
  (
    'pwa-install',
    'Install GLS TV as an app (PWA)',
    'Add GLS TV to your home screen on phone or desktop.',
    E'## Install / PWA\n\nOn supported browsers:\n\n**Android Chrome** — menu → Install app / Add to Home screen.\n**iOS Safari** — Share → Add to Home Screen.\n**Desktop Chrome/Edge** — install icon in the address bar when offered.\n\nThe installed app opens fullscreen with the same account and profiles. Notifications still require a signed-in session in the browser/app.',
    'basics',
    array['pwa', 'install', 'mobile'],
    15
  ),
  (
    'playback-troubleshooting',
    'Common playback issues',
    'Black screen, buffering, audio-only, and autoplay fixes.',
    E'## Playback troubleshooting\n\n1. **Black screen / spinner** — wait 10–15s for HLS; refresh the page; try another source.\n2. **Buffering** — lower network congestion; switch Wi‑Fi/data; close other video tabs.\n3. **Autoplay blocked** — tap play once; some browsers require a user gesture.\n4. **Kids profile** — some titles are hidden by design.\n5. **Still broken** — note the channel title, time, and device, then open Support chat.',
    'watching',
    array['playback', 'hls', 'buffering', 'troubleshoot'],
    56
  )
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  body_md = excluded.body_md,
  category = excluded.category,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_published = true,
  updated_at = now();

-- Refresh existing contact-support blurb to mention public contact on /auth
update public.kb_articles
set
  summary = 'Knowledge base first, live chat tickets, or public contact from sign-in.',
  body_md = E'## Support\n\n1. Search this knowledge base\n2. Use the **chat** button (signed-in) for ticket **GLS-####**\n3. Not signed in? On **/auth**, tap **Message GLS** to leave email + phone — we reply as soon as possible\n4. Members can also open **/support** for full ticket history\n\nInclude your account email and what you were watching when you report playback issues.',
  updated_at = now()
where slug = 'contact-support';

-- Demo helpdesk ticket with realistic message history (idempotent)
do $$
declare
  tid uuid;
begin
  select id into tid
  from public.helpdesk_tickets
  where subject = '[DEMO] Playback buffering on Sports channel'
  limit 1;

  if tid is null then
    insert into public.helpdesk_tickets (
      subject,
      description,
      status,
      priority,
      category,
      source,
      requester_email
    ) values (
      '[DEMO] Playback buffering on Sports channel',
      'Demo ticket for admin training — safe to close. Not a real customer.',
      'in_progress',
      'medium',
      'support',
      'chat',
      'demo.member@example.com'
    )
    returning id into tid;

    insert into public.helpdesk_messages (ticket_id, author_type, author_email, body, created_at)
    values
      (
        tid,
        'user',
        'demo.member@example.com',
        'Hi GLS — the SuperSport-style channel in Sports keeps buffering after about 30 seconds. I am on Wi‑Fi in Gauteng. Trial account. Can you help?',
        now() - interval '2 hours'
      ),
      (
        tid,
        'agent',
        'support@gls.tv',
        'Thanks for reporting this. We are checking the HLS source health for that pack. Meanwhile, try another Sports channel or switch to mobile data briefly to rule out Wi‑Fi congestion.',
        now() - interval '90 minutes'
      ),
      (
        tid,
        'user',
        'demo.member@example.com',
        'Mobile data plays a bit better but still stutters. Happy to wait if you are healing the source.',
        now() - interval '60 minutes'
      ),
      (
        tid,
        'system',
        null,
        '[DEMO] Status set to in_progress — sample system note for admin UI training.',
        now() - interval '55 minutes'
      ),
      (
        tid,
        'agent',
        'support@gls.tv',
        'We flagged the source for heal. I will update you when it is stable again. You can reply here anytime — this thread stays under your ticket number.',
        now() - interval '30 minutes'
      );

    insert into public.helpdesk_status_history (ticket_id, from_status, to_status, actor_type, created_at)
    values
      (tid, null, 'open', 'user', now() - interval '2 hours'),
      (tid, 'open', 'in_progress', 'agent', now() - interval '90 minutes');
  end if;
end $$;

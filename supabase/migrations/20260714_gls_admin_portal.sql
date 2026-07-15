-- GLS Admin Portal: helpdesk, knowledge base, chat widget, system links

-- Ticket number sequence → GLS-0001, GLS-0002, …
CREATE SEQUENCE IF NOT EXISTS helpdesk_ticket_seq START 1;

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL DEFAULT (
    'GLS-' || lpad(nextval('helpdesk_ticket_seq')::text, 4, '0')
  ),
  subject text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category text DEFAULT 'general',
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('chat', 'email', 'manual', 'system')),
  requester_email text,
  requester_user_id uuid,
  assignee_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS helpdesk_tickets_status_idx ON helpdesk_tickets (status);
CREATE INDEX IF NOT EXISTS helpdesk_tickets_updated_idx ON helpdesk_tickets (updated_at DESC);

CREATE TABLE IF NOT EXISTS helpdesk_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL DEFAULT 'user'
    CHECK (author_type IN ('user', 'agent', 'system')),
  author_email text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS helpdesk_messages_ticket_idx ON helpdesk_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text DEFAULT '',
  body_md text DEFAULT '',
  category text DEFAULT 'general',
  tags text[] DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_widget_config (
  id text PRIMARY KEY DEFAULT 'default',
  welcome_title text NOT NULL DEFAULT 'GLS Support',
  welcome_body text NOT NULL DEFAULT 'Ask anything about GLS TV — we search the knowledge base first.',
  primary_color text NOT NULL DEFAULT '#e50914',
  position text NOT NULL DEFAULT 'bottom-right',
  show_kb_first boolean NOT NULL DEFAULT true,
  ask_human_label text NOT NULL DEFAULT 'Talk to support',
  offline_message text NOT NULL DEFAULT 'No agents online. We created a ticket for you.',
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO chat_widget_config (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_system_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  placement text NOT NULL DEFAULT 'nav',
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE helpdesk_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_widget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_system_links ENABLE ROW LEVEL SECURITY;

-- Public read for published KB + chat config + active system links
DROP POLICY IF EXISTS kb_articles_public_read ON kb_articles;
CREATE POLICY kb_articles_public_read ON kb_articles
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS chat_config_public_read ON chat_widget_config;
CREATE POLICY chat_config_public_read ON chat_widget_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS system_links_public_read ON admin_system_links;
CREATE POLICY system_links_public_read ON admin_system_links
  FOR SELECT USING (is_active = true);

-- Seed knowledge base (GLS TV system)
INSERT INTO kb_articles (slug, title, summary, body_md, category, tags, sort_order)
VALUES
  (
    'getting-started',
    'Getting started with GLS TV',
    'How to create an account, pick profiles, and start watching.',
    E'## Getting started\n\n1. Sign up or sign in at **/auth**\n2. Verify your email\n3. Choose a viewer profile (Who''s watching)\n4. Browse Home, Sports, Live TV, Movies, or Series\n\nAdult plans include a Kids profile. Profiles keep separate Continue Watching and My List.',
    'basics',
    ARRAY['start', 'account', 'profiles'],
    10
  ),
  (
    'membership-plans',
    'Membership plans (ZAR)',
    'R55 / R65 / R75 tiers and what each includes.',
    E'## Plans\n\n- **R55** — 2 adult profiles + Kids\n- **R65** — 3 adult profiles + Kids\n- **R75** — 4 adult profiles + Kids\n\nNew members can start a **14-day trial**. Device/IP rules prevent sharing one trial across many emails on the same device.',
    'billing',
    ARRAY['plans', 'pricing', 'trial'],
    20
  ),
  (
    'trial-device-lock',
    'Trial and device lock',
    'Why a second email on the same device may be blocked from another trial.',
    E'## Trial device lock\n\nIf email A used a 14-day trial on a device/IP, email B cannot start another trial on that same device for 14 days.\n\nPaid members, exception accounts, and GLS admins are not blocked.',
    'billing',
    ARRAY['trial', 'device'],
    30
  ),
  (
    'profiles-watching',
    'Who''s watching & avatars',
    'Add, edit, and switch viewer profiles.',
    E'## Profiles\n\nEach membership can create viewer profiles (adults + Kids).\n\n- Use the avatar menu (top right) to switch\n- Manage Profiles to add/edit/remove\n- Kids profile gates child-friendly browsing\n- Library (Continue / My List / Favorites) is per profile',
    'basics',
    ARRAY['profiles', 'kids', 'avatars'],
    40
  ),
  (
    'live-sports',
    'Live TV & Sports',
    'Where to find linear channels and Match Day.',
    E'## Live & Sports\n\n- **Sports** hub — packs, leagues, and Match Day schedule\n- **Live TV** — linear FAST and seeded channels\n- Playback uses HLS; some sources may need a moment to buffer\n\nIf a channel fails, try another source from the same pack or report via Support chat.',
    'watching',
    ARRAY['sports', 'live', 'hls'],
    50
  ),
  (
    'playlists-m3u',
    'M3U playlists',
    'Add your own playlist links for personal channels.',
    E'## Playlists\n\nSigned-in members can open **My Playlists** (or + M3U in the nav) and paste an M3U URL.\n\nChannels from your playlist appear in your account for playback alongside the catalog.',
    'watching',
    ARRAY['m3u', 'playlist'],
    60
  ),
  (
    'contact-support',
    'Contact support',
    'Knowledge base first, then live chat / ticket GLS-####.',
    E'## Support\n\n1. Search this knowledge base (entire GLS TV system help)\n2. Use the **?** chat button if you still need help\n3. If no agent is available, you get a ticket number like **GLS-0001**\n\nInclude your account email and what you were watching when you report playback issues.',
    'support',
    ARRAY['help', 'ticket', 'chat'],
    70
  )
ON CONFLICT (slug) DO NOTHING;

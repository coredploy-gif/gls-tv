-- user_playlist_channels + playlist status fields
-- Applied remotely via Supabase MCP (user_playlist_channels)

CREATE TABLE IF NOT EXISTS public.user_playlist_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.user_playlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  poster text NOT NULL DEFAULT '',
  backdrop text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  countries text[] NOT NULL DEFAULT '{}',
  tvg_id text,
  stream_url text NOT NULL,
  quality text NOT NULL DEFAULT 'Auto',
  format text NOT NULL DEFAULT 'hls',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS user_playlist_channels_playlist_idx
  ON public.user_playlist_channels (playlist_id, sort_order);
CREATE INDEX IF NOT EXISTS user_playlist_channels_user_idx
  ON public.user_playlist_channels (user_id);

ALTER TABLE public.user_playlists
  ADD COLUMN IF NOT EXISTS channel_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.user_playlist_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS playlist_channels_own_all ON public.user_playlist_channels;
CREATE POLICY playlist_channels_own_all ON public.user_playlist_channels
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

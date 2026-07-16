-- User media links (HLS / YouTube / Vimeo / MP4 / WebM)
-- Personal library separate from IPTV playlists

CREATE TYPE public.media_link_format AS ENUM (
  'hls',
  'youtube',
  'vimeo',
  'mp4',
  'webm'
);

CREATE TYPE public.media_link_status AS ENUM (
  'active',
  'checking',
  'dead',
  'error'
);

CREATE TABLE IF NOT EXISTS public.user_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  format public.media_link_format NOT NULL DEFAULT 'hls',
  status public.media_link_status NOT NULL DEFAULT 'active',
  thumbnail_url text,
  category text NOT NULL DEFAULT 'Uncategorized',
  is_favorite boolean NOT NULL DEFAULT false,
  embed_url text,
  video_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

CREATE INDEX IF NOT EXISTS user_media_links_user_created_idx
  ON public.user_media_links (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_media_links_user_category_idx
  ON public.user_media_links (user_id, category);
CREATE INDEX IF NOT EXISTS user_media_links_user_favorite_idx
  ON public.user_media_links (user_id, is_favorite)
  WHERE is_favorite = true;

ALTER TABLE public.user_media_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_media_links_own_all ON public.user_media_links;
CREATE POLICY user_media_links_own_all ON public.user_media_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_media_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_media_links_updated_at ON public.user_media_links;
CREATE TRIGGER user_media_links_updated_at
  BEFORE UPDATE ON public.user_media_links
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_media_links_updated_at();

-- Admin-curated playable links (published to members as inspiration / catalog seeds)
CREATE TABLE IF NOT EXISTS public.admin_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  format public.media_link_format NOT NULL DEFAULT 'hls',
  category text NOT NULL DEFAULT 'Featured',
  thumbnail_url text,
  embed_url text,
  video_id text,
  is_published boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_media_links_published_idx
  ON public.admin_media_links (is_published, created_at DESC);

ALTER TABLE public.admin_media_links ENABLE ROW LEVEL SECURITY;

-- Members can read published admin links; writes go through service role / admin APIs
DROP POLICY IF EXISTS admin_media_links_public_read ON public.admin_media_links;
CREATE POLICY admin_media_links_public_read ON public.admin_media_links
  FOR SELECT
  USING (is_published = true);

-- Admin-managed stream seeds (TSN slots, custom leagues, etc.)
-- Public can read active URLs for playback; writes go through eadmin API (service role).

CREATE TABLE IF NOT EXISTS public.stream_seeds (
  slug text PRIMARY KEY,
  title text NOT NULL,
  url text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT ARRAY['Sports']::text[],
  countries text[] NOT NULL DEFAULT ARRAY['world']::text[],
  poster text NOT NULL DEFAULT '',
  backdrop text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_seeds_active_idx
  ON public.stream_seeds (is_active)
  WHERE is_active = true;

ALTER TABLE public.stream_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stream_seeds_public_read ON public.stream_seeds;
CREATE POLICY stream_seeds_public_read ON public.stream_seeds
  FOR SELECT
  USING (is_active = true);

-- Writes: service role only (bypasses RLS). Eadmin API verifies allowlist then upserts.

INSERT INTO public.stream_seeds (slug, title, url, categories, countries) VALUES
  ('tsn1-ca-sd', 'TSN 1', '', ARRAY['Sports','TSN','Canada','Popular','UserSeed'], ARRAY['ca','world']),
  ('tsn2-ca-sd', 'TSN 2', '', ARRAY['Sports','TSN','Canada','Popular','UserSeed'], ARRAY['ca','world']),
  ('tsn3-ca-sd', 'TSN 3', '', ARRAY['Sports','TSN','Canada','Popular','UserSeed'], ARRAY['ca','world']),
  ('tsn4-ca-sd', 'TSN 4', '', ARRAY['Sports','TSN','Canada','Popular','UserSeed'], ARRAY['ca','world']),
  ('tsn5-ca-sd', 'TSN 5', '', ARRAY['Sports','TSN','Canada','Popular','UserSeed'], ARRAY['ca','world'])
ON CONFLICT (slug) DO NOTHING;

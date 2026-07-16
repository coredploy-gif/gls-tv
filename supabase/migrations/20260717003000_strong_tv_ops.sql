-- Strong TV ops: signup freeze flag, link reports, lightweight EPG, geo hints

ALTER TABLE public.feature_flags
  DROP CONSTRAINT IF EXISTS feature_flags_key_check;

ALTER TABLE public.feature_flags
  ADD CONSTRAINT feature_flags_key_check
  CHECK (
    key = ANY (
      ARRAY[
        'payments'::text,
        'playlist_imports'::text,
        'hls_proxy'::text,
        'catalog_publish'::text,
        'signups'::text
      ]
    )
  );

INSERT INTO public.feature_flags (key, enabled, reason, updated_at)
VALUES (
  'signups',
  true,
  'Freeze new account creation when disabled',
  now()
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.link_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('user_media_link', 'admin_media_link', 'playlist_channel', 'catalog')),
  target_id text NOT NULL,
  target_url text,
  target_title text,
  reason text NOT NULL DEFAULT 'other',
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS link_reports_status_idx
  ON public.link_reports (status, created_at DESC);

ALTER TABLE public.link_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS link_reports_insert_own ON public.link_reports;
CREATE POLICY link_reports_insert_own ON public.link_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS link_reports_select_own ON public.link_reports;
CREATE POLICY link_reports_select_own ON public.link_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_user_id);

-- Lightweight now/next EPG (manual/admin seeded; not full XMLTV)
CREATE TABLE IF NOT EXISTS public.epg_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_slug text NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS epg_slots_slug_time_idx
  ON public.epg_slots (channel_slug, starts_at, ends_at);

ALTER TABLE public.epg_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS epg_slots_public_read ON public.epg_slots;
CREATE POLICY epg_slots_public_read ON public.epg_slots
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional geo preference tags on mirrors (comma regions e.g. ZA,AF,WORLD)
ALTER TABLE public.channel_sources
  ADD COLUMN IF NOT EXISTS geo_regions text;

CREATE INDEX IF NOT EXISTS channel_sources_geo_idx
  ON public.channel_sources (geo_regions)
  WHERE geo_regions IS NOT NULL;

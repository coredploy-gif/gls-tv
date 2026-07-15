-- Netflix-style simultaneous adult/kids device sessions

CREATE TABLE IF NOT EXISTS public.viewer_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_profile_id uuid NOT NULL REFERENCES public.viewer_profiles(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  device_hash text NOT NULL,
  device_label text,
  audience text NOT NULL CHECK (audience IN ('adult', 'kids')),
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS viewer_device_sessions_active_device_uidx
  ON public.viewer_device_sessions (user_id, device_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS viewer_device_sessions_active_audience_idx
  ON public.viewer_device_sessions (user_id, audience, last_active_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS viewer_device_sessions_token_idx
  ON public.viewer_device_sessions (session_token)
  WHERE revoked_at IS NULL;

ALTER TABLE public.viewer_device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS viewer_device_sessions_select_own ON public.viewer_device_sessions;
CREATE POLICY viewer_device_sessions_select_own
  ON public.viewer_device_sessions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS viewer_device_sessions_update_own ON public.viewer_device_sessions;
CREATE POLICY viewer_device_sessions_update_own
  ON public.viewer_device_sessions
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE ALL ON public.viewer_device_sessions FROM anon;
GRANT SELECT, UPDATE ON public.viewer_device_sessions TO authenticated;

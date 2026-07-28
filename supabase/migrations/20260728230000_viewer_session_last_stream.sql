-- Stream activity for admin “Watching” vs “Online”
ALTER TABLE public.viewer_device_sessions
  ADD COLUMN IF NOT EXISTS last_stream_at timestamptz;

CREATE INDEX IF NOT EXISTS viewer_device_sessions_stream_active_idx
  ON public.viewer_device_sessions (last_stream_at DESC)
  WHERE revoked_at IS NULL AND last_stream_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS viewer_device_sessions_user_active_idx
  ON public.viewer_device_sessions (user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

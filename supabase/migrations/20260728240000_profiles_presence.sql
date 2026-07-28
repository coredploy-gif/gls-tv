-- Account-level presence (admin Online) even without a Who's watching device session.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_stream_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_last_stream_at_idx
  ON public.profiles (last_stream_at DESC)
  WHERE last_stream_at IS NOT NULL;

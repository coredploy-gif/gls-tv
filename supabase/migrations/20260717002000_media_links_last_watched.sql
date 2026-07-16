-- Track recently watched user media links
ALTER TABLE public.user_media_links
  ADD COLUMN IF NOT EXISTS last_watched_at timestamptz;

CREATE INDEX IF NOT EXISTS user_media_links_user_watched_idx
  ON public.user_media_links (user_id, last_watched_at DESC NULLS LAST)
  WHERE last_watched_at IS NOT NULL;

-- Admin drafts default unpublished until confirm-publish
ALTER TABLE public.admin_media_links
  ALTER COLUMN is_published SET DEFAULT false;

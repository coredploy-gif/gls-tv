-- Admin-gated Google OAuth (default off). Apple flag reserved for later; UI stays hidden.
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
        'signups'::text,
        'oauth_google'::text,
        'oauth_apple'::text
      ]
    )
  );

INSERT INTO public.feature_flags (key, enabled, reason, updated_at)
VALUES
  (
    'oauth_google',
    false,
    'Show Continue with Google on /auth when enabled (also requires Supabase Google provider)',
    now()
  ),
  (
    'oauth_apple',
    false,
    'Reserved — Apple Sign-In deferred (Apple Developer); UI does not show Apple while disabled',
    now()
  )
ON CONFLICT (key) DO NOTHING;

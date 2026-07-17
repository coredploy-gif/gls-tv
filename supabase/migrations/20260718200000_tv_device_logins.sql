-- TV device / QR pairing codes for living-room sign-in.
-- All access is via service-role API routes (no anon/authenticated grants).

CREATE TABLE IF NOT EXISTS public.tv_device_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code text NOT NULL,
  device_secret text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'consumed', 'expired', 'canceled')),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  session_token_hash text,
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  consumed_at timestamptz,
  canceled_at timestamptz,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tv_device_logins_user_code_format
    CHECK (user_code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  CONSTRAINT tv_device_logins_secret_len
    CHECK (char_length(device_secret) >= 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS tv_device_logins_user_code_uidx
  ON public.tv_device_logins (user_code)
  WHERE status IN ('pending', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS tv_device_logins_device_secret_uidx
  ON public.tv_device_logins (device_secret);

CREATE INDEX IF NOT EXISTS tv_device_logins_expires_idx
  ON public.tv_device_logins (expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tv_device_logins_status_created_idx
  ON public.tv_device_logins (status, created_at DESC);

ALTER TABLE public.tv_device_logins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tv_device_logins FROM anon, authenticated;
-- service_role bypasses RLS; no policies needed for client roles.

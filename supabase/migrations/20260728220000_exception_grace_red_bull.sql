-- Exception ungrant → pay-by-1st grace → Red Bull-only lock

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS exception_grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS exception_grace_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS exception_last_nudge_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_access_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_access_tier_check
  CHECK (access_tier IN ('full', 'red_bull_only'));

CREATE INDEX IF NOT EXISTS profiles_exception_grace_ends_idx
  ON public.profiles (exception_grace_ends_at)
  WHERE exception_grace_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_access_tier_idx
  ON public.profiles (access_tier)
  WHERE access_tier <> 'full';

-- Expand reminder kinds for grace nudges
ALTER TABLE public.user_reminders
  DROP CONSTRAINT IF EXISTS user_reminders_kind_check;

ALTER TABLE public.user_reminders
  ADD CONSTRAINT user_reminders_kind_check
  CHECK (kind IN (
    'trial_ending',
    'trial_ended',
    'past_due',
    'renewal',
    'payment_failed',
    'ticket_reply',
    'admin',
    'system',
    'exception_grace'
  ));

-- Clear grace / restricted tier when a paid plan activates
CREATE OR REPLACE FUNCTION public.clear_exception_grace_on_premium()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_premium IS TRUE AND COALESCE(OLD.is_premium, false) IS DISTINCT FROM TRUE THEN
    NEW.access_tier := 'full';
    NEW.exception_grace_ends_at := NULL;
    NEW.exception_grace_started_at := NULL;
    NEW.exception_last_nudge_at := NULL;
    NEW.trial_bypassed := false;
    NEW.is_admin_exception := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_clear_exception_grace ON public.profiles;
CREATE TRIGGER profiles_clear_exception_grace
  BEFORE UPDATE OF is_premium ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_exception_grace_on_premium();

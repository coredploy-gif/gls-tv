-- Billing / finance admin support
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_uidx ON public.subscriptions (user_id);

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text,
    'inactive'::text, 'unpaid'::text, 'incomplete'::text, 'incomplete_expired'::text,
    'paused'::text
  ]));

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS amount_zar_cents int,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'zar';

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_zar_cents int,
  currency text DEFAULT 'zar',
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_created_idx ON public.billing_events (created_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Manual/Yoco launch billing: member references, payment queue, receipts and settings

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_reference text;

CREATE OR REPLACE FUNCTION public.set_member_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.member_reference IS NULL OR btrim(NEW.member_reference) = '' THEN
    NEW.member_reference :=
      'GLS-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_member_reference ON public.profiles;
CREATE TRIGGER profiles_set_member_reference
  BEFORE INSERT OR UPDATE OF member_reference ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_member_reference();

UPDATE public.profiles
SET member_reference =
  'GLS-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE member_reference IS NULL OR btrim(member_reference) = '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_member_reference_uidx
  ON public.profiles (member_reference);

CREATE SEQUENCE IF NOT EXISTS public.payment_receipt_seq START 1;

CREATE TABLE IF NOT EXISTS public.manual_payment_settings (
  id text PRIMARY KEY DEFAULT 'default',
  trading_name text NOT NULL DEFAULT 'GLS TV',
  support_email text,
  yoco_enabled boolean NOT NULL DEFAULT true,
  eft_enabled boolean NOT NULL DEFAULT true,
  bank_name text,
  account_holder text,
  account_number text,
  branch_code text,
  account_type text,
  payment_note text NOT NULL DEFAULT
    'Use the exact GLS payment reference. Access is activated after payment verification.',
  receipt_footer text NOT NULL DEFAULT
    'Thank you for your GLS TV membership.',
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.manual_payment_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_reference text NOT NULL,
  payment_reference text UNIQUE NOT NULL,
  plan text NOT NULL CHECK (plan IN ('gls_55', 'gls_65', 'gls_75')),
  amount_zar_cents int NOT NULL CHECK (amount_zar_cents > 0),
  currency text NOT NULL DEFAULT 'zar' CHECK (currency = 'zar'),
  payment_method text NOT NULL DEFAULT 'unselected'
    CHECK (payment_method IN ('unselected', 'yoco', 'eft', 'cash', 'other')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'proof_submitted', 'verifying', 'paid', 'rejected',
      'expired', 'canceled', 'refunded'
    )),
  yoco_link_id text,
  yoco_payment_url text,
  yoco_status text,
  external_transaction_id text,
  proof_reference text,
  proof_note text,
  member_note text,
  admin_note text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by text,
  paid_at timestamptz,
  membership_starts_at timestamptz,
  membership_ends_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_payment_requests_user_idx
  ON public.manual_payment_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_payment_requests_status_idx
  ON public.manual_payment_requests (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS manual_payment_requests_member_ref_idx
  ON public.manual_payment_requests (member_reference);
CREATE INDEX IF NOT EXISTS manual_payment_requests_payment_ref_idx
  ON public.manual_payment_requests (payment_reference);
CREATE UNIQUE INDEX IF NOT EXISTS manual_payment_external_txn_uidx
  ON public.manual_payment_requests (external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL DEFAULT (
    'GLS-RCT-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.payment_receipt_seq')::text, 6, '0')
  ),
  payment_request_id uuid UNIQUE NOT NULL
    REFERENCES public.manual_payment_requests(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  member_reference text NOT NULL,
  payment_reference text NOT NULL,
  plan text NOT NULL,
  amount_zar_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'zar',
  payment_method text NOT NULL,
  external_transaction_id text,
  customer_name text,
  customer_email text,
  trading_name text NOT NULL DEFAULT 'GLS TV',
  membership_starts_at timestamptz NOT NULL,
  membership_ends_at timestamptz NOT NULL,
  paid_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by text,
  receipt_footer text,
  refunded_at timestamptz,
  refund_note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS payment_receipts_user_idx
  ON public.payment_receipts (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS payment_receipts_issued_idx
  ON public.payment_receipts (issued_at DESC);

CREATE TABLE IF NOT EXISTS public.manual_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid NOT NULL
    REFERENCES public.manual_payment_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_email text,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_payment_events_payment_idx
  ON public.manual_payment_events (payment_request_id, created_at);

ALTER TABLE public.manual_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_payment_requests_select_own
  ON public.manual_payment_requests;
CREATE POLICY manual_payment_requests_select_own
  ON public.manual_payment_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS payment_receipts_select_own
  ON public.payment_receipts;
CREATE POLICY payment_receipts_select_own
  ON public.payment_receipts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS manual_payment_events_select_own
  ON public.manual_payment_events;
CREATE POLICY manual_payment_events_select_own
  ON public.manual_payment_events
  FOR SELECT USING (auth.uid() = user_id);

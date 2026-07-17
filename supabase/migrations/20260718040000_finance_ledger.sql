-- Light in-house finance ledger: membership revenue, decline fees, refunds, uncollected AR

CREATE TABLE IF NOT EXISTS public.finance_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_request_id uuid REFERENCES public.manual_payment_requests(id) ON DELETE SET NULL,
  receipt_id uuid REFERENCES public.payment_receipts(id) ON DELETE SET NULL,
  account text NOT NULL CHECK (
    account = ANY (
      ARRAY[
        'membership_revenue'::text,
        'decline_fee'::text,
        'refund'::text,
        'uncollected'::text
      ]
    )
  ),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['credit'::text, 'debit'::text])),
  amount_zar_cents integer NOT NULL CHECK (amount_zar_cents > 0),
  currency text NOT NULL DEFAULT 'zar',
  description text,
  pf_payment_id text,
  payment_reference text,
  plan text,
  source_event text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_ledger_entries_entry_at_idx
  ON public.finance_ledger_entries (entry_at DESC);

CREATE INDEX IF NOT EXISTS finance_ledger_entries_user_id_idx
  ON public.finance_ledger_entries (user_id, entry_at DESC);

CREATE INDEX IF NOT EXISTS finance_ledger_entries_payment_request_idx
  ON public.finance_ledger_entries (payment_request_id);

CREATE INDEX IF NOT EXISTS finance_ledger_entries_account_idx
  ON public.finance_ledger_entries (account, entry_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS finance_ledger_entries_idempotent_uidx
  ON public.finance_ledger_entries (
    source_event,
    account,
    direction,
    coalesce(payment_request_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(pf_payment_id, '')
  );

ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_ledger_service_only ON public.finance_ledger_entries
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Idempotent ledger insert (service_role via RPCs/triggers only)
CREATE OR REPLACE FUNCTION public.post_finance_ledger_entry(
  p_entry_at timestamptz,
  p_user_id uuid,
  p_payment_request_id uuid,
  p_receipt_id uuid,
  p_account text,
  p_direction text,
  p_amount_zar_cents integer,
  p_currency text,
  p_description text,
  p_pf_payment_id text,
  p_payment_reference text,
  p_plan text,
  p_source_event text,
  p_meta jsonb DEFAULT '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_amount_zar_cents is null or p_amount_zar_cents <= 0 then
    return null;
  end if;
  if p_account not in ('membership_revenue', 'decline_fee', 'refund', 'uncollected') then
    raise exception 'Invalid ledger account %', p_account;
  end if;
  if p_direction not in ('credit', 'debit') then
    raise exception 'Invalid ledger direction %', p_direction;
  end if;

  if exists (
    select 1 from public.finance_ledger_entries
    where source_event = p_source_event
      and account = p_account
      and direction = p_direction
      and coalesce(payment_request_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_payment_request_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(pf_payment_id, '') = coalesce(nullif(btrim(p_pf_payment_id), ''), '')
  ) then
    return null;
  end if;

  insert into public.finance_ledger_entries (
    entry_at, user_id, payment_request_id, receipt_id, account, direction,
    amount_zar_cents, currency, description, pf_payment_id, payment_reference,
    plan, source_event, meta
  ) values (
    coalesce(p_entry_at, now()),
    p_user_id,
    p_payment_request_id,
    p_receipt_id,
    p_account,
    p_direction,
    p_amount_zar_cents,
    coalesce(nullif(btrim(p_currency), ''), 'zar'),
    p_description,
    nullif(btrim(p_pf_payment_id), ''),
    nullif(btrim(p_payment_reference), ''),
    nullif(btrim(p_plan), ''),
    p_source_event,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.post_finance_ledger_entry(
  timestamptz, uuid, uuid, uuid, text, text, integer, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.post_finance_ledger_entry(
  timestamptz, uuid, uuid, uuid, text, text, integer, text, text, text, text, text, text, jsonb
) to service_role;

-- Outstanding opened → uncollected debit (AR)
CREATE OR REPLACE FUNCTION public.trg_finance_ledger_outstanding_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.billing_kind = 'outstanding'
    and NEW.status in ('pending', 'verifying', 'proof_submitted')
  then
    perform public.post_finance_ledger_entry(
      coalesce(NEW.dunning_opened_at, NEW.created_at, now()),
      NEW.user_id,
      NEW.id,
      null,
      'uncollected',
      'debit',
      NEW.amount_zar_cents,
      coalesce(NEW.currency, 'zar'),
      'Outstanding debit opened',
      NEW.pf_payment_id,
      NEW.payment_reference,
      NEW.plan,
      'outstanding_opened',
      jsonb_build_object(
        'dunningFeeCents', NEW.dunning_fee_cents,
        'dunningParentPfPaymentId', NEW.dunning_parent_pf_payment_id
      )
    );
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS finance_ledger_outstanding_opened_trg ON public.manual_payment_requests;
CREATE TRIGGER finance_ledger_outstanding_opened_trg
  AFTER INSERT ON public.manual_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_finance_ledger_outstanding_opened();

-- Refund recorded → refund debit
CREATE OR REPLACE FUNCTION public.trg_finance_ledger_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if OLD.refunded_at is null and NEW.refunded_at is not null then
    perform public.post_finance_ledger_entry(
      NEW.refunded_at,
      NEW.user_id,
      NEW.payment_request_id,
      NEW.id,
      'refund',
      'debit',
      NEW.amount_zar_cents,
      coalesce(NEW.currency, 'zar'),
      'Payment refunded',
      null,
      NEW.payment_reference,
      NEW.plan,
      'payment_refunded',
      jsonb_build_object(
        'receiptNumber', NEW.receipt_number,
        'refundNote', NEW.refund_note
      )
    );
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS finance_ledger_refund_trg ON public.payment_receipts;
CREATE TRIGGER finance_ledger_refund_trg
  AFTER UPDATE OF refunded_at ON public.payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_finance_ledger_refund();

-- activate_manual_payment + ledger posting
CREATE OR REPLACE FUNCTION public.activate_manual_payment(
  p_payment_id uuid,
  p_admin_email text,
  p_external_transaction_id text,
  p_payment_method text,
  p_admin_note text default null,
  p_paid_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.manual_payment_requests%rowtype;
  v_receipt public.payment_receipts%rowtype;
  v_current_end timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_transaction text;
  v_profile public.profiles%rowtype;
  v_settings public.manual_payment_settings%rowtype;
  v_max_profiles int;
  v_provider text;
  v_external_id text;
  v_fee int;
  v_revenue int;
begin
  select * into v_payment
  from public.manual_payment_requests
  where id = p_payment_id
  for update;
  if not found then raise exception 'Payment not found'; end if;

  select * into v_receipt
  from public.payment_receipts
  where payment_request_id = p_payment_id;
  if found then
    return jsonb_build_object(
      'alreadyPaid', true,
      'payment', to_jsonb(v_payment),
      'receipt', to_jsonb(v_receipt)
    );
  end if;
  if v_payment.status in ('refunded', 'canceled', 'expired') then
    raise exception 'Payment cannot be activated from status %', v_payment.status;
  end if;
  if p_payment_method not in ('yoco', 'payfast', 'eft', 'cash', 'other') then
    raise exception 'Invalid payment method';
  end if;
  v_payment.payment_method := p_payment_method;
  v_transaction := nullif(btrim(coalesce(
    p_external_transaction_id, v_payment.external_transaction_id
  )), '');
  if v_payment.payment_method in ('eft', 'yoco', 'payfast') and v_transaction is null then
    raise exception 'External transaction ID is required';
  end if;
  if v_transaction is not null and exists (
    select 1 from public.manual_payment_requests
    where external_transaction_id = v_transaction and id <> p_payment_id
  ) then
    raise exception 'External transaction ID is already used';
  end if;

  select current_period_end into v_current_end
  from public.subscriptions
  where user_id = v_payment.user_id
  for update;
  v_start := greatest(coalesce(v_current_end, p_paid_at), p_paid_at);
  if v_payment.billing_kind = 'debit_order' and v_payment.next_billing_at is not null then
    v_end := (v_payment.next_billing_at::timestamp + interval '12 hours') at time zone 'UTC';
    if v_end <= v_start then
      v_end := v_start + interval '30 days';
    end if;
  elsif v_payment.billing_kind = 'outstanding' then
    v_end := v_start + interval '1 month';
  else
    v_end := v_start + interval '30 days';
  end if;
  v_max_profiles := case v_payment.plan
    when 'gls_55' then 3 when 'gls_65' then 4 else 5 end;
  select * into v_profile from public.profiles where id = v_payment.user_id;
  select * into v_settings from public.manual_payment_settings where id = 'default';
  v_provider := case v_payment.payment_method
    when 'yoco' then 'yoco'
    when 'payfast' then 'payfast'
    else 'manual'
  end;
  v_external_id := coalesce(
    nullif(btrim(v_payment.payfast_token), ''),
    v_transaction,
    v_payment.payment_reference
  );

  update public.profiles set
    plan = v_payment.plan,
    is_premium = true,
    is_admin_exception = false,
    max_viewer_profiles = v_max_profiles,
    updated_at = now()
  where id = v_payment.user_id;
  insert into public.subscriptions (
    user_id, plan, status, provider, external_id, current_period_end,
    amount_zar_cents, currency, updated_at,
    payfast_token, debit_day, next_billing_at, debit_status, dunning_paused_at
  ) values (
    v_payment.user_id, v_payment.plan, 'active',
    v_provider,
    v_external_id, v_end,
    coalesce(v_payment.recurring_amount_cents, v_payment.amount_zar_cents), 'zar', now(),
    nullif(btrim(v_payment.payfast_token), ''),
    v_payment.debit_day,
    v_payment.next_billing_at,
    case
      when v_payment.billing_kind = 'outstanding' then 'active'
      when v_payment.billing_kind = 'debit_order' then 'active'
      else null
    end,
    case when v_payment.billing_kind = 'outstanding' then null else null end
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    provider = excluded.provider,
    external_id = coalesce(excluded.external_id, public.subscriptions.external_id),
    current_period_end = excluded.current_period_end,
    amount_zar_cents = coalesce(excluded.amount_zar_cents, public.subscriptions.amount_zar_cents),
    currency = excluded.currency,
    updated_at = excluded.updated_at,
    payfast_token = coalesce(excluded.payfast_token, public.subscriptions.payfast_token),
    debit_day = coalesce(excluded.debit_day, public.subscriptions.debit_day),
    next_billing_at = coalesce(excluded.next_billing_at, public.subscriptions.next_billing_at),
    debit_status = case
      when v_payment.billing_kind = 'outstanding' then 'active'
      when excluded.debit_status is not null then excluded.debit_status
      else public.subscriptions.debit_status
    end,
    dunning_paused_at = case
      when v_payment.billing_kind = 'outstanding' then null
      else public.subscriptions.dunning_paused_at
    end;
  update public.manual_payment_requests set
    payment_method = v_payment.payment_method,
    status = 'paid',
    paid_at = p_paid_at,
    submitted_at = coalesce(submitted_at, p_paid_at),
    verified_at = now(),
    verified_by = p_admin_email,
    external_transaction_id = v_transaction,
    admin_note = coalesce(p_admin_note, admin_note),
    membership_starts_at = v_start,
    membership_ends_at = v_end,
    updated_at = now()
  where id = p_payment_id
  returning * into v_payment;
  insert into public.payment_receipts (
    payment_request_id, user_id, member_reference, payment_reference, plan,
    amount_zar_cents, payment_method, external_transaction_id, customer_name,
    customer_email, trading_name, membership_starts_at, membership_ends_at,
    paid_at, issued_by, receipt_footer
  ) values (
    p_payment_id, v_payment.user_id, v_payment.member_reference,
    v_payment.payment_reference, v_payment.plan, v_payment.amount_zar_cents,
    v_payment.payment_method, v_transaction, v_profile.display_name,
    v_profile.email, coalesce(v_settings.trading_name, 'GLS TV'),
    v_start, v_end, p_paid_at, p_admin_email, v_settings.receipt_footer
  ) returning * into v_receipt;
  insert into public.manual_payment_events (
    payment_request_id, user_id, event_type, actor_email, note, meta
  ) values (
    p_payment_id, v_payment.user_id, 'payment_approved', p_admin_email,
    p_admin_note, jsonb_build_object(
      'transactionId', v_transaction,
      'receiptNumber', v_receipt.receipt_number,
      'membershipEndsAt', v_end,
      'billingKind', v_payment.billing_kind,
      'debitDay', v_payment.debit_day,
      'dunningFeeCents', v_payment.dunning_fee_cents
    )
  );
  insert into public.billing_events (
    event_type, user_id, amount_zar_cents, payload
  ) values (
    'manual_payment_approved', v_payment.user_id, v_payment.amount_zar_cents,
    jsonb_build_object(
      'paymentId', p_payment_id,
      'paymentReference', v_payment.payment_reference,
      'receiptNumber', v_receipt.receipt_number,
      'method', v_payment.payment_method,
      'by', p_admin_email,
      'billingKind', v_payment.billing_kind
    )
  );
  insert into public.user_reminders (
    user_id, kind, title, body, href, severity, dedupe_key, created_by, meta
  ) values (
    v_payment.user_id, 'admin',
    case when v_payment.billing_kind = 'outstanding'
      then 'Outstanding paid — access restored'
      else 'Membership activated'
    end,
    case
      when v_payment.billing_kind = 'outstanding' then
        'Thanks — your outstanding debit (incl. 3% fee) is paid. Access continues until ' ||
        to_char(v_end at time zone 'Africa/Johannesburg', 'DD Mon YYYY') ||
        '. Monthly debit stays on your chosen day.'
      when v_payment.billing_kind = 'debit_order' then
        'Your GLS TV debit order is active until ' ||
        to_char(v_end at time zone 'Africa/Johannesburg', 'DD Mon YYYY') ||
        '. Monthly card debit continues on your chosen day.'
      else
        'Your 30-day GLS TV membership is active until ' ||
        to_char(v_end at time zone 'Africa/Johannesburg', 'DD Mon YYYY') ||
        '. Check the notification bell for details.'
    end,
    '/receipts/' || v_receipt.id::text, 'info',
    'payment-approved-' || p_payment_id::text, p_admin_email,
    jsonb_build_object('paymentId', p_payment_id, 'receiptId', v_receipt.id)
  );

  -- Ledger: revenue (+ fee split for outstanding) and clear uncollected AR
  if v_payment.billing_kind = 'outstanding' then
    v_fee := greatest(coalesce(v_payment.dunning_fee_cents, 0), 0);
    v_revenue := greatest(v_payment.amount_zar_cents - v_fee, 0);
    perform public.post_finance_ledger_entry(
      p_paid_at, v_payment.user_id, p_payment_id, v_receipt.id,
      'uncollected', 'credit', v_payment.amount_zar_cents, 'zar',
      'Outstanding collected', v_payment.pf_payment_id, v_payment.payment_reference,
      v_payment.plan, 'outstanding_paid_clear',
      jsonb_build_object('receiptNumber', v_receipt.receipt_number)
    );
    if v_revenue > 0 then
      perform public.post_finance_ledger_entry(
        p_paid_at, v_payment.user_id, p_payment_id, v_receipt.id,
        'membership_revenue', 'credit', v_revenue, 'zar',
        'Membership revenue (outstanding)', v_payment.pf_payment_id,
        v_payment.payment_reference, v_payment.plan, 'payment_activated',
        jsonb_build_object('receiptNumber', v_receipt.receipt_number, 'billingKind', 'outstanding')
      );
    end if;
    if v_fee > 0 then
      perform public.post_finance_ledger_entry(
        p_paid_at, v_payment.user_id, p_payment_id, v_receipt.id,
        'decline_fee', 'credit', v_fee, 'zar',
        'Decline fee (3%)', v_payment.pf_payment_id, v_payment.payment_reference,
        v_payment.plan, 'decline_fee_collected',
        jsonb_build_object('receiptNumber', v_receipt.receipt_number)
      );
    end if;
  else
    perform public.post_finance_ledger_entry(
      p_paid_at, v_payment.user_id, p_payment_id, v_receipt.id,
      'membership_revenue', 'credit', v_payment.amount_zar_cents, 'zar',
      'Membership revenue', v_payment.pf_payment_id, v_payment.payment_reference,
      v_payment.plan, 'payment_activated',
      jsonb_build_object(
        'receiptNumber', v_receipt.receipt_number,
        'billingKind', coalesce(v_payment.billing_kind, 'once')
      )
    );
  end if;

  return jsonb_build_object(
    'alreadyPaid', false,
    'payment', to_jsonb(v_payment),
    'receipt', to_jsonb(v_receipt)
  );
end;
$$;

revoke all on function public.activate_manual_payment(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.activate_manual_payment(
  uuid, text, text, text, text, timestamptz
) to service_role;

-- renew_payfast_debit + ledger posting
CREATE OR REPLACE FUNCTION public.renew_payfast_debit(
  p_user_id uuid,
  p_pf_payment_id text,
  p_token text,
  p_amount_cents integer,
  p_admin_email text default 'payfast-itn'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_profile public.profiles%rowtype;
  v_settings public.manual_payment_settings%rowtype;
  v_payment public.manual_payment_requests%rowtype;
  v_receipt public.payment_receipts%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_ref text;
  v_next date;
begin
  if nullif(btrim(p_pf_payment_id), '') is null then
    raise exception 'pf_payment_id required';
  end if;
  if exists (
    select 1 from public.manual_payment_requests
    where pf_payment_id = p_pf_payment_id
  ) then
    select * into v_payment from public.manual_payment_requests
    where pf_payment_id = p_pf_payment_id;
    select * into v_receipt from public.payment_receipts
    where payment_request_id = v_payment.id;
    return jsonb_build_object(
      'alreadyProcessed', true,
      'payment', to_jsonb(v_payment),
      'receipt', to_jsonb(v_receipt)
    );
  end if;

  select * into v_sub from public.subscriptions
  where user_id = p_user_id
  for update;
  if not found then raise exception 'Subscription not found'; end if;

  if nullif(btrim(p_token), '') is not null then
    update public.subscriptions set
      payfast_token = coalesce(payfast_token, p_token),
      debit_status = 'active',
      updated_at = now()
    where user_id = p_user_id
    returning * into v_sub;
  end if;

  v_start := greatest(coalesce(v_sub.current_period_end, now()), now());
  v_end := v_start + interval '1 month';
  if v_sub.debit_day is not null then
    v_next := (date_trunc('month', (v_end at time zone 'UTC'))::date
      + (v_sub.debit_day - 1));
    if v_next < (v_end at time zone 'UTC')::date then
      v_next := (v_next + interval '1 month')::date;
    end if;
  else
    v_next := (v_end at time zone 'UTC')::date;
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  select * into v_settings from public.manual_payment_settings where id = 'default';
  v_ref := 'PF-REN-' || upper(substr(replace(p_pf_payment_id, '-', ''), 1, 12));

  insert into public.manual_payment_requests (
    user_id, member_reference, payment_reference, plan, amount_zar_cents,
    currency, status, payment_method, billing_kind, debit_day,
    recurring_amount_cents, next_billing_at, pf_payment_id, payfast_token,
    payfast_status, external_transaction_id, paid_at, submitted_at,
    verified_at, verified_by, membership_starts_at, membership_ends_at,
    expires_at
  ) values (
    p_user_id,
    coalesce(v_profile.member_reference, 'MEMBER'),
    v_ref,
    v_sub.plan,
    greatest(p_amount_cents, 100),
    'zar',
    'paid',
    'payfast',
    'debit_order',
    v_sub.debit_day,
    coalesce(v_sub.amount_zar_cents, p_amount_cents),
    v_next,
    p_pf_payment_id,
    coalesce(nullif(btrim(p_token), ''), v_sub.payfast_token),
    'complete',
    'payfast:' || p_pf_payment_id,
    now(), now(), now(), p_admin_email,
    v_start, v_end,
    now() + interval '1 day'
  ) returning * into v_payment;

  update public.profiles set
    is_premium = true,
    plan = v_sub.plan,
    updated_at = now()
  where id = p_user_id;

  update public.subscriptions set
    status = 'active',
    provider = 'payfast',
    current_period_end = v_end,
    next_billing_at = v_next,
    debit_status = 'active',
    amount_zar_cents = coalesce(amount_zar_cents, p_amount_cents),
    updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  insert into public.payment_receipts (
    payment_request_id, user_id, member_reference, payment_reference, plan,
    amount_zar_cents, payment_method, external_transaction_id, customer_name,
    customer_email, trading_name, membership_starts_at, membership_ends_at,
    paid_at, issued_by, receipt_footer
  ) values (
    v_payment.id, p_user_id, v_payment.member_reference, v_ref, v_sub.plan,
    v_payment.amount_zar_cents, 'payfast', 'payfast:' || p_pf_payment_id,
    v_profile.display_name, v_profile.email,
    coalesce(v_settings.trading_name, 'GLS TV'),
    v_start, v_end, now(), p_admin_email, v_settings.receipt_footer
  ) returning * into v_receipt;

  insert into public.user_reminders (
    user_id, kind, title, body, href, severity, dedupe_key, created_by, meta
  ) values (
    p_user_id, 'admin', 'Debit order renewed',
    'Your monthly GLS TV debit succeeded. Access continues until ' ||
      to_char(v_end at time zone 'Africa/Johannesburg', 'DD Mon YYYY') || '.',
    '/receipts/' || v_receipt.id::text, 'info',
    'payfast-renew-' || p_pf_payment_id, p_admin_email,
    jsonb_build_object('paymentId', v_payment.id, 'receiptId', v_receipt.id)
  );

  perform public.post_finance_ledger_entry(
    now(), p_user_id, v_payment.id, v_receipt.id,
    'membership_revenue', 'credit', v_payment.amount_zar_cents, 'zar',
    'Debit order renewal', p_pf_payment_id, v_ref, v_sub.plan,
    'debit_renewed',
    jsonb_build_object('receiptNumber', v_receipt.receipt_number)
  );

  return jsonb_build_object(
    'alreadyProcessed', false,
    'payment', to_jsonb(v_payment),
    'receipt', to_jsonb(v_receipt),
    'subscription', to_jsonb(v_sub)
  );
end;
$$;

revoke all on function public.renew_payfast_debit(uuid, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.renew_payfast_debit(uuid, text, text, integer, text)
  to service_role;

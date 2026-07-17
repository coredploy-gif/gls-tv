-- Debit decline dunning: outstanding + 3% fee, day-3 remind, day-5 pause

ALTER TABLE public.manual_payment_requests
  ADD COLUMN IF NOT EXISTS dunning_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_remind3_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_pause_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_parent_pf_payment_id text,
  ADD COLUMN IF NOT EXISTS dunning_fee_cents integer,
  ADD COLUMN IF NOT EXISTS dunning_paused_at timestamptz;

ALTER TABLE public.manual_payment_requests
  DROP CONSTRAINT IF EXISTS manual_payment_requests_billing_kind_check;

ALTER TABLE public.manual_payment_requests
  ADD CONSTRAINT manual_payment_requests_billing_kind_check
  CHECK (
    billing_kind = ANY (
      ARRAY['once'::text, 'debit_order'::text, 'outstanding'::text]
    )
  );

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dunning_paused_at timestamptz;

CREATE INDEX IF NOT EXISTS manual_payment_requests_dunning_open_idx
  ON public.manual_payment_requests (status, billing_kind, dunning_remind3_at, dunning_pause_at)
  WHERE billing_kind = 'outstanding' AND status IN ('pending', 'verifying', 'proof_submitted');

CREATE UNIQUE INDEX IF NOT EXISTS manual_payment_requests_dunning_parent_pf_uidx
  ON public.manual_payment_requests (dunning_parent_pf_payment_id)
  WHERE dunning_parent_pf_payment_id IS NOT NULL
    AND billing_kind = 'outstanding'
    AND status NOT IN ('canceled', 'expired', 'refunded');

-- When outstanding is activated: clear past_due, restore premium, extend period
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

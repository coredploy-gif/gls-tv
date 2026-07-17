-- PayFast card checkout: settings toggle, payment request fields, activate RPC

ALTER TABLE public.manual_payment_settings
  ADD COLUMN IF NOT EXISTS payfast_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.manual_payment_requests
  ADD COLUMN IF NOT EXISTS pf_payment_id text,
  ADD COLUMN IF NOT EXISTS payfast_token text,
  ADD COLUMN IF NOT EXISTS payfast_status text;

CREATE UNIQUE INDEX IF NOT EXISTS manual_payment_pf_payment_id_uidx
  ON public.manual_payment_requests (pf_payment_id)
  WHERE pf_payment_id IS NOT NULL;

ALTER TABLE public.manual_payment_requests
  DROP CONSTRAINT IF EXISTS manual_payment_requests_payment_method_check;

ALTER TABLE public.manual_payment_requests
  ADD CONSTRAINT manual_payment_requests_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'unselected'::text,
    'yoco'::text,
    'payfast'::text,
    'eft'::text,
    'cash'::text,
    'other'::text
  ]));

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
  v_end := v_start + interval '30 days';
  v_max_profiles := case v_payment.plan
    when 'gls_55' then 3 when 'gls_65' then 4 else 5 end;
  select * into v_profile from public.profiles where id = v_payment.user_id;
  select * into v_settings from public.manual_payment_settings where id = 'default';
  v_provider := case v_payment.payment_method
    when 'yoco' then 'yoco'
    when 'payfast' then 'payfast'
    else 'manual'
  end;

  update public.profiles set
    plan = v_payment.plan,
    is_premium = true,
    is_admin_exception = false,
    max_viewer_profiles = v_max_profiles,
    updated_at = now()
  where id = v_payment.user_id;
  insert into public.subscriptions (
    user_id, plan, status, provider, external_id, current_period_end,
    amount_zar_cents, currency, updated_at
  ) values (
    v_payment.user_id, v_payment.plan, 'active',
    v_provider,
    coalesce(v_transaction, v_payment.payment_reference), v_end,
    v_payment.amount_zar_cents, 'zar', now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    provider = excluded.provider,
    external_id = excluded.external_id,
    current_period_end = excluded.current_period_end,
    amount_zar_cents = excluded.amount_zar_cents,
    currency = excluded.currency,
    updated_at = excluded.updated_at;
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
      'membershipEndsAt', v_end
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
      'by', p_admin_email
    )
  );
  insert into public.user_reminders (
    user_id, kind, title, body, href, severity, dedupe_key, created_by, meta
  ) values (
    v_payment.user_id, 'admin', 'Membership activated',
    'Your 30-day GLS TV membership is active until ' ||
      to_char(v_end at time zone 'Africa/Johannesburg', 'DD Mon YYYY') ||
      '. Check the notification bell for details.',
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

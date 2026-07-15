-- Launch security hardening. Applied to production as migration
-- 20260715172618_launch_security_hardening.
revoke insert, update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke execute on function public.rollup_channel_health(text) from public, anon, authenticated;
revoke execute on function public.upsert_channel_seed(jsonb) from public, anon, authenticated;
grant execute on function public.rollup_channel_health(text) to service_role;
grant execute on function public.upsert_channel_seed(jsonb) to service_role;
alter function public.next_gls_ticket_number() set search_path = '';
alter function public.helpdesk_set_ticket_number() set search_path = '';
revoke execute on function public.next_gls_ticket_number() from public, anon, authenticated;
revoke execute on function public.helpdesk_set_ticket_number() from public, anon, authenticated;
revoke all on table public.admin_audit_log, public.billing_events, public.helpdesk_tickets,
  public.helpdesk_messages, public.manual_payment_settings, public.ops_cron_runs,
  public.trial_device_claims from anon, authenticated;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists playlists_own_all on public.user_playlists;
create policy playlists_own_all on public.user_playlists for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists playlist_channels_own_all on public.user_playlist_channels;
create policy playlist_channels_own_all on public.user_playlist_channels for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viewer_profiles_select_own on public.viewer_profiles;
create policy viewer_profiles_select_own on public.viewer_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists viewer_profiles_insert_own on public.viewer_profiles;
create policy viewer_profiles_insert_own on public.viewer_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists viewer_profiles_update_own on public.viewer_profiles;
create policy viewer_profiles_update_own on public.viewer_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viewer_profiles_delete_own on public.viewer_profiles;
create policy viewer_profiles_delete_own on public.viewer_profiles for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_reminders_select_own on public.user_reminders;
create policy user_reminders_select_own on public.user_reminders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_reminders_update_own on public.user_reminders;
create policy user_reminders_update_own on public.user_reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists manual_payment_requests_select_own on public.manual_payment_requests;
create policy manual_payment_requests_select_own on public.manual_payment_requests for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists payment_receipts_select_own on public.payment_receipts;
create policy payment_receipts_select_own on public.payment_receipts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists manual_payment_events_select_own on public.manual_payment_events;
create policy manual_payment_events_select_own on public.manual_payment_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists channels_public_read_online on public.channels;
drop policy if exists kb_public_read on public.kb_articles;
drop policy if exists admin_links_public_read on public.admin_system_links;

create index if not exists billing_events_user_id_idx on public.billing_events (user_id);
create index if not exists helpdesk_tickets_requester_user_id_idx on public.helpdesk_tickets (requester_user_id);
create index if not exists manual_payment_events_user_id_idx on public.manual_payment_events (user_id);
create index if not exists stream_seeds_updated_by_idx on public.stream_seeds (updated_by);
create index if not exists trial_device_claims_user_id_idx on public.trial_device_claims (user_id);

create or replace function public.activate_manual_payment(
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
  if p_payment_method not in ('yoco', 'eft', 'cash', 'other') then
    raise exception 'Invalid payment method';
  end if;
  v_payment.payment_method := p_payment_method;
  v_transaction := nullif(btrim(coalesce(
    p_external_transaction_id, v_payment.external_transaction_id
  )), '');
  if v_payment.payment_method in ('eft', 'yoco') and v_transaction is null then
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
    case when v_payment.payment_method = 'yoco' then 'yoco' else 'manual' end,
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
      to_char(v_end at time zone 'Africa/Johannesburg', 'DD Mon YYYY') || '.',
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

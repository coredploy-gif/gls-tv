-- Cover every foreign key introduced by p1_operational_foundation.
create index if not exists admin_roles_granted_by_idx on public.admin_roles (granted_by);
create index if not exists feature_flags_updated_by_idx on public.feature_flags (updated_by);
create index if not exists notification_delivery_user_idx on public.notification_delivery_jobs (user_id);
create index if not exists helpdesk_status_history_actor_idx on public.helpdesk_status_history (actor_user_id);
create index if not exists content_rights_approved_by_idx on public.content_rights (approved_by);
create index if not exists content_rights_history_rights_idx on public.content_rights_history (rights_id);
create index if not exists content_rights_history_actor_idx on public.content_rights_history (actor_user_id);
create index if not exists retention_policies_updated_by_idx on public.retention_policies (updated_by);
create index if not exists legal_holds_created_by_idx on public.legal_holds (created_by);
create index if not exists retention_runs_initiated_by_idx on public.retention_runs (initiated_by);
create index if not exists reconciliation_runs_created_by_idx on public.reconciliation_runs (created_by);
create index if not exists reconciliation_rows_payment_idx on public.reconciliation_rows (payment_request_id);

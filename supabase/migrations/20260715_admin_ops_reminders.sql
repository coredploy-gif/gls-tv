-- Admin daily ops: audit trail, in-app reminders, cron run journal

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx
  ON public.admin_audit_log (entity_type, entity_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN (
      'trial_ending',
      'trial_ended',
      'past_due',
      'renewal',
      'payment_failed',
      'ticket_reply',
      'admin',
      'system'
    )),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  href text,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warn', 'urgent')),
  dedupe_key text,
  due_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_by text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_reminders_dedupe_uidx
  ON public.user_reminders (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS user_reminders_user_due_idx
  ON public.user_reminders (user_id, due_at DESC)
  WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS user_reminders_kind_idx
  ON public.user_reminders (kind, created_at DESC);

ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

-- Members can read/update their own reminders (dismiss/read)
DROP POLICY IF EXISTS user_reminders_select_own ON public.user_reminders;
CREATE POLICY user_reminders_select_own ON public.user_reminders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_reminders_update_own ON public.user_reminders;
CREATE POLICY user_reminders_update_own ON public.user_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ops_cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  status text NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'partial', 'error')),
  summary text,
  meta jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS ops_cron_runs_job_idx
  ON public.ops_cron_runs (job, started_at DESC);

ALTER TABLE public.ops_cron_runs ENABLE ROW LEVEL SECURITY;

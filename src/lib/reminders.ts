export type ReminderKind =
  | "trial_ending"
  | "trial_ended"
  | "past_due"
  | "renewal"
  | "payment_failed"
  | "ticket_reply"
  | "admin"
  | "system";

export type ReminderSeverity = "info" | "warn" | "urgent";

export type UserReminder = {
  id: string;
  user_id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  href: string | null;
  severity: ReminderSeverity;
  dedupe_key: string | null;
  due_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type ReminderInsert = {
  user_id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  href?: string | null;
  severity?: ReminderSeverity;
  dedupe_key?: string | null;
  due_at?: string;
  created_by?: string | null;
  meta?: Record<string, unknown>;
};

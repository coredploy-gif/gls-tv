import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditWrite = {
  actorEmail?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  meta?: Record<string, unknown>;
};

/** Best-effort admin audit write (never throws to callers). */
export async function writeAuditLog(
  service: SupabaseClient,
  entry: AuditWrite,
) {
  try {
    await service.from("admin_audit_log").insert({
      actor_email: entry.actorEmail || null,
      actor_user_id: entry.actorUserId || null,
      action: entry.action,
      entity_type: entry.entityType || null,
      entity_id: entry.entityId || null,
      summary: entry.summary || null,
      meta: entry.meta || {},
    });
  } catch {
    /* ignore */
  }
}

export async function recordCronRun(
  service: SupabaseClient,
  job: string,
  status: "ok" | "partial" | "error",
  summary: string,
  meta?: Record<string, unknown>,
  startedAt?: string,
) {
  try {
    await service.from("ops_cron_runs").insert({
      job,
      status,
      summary,
      meta: meta || {},
      started_at: startedAt || new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
}

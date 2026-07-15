import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess, hasAdminPermission, requireAal2 } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) return null;
  return access;
}

async function runDeletion(service: NonNullable<ReturnType<typeof createServiceClient>>, request: { id: string; user_id: string }) {
  const userId = request.user_id;
  const pseudonym = `deleted-${userId.slice(0, 8)}`;
  await service.from("account_deletion_requests").update({ status: "processing" }).eq("id", request.id).eq("status", "cooling_off");

  const { data: hold } = await service
    .from("legal_holds")
    .select("id")
    .eq("entity_type", "user")
    .eq("entity_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (hold) throw new Error("LEGAL_HOLD");

  await Promise.all([
    service.from("user_playlists").delete().eq("user_id", userId),
    service.from("viewer_profiles").delete().eq("user_id", userId),
    service.from("user_reminders").delete().eq("user_id", userId),
    service.from("notification_states").delete().eq("user_id", userId),
    service.from("notification_preferences").delete().eq("user_id", userId),
    service.from("trial_device_claims").delete().eq("user_id", userId),
    service.from("helpdesk_tickets").delete().eq("requester_user_id", userId),
  ]);

  await Promise.all([
    service.from("payment_receipts").update({
      customer_name: pseudonym,
      customer_email: null,
      meta: { account_anonymized: true },
    }).eq("user_id", userId),
    service.from("manual_payment_events").update({
      actor_email: null,
      note: null,
    }).eq("user_id", userId),
    service.from("profiles").update({
      display_name: pseudonym,
      email: null,
      avatar_url: null,
      account_status: "anonymized",
      suspended_reason: null,
    }).eq("id", userId),
  ]);

  const { error: deleteError } = await service.auth.admin.deleteUser(userId, true);
  if (deleteError) throw new Error("AUTH_DELETE_FAILED");
  await service.from("account_deletion_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", request.id);
}

export async function POST(req: NextRequest) {
  const access = await guard();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Maintenance service unavailable" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "retention");

  if (action === "account_deletions") {
    if (!access.roles.includes("owner") || !requireAal2(access)) {
      return NextResponse.json({
        error: "Owner role and MFA assurance level 2 are required. Enroll and verify MFA, then retry.",
      }, { status: 403 });
    }
    const { data: requests } = await service
      .from("account_deletion_requests")
      .select("id, user_id")
      .eq("status", "cooling_off")
      .lte("execute_after", new Date().toISOString())
      .limit(20);
    let completed = 0;
    const failures: string[] = [];
    for (const request of requests || []) {
      try {
        await runDeletion(service, request);
        completed += 1;
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN";
        failures.push(request.id);
        await service.from("account_deletion_requests").update({
          status: "failed",
          failure_code: code,
        }).eq("id", request.id);
      }
    }
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "maintenance.account_deletions",
      entityType: "maintenance_run",
      summary: `Completed ${completed} account deletions; ${failures.length} failed`,
      meta: { completed, failed: failures.length },
    });
    return NextResponse.json({ ok: true, completed, failed: failures.length });
  }

  const dryRun = body.dryRun !== false;
  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `retention-${day}-${dryRun ? "dry" : "apply"}`;
  const { data: existing } = await service
    .from("retention_runs")
    .select("id, status, counts")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.status === "completed") return NextResponse.json({ ok: true, reused: true, run: existing });

  const { data: policies } = await service.from("retention_policies").select("data_class, retention_days").eq("enabled", true);
  const days = Object.fromEntries((policies || []).map((row) => [row.data_class, row.retention_days])) as Record<string, number>;
  const cutoff = (value: number) => new Date(Date.now() - value * 86_400_000).toISOString();
  const [reminders, devices, support, ops] = await Promise.all([
    service.from("user_reminders").select("id", { count: "exact", head: true }).not("dismissed_at", "is", null).lt("dismissed_at", cutoff(days.dismissed_reminders || 90)),
    service.from("trial_device_claims").select("id", { count: "exact", head: true }).lt("blocked_until", cutoff(days.device_ip_hashes || 30)),
    service.from("helpdesk_tickets").select("id", { count: "exact", head: true }).in("status", ["resolved", "closed"]).lt("updated_at", cutoff(days.support_content || 730)),
    service.from("ops_cron_runs").select("id", { count: "exact", head: true }).lt("started_at", cutoff(days.operational_logs || 90)),
  ]);
  const counts = {
    dismissedReminders: reminders.count || 0,
    expiredDeviceHashes: devices.count || 0,
    closedSupportTickets: support.count || 0,
    operationalRuns: ops.count || 0,
  };
  const { data: run } = await service.from("retention_runs").upsert({
    idempotency_key: idempotencyKey,
    dry_run: dryRun,
    status: "running",
    counts,
    initiated_by: access.user.id,
  }, { onConflict: "idempotency_key" }).select("id").single();

  if (!dryRun) {
    await Promise.all([
      service.from("user_reminders").delete().not("dismissed_at", "is", null).lt("dismissed_at", cutoff(days.dismissed_reminders || 90)),
      service.from("trial_device_claims").delete().lt("blocked_until", cutoff(days.device_ip_hashes || 30)),
      service.from("ops_cron_runs").delete().lt("started_at", cutoff(days.operational_logs || 90)),
    ]);
  }
  await service.from("retention_runs").update({
    status: "completed",
    finished_at: new Date().toISOString(),
  }).eq("id", run!.id);
  await writeAuditLog(service, {
    actorEmail: access.user.email,
    actorUserId: access.user.id,
    action: "maintenance.retention",
    entityType: "retention_run",
    entityId: run!.id,
    summary: `${dryRun ? "Dry-run" : "Applied"} retention cleanup`,
    meta: counts,
  });
  return NextResponse.json({ ok: true, dryRun, counts });
}

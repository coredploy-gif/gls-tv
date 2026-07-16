import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { isBillablePlan } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) return null;
  return access.user;
}

/** Daily ops pack — tickets, collections, trials, streams, cron, reminders. */
export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  if (!service) {
    const { serviceRoleStatus } = await import("@/lib/eadmin");
    const st = serviceRoleStatus();
    return NextResponse.json(
      { error: st.hint || "No service role" },
      { status: 500 },
    );
  }

  const now = Date.now();
  const in3d = new Date(now + 3 * 86_400_000).toISOString();
  const in7d = new Date(now + 7 * 86_400_000).toISOString();
  const nowIso = new Date(now).toISOString();

  const [
    openTickets,
    urgentTickets,
    waitingTickets,
    pastDueSubs,
    renewals,
    trialsEnding,
    deadChannels,
    degradedChannels,
    unreadReminders,
    cronRuns,
    recentAudit,
    billingEvents,
    manualQueue,
  ] = await Promise.all([
    service
      .from("helpdesk_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    service
      .from("helpdesk_tickets")
      .select("id, ticket_number, subject, priority, status, updated_at")
      .in("status", ["open", "in_progress", "waiting"])
      .eq("priority", "urgent")
      .order("updated_at", { ascending: false })
      .limit(8),
    service
      .from("helpdesk_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting"),
    service
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end, external_id, amount_zar_cents")
      .eq("status", "past_due")
      .limit(50),
    service
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end, amount_zar_cents")
      .in("status", ["active", "trialing"])
      .gte("current_period_end", nowIso)
      .lte("current_period_end", in7d)
      .order("current_period_end", { ascending: true })
      .limit(40),
    service
      .from("profiles")
      .select("id, email, display_name, plan, trial_ends_at, is_premium")
      .eq("plan", "trial")
      .eq("is_premium", false)
      .gte("trial_ends_at", nowIso)
      .lte("trial_ends_at", in3d)
      .order("trial_ends_at", { ascending: true })
      .limit(40),
    service
      .from("channels")
      .select("id", { count: "exact", head: true })
      .eq("health_status", "dead"),
    service
      .from("channels")
      .select("id, slug, title, health_status, last_checked_at")
      .in("health_status", ["dead", "degraded"])
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .limit(12),
    service
      .from("user_reminders")
      .select("id", { count: "exact", head: true })
      .is("dismissed_at", null)
      .is("read_at", null),
    service
      .from("ops_cron_runs")
      .select("id, job, status, summary, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(12),
    service
      .from("admin_audit_log")
      .select("id, actor_email, action, summary, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("billing_events")
      .select("id, event_type, amount_zar_cents, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("manual_payment_requests")
      .select(
        "id, user_id, payment_reference, member_reference, plan, amount_zar_cents, status, payment_method, updated_at",
      )
      .in("status", ["proof_submitted", "verifying"])
      .order("updated_at", { ascending: true })
      .limit(50),
  ]);

  const pastDue = pastDueSubs.data || [];
  const renewalRows = renewals.data || [];
  const trialRows = trialsEnding.data || [];

  const userIds = [
    ...new Set([
      ...pastDue.map((r) => r.user_id),
      ...renewalRows.map((r) => r.user_id),
    ]),
  ];
  const { data: emails } = userIds.length
    ? await service.from("profiles").select("id, email, display_name").in("id", userIds)
    : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };
  const emailMap = new Map((emails || []).map((p) => [p.id, p]));

  const checklist = [
    {
      id: "tickets",
      label: "Clear open helpdesk",
      count: openTickets.count || 0,
      href: "/admin/helpdesk",
      severity: (openTickets.count || 0) > 5 ? "urgent" : "info",
    },
    {
      id: "waiting",
      label: "Customer waiting replies",
      count: waitingTickets.count || 0,
      href: "/admin/helpdesk?status=waiting",
      severity: (waitingTickets.count || 0) > 0 ? "warn" : "info",
    },
    {
      id: "payments",
      label: "Verify submitted payments",
      count: manualQueue.data?.length || 0,
      href: "/admin/finance/payments?status=proof_submitted",
      severity: (manualQueue.data?.length || 0) > 0 ? "urgent" : "info",
    },
    {
      id: "past_due",
      label: "Past-due collections",
      count: pastDue.length,
      href: "/admin/finance/collections",
      severity: pastDue.length > 0 ? "urgent" : "info",
    },
    {
      id: "trials",
      label: "Trials ending ≤3 days",
      count: trialRows.length,
      href: "/admin/finance/reminders",
      severity: trialRows.length > 0 ? "warn" : "info",
    },
    {
      id: "renewals",
      label: "Renewals ≤7 days",
      count: renewalRows.length,
      href: "/admin/finance/collections",
      severity: "info",
    },
    {
      id: "streams",
      label: "Dead / degraded channels",
      count: (deadChannels.count || 0) + (degradedChannels.data?.length || 0),
      href: "/admin/links",
      severity: (deadChannels.count || 0) > 0 ? "urgent" : "info",
    },
  ];

  // Paid MRR flash from profiles
  const { data: paidProfiles } = await service
    .from("profiles")
    .select("plan, is_premium, is_admin_exception")
    .eq("is_premium", true)
    .limit(2000);
  let mrrZar = 0;
  let paid = 0;
  for (const p of paidProfiles || []) {
    if (p.is_admin_exception) continue;
    if (!isBillablePlan(String(p.plan))) continue;
    paid += 1;
    const cents =
      p.plan === "gls_65" ? 5500 : p.plan === "gls_75" ? 6500 : 4500;
    mrrZar += cents / 100;
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    checklist,
    stats: {
      openTickets: openTickets.count || 0,
      waitingTickets: waitingTickets.count || 0,
      pastDue: pastDue.length,
      renewals7d: renewalRows.length,
      trialsEnding3d: trialRows.length,
      deadChannels: deadChannels.count || 0,
      unreadReminders: unreadReminders.count || 0,
      paymentsToVerify: manualQueue.data?.length || 0,
      paid,
      mrrZar,
    },
    urgentTickets: urgentTickets.data || [],
    collections: pastDue.map((s) => ({
      ...s,
      email: emailMap.get(s.user_id)?.email || null,
      display_name: emailMap.get(s.user_id)?.display_name || null,
    })),
    renewals: renewalRows.map((s) => ({
      ...s,
      email: emailMap.get(s.user_id)?.email || null,
      display_name: emailMap.get(s.user_id)?.display_name || null,
    })),
    trialsEnding: trialRows,
    channelHealth: degradedChannels.data || [],
    cronRuns: cronRuns.data || [],
    recentAudit: recentAudit.data || [],
    recentBilling: billingEvents.data || [],
    manualQueue: manualQueue.data || [],
  });
}

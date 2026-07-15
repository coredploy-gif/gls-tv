import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import type { ReminderInsert, ReminderKind, ReminderSeverity } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) return null;
  return access.user;
}

async function upsertReminder(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  row: ReminderInsert,
) {
  if (row.dedupe_key) {
    const { data: existing } = await service
      .from("user_reminders")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("dedupe_key", row.dedupe_key)
      .is("dismissed_at", null)
      .maybeSingle();
    if (existing?.id) {
      const { data, error } = await service
        .from("user_reminders")
        .update({
          title: row.title,
          body: row.body,
          href: row.href ?? null,
          severity: row.severity || "info",
          due_at: row.due_at || new Date().toISOString(),
          created_by: row.created_by || null,
          meta: row.meta || {},
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }
  const { data, error } = await service
    .from("user_reminders")
    .insert({
      user_id: row.user_id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href ?? null,
      severity: row.severity || "info",
      dedupe_key: row.dedupe_key || null,
      due_at: row.due_at || new Date().toISOString(),
      created_by: row.created_by || null,
      meta: row.meta || {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const kind = req.nextUrl.searchParams.get("kind");
  const activeOnly = req.nextUrl.searchParams.get("active") !== "0";
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

  let query = service
    .from("user_reminders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);

  if (kind && kind !== "all") query = query.eq("kind", kind);
  if (activeOnly) query = query.is("dismissed_at", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id, email, display_name").in("id", userIds)
    : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };
  const pmap = new Map((profiles || []).map((p) => [p.id, p]));

  let enriched = rows.map((r) => ({
    ...r,
    email: pmap.get(r.user_id)?.email || null,
    display_name: pmap.get(r.user_id)?.display_name || null,
  }));

  if (q) {
    enriched = enriched.filter(
      (r) =>
        (r.email || "").toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.kind || "").toLowerCase().includes(q),
    );
  }

  // Queue targets for bulk nudge
  const now = Date.now();
  const in3d = new Date(now + 3 * 86_400_000).toISOString();
  const nowIso = new Date(now).toISOString();

  const [{ data: trials }, { data: pastDue }] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, trial_ends_at, plan")
      .eq("plan", "trial")
      .gte("trial_ends_at", nowIso)
      .lte("trial_ends_at", in3d)
      .limit(80),
    service
      .from("subscriptions")
      .select("user_id, plan, status")
      .eq("status", "past_due")
      .limit(80),
  ]);

  return NextResponse.json({
    reminders: enriched,
    queues: {
      trialsEnding: trials || [],
      pastDue: pastDue || [],
    },
  });
}

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "send");

  if (action === "send") {
    const userId = String(body.userId || "");
    const email = String(body.email || "").trim().toLowerCase();
    let targetId = userId;

    if (!targetId && email) {
      const { data: listed } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const hit = listed?.users?.find(
        (u) => (u.email || "").toLowerCase() === email,
      );
      if (!hit)
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      targetId = hit.id;
    }
    if (!targetId)
      return NextResponse.json(
        { error: "userId or email required" },
        { status: 400 },
      );

    const kind = (String(body.kind || "admin") as ReminderKind) || "admin";
    const title = String(body.title || "GLS TV reminder").slice(0, 160);
    const reminderBody = String(body.body || "").slice(0, 2000);
    const href = body.href != null ? String(body.href).slice(0, 300) : "/pricing";
    const severity =
      (String(body.severity || "info") as ReminderSeverity) || "info";

    const row = await upsertReminder(service, {
      user_id: targetId,
      kind,
      title,
      body: reminderBody,
      href,
      severity,
      dedupe_key:
        body.dedupeKey != null
          ? String(body.dedupeKey)
          : `admin-${kind}-${Date.now()}`,
      created_by: admin.email || "admin",
      meta: { manual: true },
    });

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "reminder_send",
      entityType: "user_reminder",
      entityId: row.id,
      summary: `${title} → ${email || targetId}`,
      meta: { kind, userId: targetId },
    });

    return NextResponse.json({ ok: true, reminder: row });
  }

  if (action === "nudge_queue") {
    const queue = String(body.queue || "");
    let sent = 0;

    if (queue === "trials") {
      const now = Date.now();
      const in3d = new Date(now + 3 * 86_400_000).toISOString();
      const { data: trials } = await service
        .from("profiles")
        .select("id, email, trial_ends_at")
        .eq("plan", "trial")
        .gte("trial_ends_at", new Date(now).toISOString())
        .lte("trial_ends_at", in3d)
        .limit(100);

      for (const t of trials || []) {
        const days = Math.max(
          0,
          Math.ceil(
            (new Date(t.trial_ends_at).getTime() - now) / 86_400_000,
          ),
        );
        await upsertReminder(service, {
          user_id: t.id,
          kind: "trial_ending",
          title:
            days <= 1
              ? "Trial ends tomorrow"
              : `${days} days left on your trial`,
          body: "Pick a plan on Pricing to keep watching after your free trial.",
          href: "/pricing",
          severity: days <= 1 ? "urgent" : "warn",
          dedupe_key: `trial-ending-${(t.trial_ends_at || "").slice(0, 10)}`,
          created_by: admin.email || "admin",
        });
        sent += 1;
      }
    } else if (queue === "past_due") {
      const { data: subs } = await service
        .from("subscriptions")
        .select("user_id, plan")
        .eq("status", "past_due")
        .limit(100);
      for (const s of subs || []) {
        await upsertReminder(service, {
          user_id: s.user_id,
          kind: "past_due",
          title: "Payment needs attention",
          body: "Your GLS TV membership has ended. Renew for 30 days with Yoco or verified EFT to restore access.",
          href: "/pricing",
          severity: "urgent",
          dedupe_key: `past-due-${new Date().toISOString().slice(0, 10)}`,
          created_by: admin.email || "admin",
          meta: { plan: s.plan },
        });
        sent += 1;
      }
    } else {
      return NextResponse.json({ error: "Unknown queue" }, { status: 400 });
    }

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "reminder_nudge_queue",
      entityType: "queue",
      entityId: queue,
      summary: `Nudged ${sent} members (${queue})`,
      meta: { sent, queue },
    });

    return NextResponse.json({ ok: true, sent });
  }

  if (action === "dismiss") {
    const id = String(body.id || "");
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    await service
      .from("user_reminders")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

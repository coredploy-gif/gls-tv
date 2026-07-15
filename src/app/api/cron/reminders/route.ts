import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { recordCronRun } from "@/lib/admin/audit";
import type { ReminderInsert } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
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
      await service
        .from("user_reminders")
        .update({
          title: row.title,
          body: row.body,
          href: row.href ?? null,
          severity: row.severity || "info",
          due_at: row.due_at || new Date().toISOString(),
        })
        .eq("id", existing.id);
      return;
    }
  }
  await service.from("user_reminders").insert({
    user_id: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href ?? null,
    severity: row.severity || "info",
    dedupe_key: row.dedupe_key || null,
    due_at: row.due_at || new Date().toISOString(),
    created_by: row.created_by || "cron",
    meta: row.meta || {},
  });
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = new Date().toISOString();
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 500 });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const in3d = new Date(now + 3 * 86_400_000).toISOString();
  const in7d = new Date(now + 7 * 86_400_000).toISOString();
  let trial = 0;
  let pastDue = 0;
  let renewal = 0;
  let ended = 0;

  const { data: trials } = await service
    .from("profiles")
    .select("id, trial_ends_at, plan, is_premium")
    .eq("plan", "trial")
    .eq("is_premium", false)
    .not("trial_ends_at", "is", null)
    .limit(500);

  for (const t of trials || []) {
    if (!t.trial_ends_at) continue;
    const ends = new Date(t.trial_ends_at).getTime();
    const days = Math.ceil((ends - now) / 86_400_000);
    if (days < 0) {
      await upsertReminder(service, {
        user_id: t.id,
        kind: "trial_ended",
        title: "Trial ended",
        body: "Choose a plan to unlock profiles and continue watching.",
        href: "/pricing",
        severity: "urgent",
        dedupe_key: `trial-ended-${t.trial_ends_at.slice(0, 10)}`,
        created_by: "cron",
      });
      ended += 1;
    } else if (days <= 3) {
      await upsertReminder(service, {
        user_id: t.id,
        kind: "trial_ending",
        title:
          days <= 1
            ? "Trial ends tomorrow"
            : `${days} days left on your trial`,
        body: "Add a card on Plans to keep watching after your free trial.",
        href: "/pricing",
        severity: days <= 1 ? "urgent" : "warn",
        dedupe_key: `trial-ending-${t.trial_ends_at.slice(0, 10)}`,
        created_by: "cron",
      });
      trial += 1;
    }
  }

  const { data: pastDueSubs } = await service
    .from("subscriptions")
    .select("user_id, plan")
    .eq("status", "past_due")
    .limit(300);

  for (const s of pastDueSubs || []) {
    await upsertReminder(service, {
      user_id: s.user_id,
      kind: "past_due",
      title: "Payment needs attention",
      body: "Your subscription is past due. Update billing to keep premium access.",
      href: "/pricing",
      severity: "urgent",
      dedupe_key: `past-due-${nowIso.slice(0, 10)}`,
      created_by: "cron",
      meta: { plan: s.plan },
    });
    pastDue += 1;
  }

  const { data: renewing } = await service
    .from("subscriptions")
    .select("user_id, plan, current_period_end")
    .in("status", ["active", "trialing"])
    .gte("current_period_end", nowIso)
    .lte("current_period_end", in7d)
    .limit(300);

  for (const s of renewing || []) {
    const end = s.current_period_end
      ? new Date(s.current_period_end).toISOString().slice(0, 10)
      : nowIso.slice(0, 10);
    await upsertReminder(service, {
      user_id: s.user_id,
      kind: "renewal",
      title: "Renewal coming up",
      body: `Your ${s.plan} plan renews soon. Manage billing anytime from Pricing.`,
      href: "/pricing",
      severity: "info",
      dedupe_key: `renewal-${end}`,
      created_by: "cron",
    });
    renewal += 1;
  }

  const summary = `trial=${trial} ended=${ended} past_due=${pastDue} renewal=${renewal}`;
  await recordCronRun(service, "reminders", "ok", summary, {
    trial,
    ended,
    pastDue,
    renewal,
  }, started);

  return NextResponse.json({
    ok: true,
    trial,
    ended,
    pastDue,
    renewal,
    scannedTrials: (trials || []).length,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

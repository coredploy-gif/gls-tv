import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { recordCronRun } from "@/lib/admin/audit";
import {
  activateManualPayment,
  listYocoPaymentLinks,
  yocoConfigured,
} from "@/lib/manual-billing";
import { fetchReconcileSummary } from "@/lib/finance/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    req.nextUrl.searchParams.get("secret") === secret
  );
}

async function run(req: NextRequest) {
  if (!authorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 503 });

  const startedAt = new Date().toISOString();
  const now = new Date().toISOString();
  const { data: expiredRequests } = await service
    .from("manual_payment_requests")
    .update({ status: "expired", updated_at: now })
    .in("status", ["pending", "proof_submitted"])
    .lt("expires_at", now)
    .select("id");

  const { data: expiredSubs } = await service
    .from("subscriptions")
    .select("user_id, current_period_end, provider, plan")
    .in("provider", ["manual", "yoco", "payfast"])
    .eq("status", "active")
    .lt("current_period_end", now)
    .limit(500);

  let yocoActivated = 0;
  if (yocoConfigured()) {
    try {
      const [links, { data: pendingYoco }] = await Promise.all([
        listYocoPaymentLinks(),
        service
          .from("manual_payment_requests")
          .select("id, yoco_link_id, payment_reference")
          .eq("payment_method", "yoco")
          .in("status", ["pending", "proof_submitted", "verifying"])
          .not("yoco_link_id", "is", null)
          .limit(100),
      ]);
      for (const payment of pendingYoco || []) {
        const link = links.find(
          (item) =>
            item.id === payment.yoco_link_id ||
            item.order_id === payment.id ||
            item.customer_reference === payment.payment_reference,
        );
        if (link?.status !== "paid") continue;
        const result = await activateManualPayment({
          service,
          paymentId: payment.id,
          adminEmail: "yoco-sync",
          externalTransactionId: `yoco:${link.id}`,
          paymentMethod: "yoco",
          adminNote: "Automatically confirmed from legacy payment-link status",
          paidAt: link.updated_at || null,
        });
        if (result.ok) yocoActivated += 1;
      }
    } catch {
      /* Legacy payment-link outage must not block expiry maintenance */
    }
  }

  let payfastActivated = 0;
  try {
    const { data: stuckPayfast } = await service
      .from("manual_payment_requests")
      .select("id, pf_payment_id, payment_reference")
      .eq("payment_method", "payfast")
      .in("status", ["pending", "proof_submitted", "verifying"])
      .ilike("payfast_status", "complete")
      .limit(50);
    for (const row of stuckPayfast || []) {
      const pfId = row.pf_payment_id || row.payment_reference;
      const result = await activateManualPayment({
        service,
        paymentId: row.id,
        adminEmail: "cron-payfast-sync",
        externalTransactionId: `payfast:${pfId}`,
        paymentMethod: "payfast",
        adminNote: "Automatically activated from PayFast COMPLETE status (cron)",
      });
      if (result.ok) payfastActivated += 1;
    }
  } catch {
    /* PayFast sync must not block dunning maintenance */
  }

  let membershipsExpired = 0;
  for (const sub of expiredSubs || []) {
    const { data: current } = await service
      .from("subscriptions")
      .select("status, current_period_end, debit_status")
      .eq("user_id", sub.user_id)
      .maybeSingle();
    if (
      current?.status !== "active" ||
      !current.current_period_end ||
      new Date(current.current_period_end).getTime() >= Date.now()
    ) {
      continue;
    }
    // Past-due dunning still within grace: do not expire via period end yet.
    if (current.debit_status === "past_due") {
      continue;
    }
    await Promise.all([
      service
        .from("subscriptions")
        .update({ status: "inactive", updated_at: now })
        .eq("user_id", sub.user_id)
        .lt("current_period_end", now),
      service
        .from("profiles")
        .update({
          plan: "trial",
          is_premium: false,
          updated_at: now,
        })
        .eq("id", sub.user_id),
      service.from("user_reminders").insert({
        user_id: sub.user_id,
        kind: "renewal",
        title: "Membership period ended",
        body: "Renew for another 30 days to restore premium access.",
        href: "/pricing",
        severity: "urgent",
        dedupe_key: `manual-expired-${String(sub.current_period_end).slice(0, 10)}`,
        created_by: "cron",
      }),
    ]);
    membershipsExpired += 1;
  }

  // Debit decline dunning: day-3 remind, day-5 pause
  const { data: openDunning } = await service
    .from("manual_payment_requests")
    .select(
      "id, user_id, amount_zar_cents, dunning_fee_cents, dunning_remind3_at, dunning_pause_at, payment_reference",
    )
    .eq("billing_kind", "outstanding")
    .in("status", ["pending", "verifying", "proof_submitted"])
    .limit(200);

  let dunningReminded = 0;
  let dunningPaused = 0;
  const nowMs = Date.now();

  for (const row of openDunning || []) {
    const pauseAt = row.dunning_pause_at
      ? new Date(row.dunning_pause_at).getTime()
      : 0;
    const remind3At = row.dunning_remind3_at
      ? new Date(row.dunning_remind3_at).getTime()
      : 0;

    if (pauseAt && nowMs >= pauseAt) {
      await Promise.all([
        service
          .from("subscriptions")
          .update({
            debit_status: "paused",
            status: "inactive",
            dunning_paused_at: now,
            updated_at: now,
          })
          .eq("user_id", row.user_id),
        service
          .from("profiles")
          .update({
            is_premium: false,
            updated_at: now,
          })
          .eq("id", row.user_id),
        service
          .from("manual_payment_requests")
          .update({
            dunning_paused_at: now,
            updated_at: now,
          })
          .eq("id", row.id),
        service.from("user_reminders").insert({
          user_id: row.user_id,
          kind: "payment_failed",
          title: "Access paused — pay outstanding",
          body: `Your GLS TV access is paused after 5 days without payment. Click here and pay outstanding for ${row.payment_reference} to restore access.`,
          href: `/pricing/pay/${row.id}`,
          severity: "urgent",
          dedupe_key: `payfast-dunning-pause-${row.id}`,
          created_by: "cron",
          meta: {
            outstandingId: row.id,
            amountCents: row.amount_zar_cents,
          },
        }),
        service.from("manual_payment_events").insert({
          payment_request_id: row.id,
          user_id: row.user_id,
          event_type: "debit_dunning_paused",
          actor_email: "cron",
        }),
      ]);
      dunningPaused += 1;
      continue;
    }

    if (remind3At && nowMs >= remind3At) {
      const { error } = await service.from("user_reminders").insert({
        user_id: row.user_id,
        kind: "payment_failed",
        title: "Reminder: outstanding still unpaid",
        body: `Day 3 reminder — please click here and pay this month’s outstanding (${row.payment_reference}). Access pauses on day 5 if still unpaid.`,
        href: `/pricing/pay/${row.id}`,
        severity: "urgent",
        dedupe_key: `payfast-dunning-day3-${row.id}`,
        created_by: "cron",
        meta: {
          outstandingId: row.id,
          amountCents: row.amount_zar_cents,
        },
      });
      if (!error) dunningReminded += 1;
    }
  }

  let reconcileSummary: Record<string, unknown> = {};
  try {
    const reconcile = await fetchReconcileSummary(service);
    reconcileSummary = reconcile.summary;
  } catch {
    reconcileSummary = { error: "reconcile_failed" };
  }

  const summary = `requests=${expiredRequests?.length || 0} memberships=${membershipsExpired} yoco=${yocoActivated} payfast=${payfastActivated} dunningRemind=${dunningReminded} dunningPause=${dunningPaused} reconcileIssues=${reconcileSummary.issueCount ?? "?"}`;
  await recordCronRun(
    service,
    "manual-billing",
    "ok",
    summary,
    {
      requestsExpired: expiredRequests?.length || 0,
      membershipsExpired,
      yocoActivated,
      payfastActivated,
      dunningReminded,
      dunningPaused,
      reconcile: reconcileSummary,
    },
    startedAt,
  );

  return NextResponse.json({
    ok: true,
    requestsExpired: expiredRequests?.length || 0,
    membershipsExpired,
    yocoActivated,
    payfastActivated,
    dunningReminded,
    dunningPaused,
    reconcile: reconcileSummary,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { recordCronRun } from "@/lib/admin/audit";
import {
  activateManualPayment,
  listYocoPaymentLinks,
  yocoConfigured,
} from "@/lib/manual-billing";

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
    .in("provider", ["manual", "yoco"])
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
          adminNote: "Automatically confirmed from Yoco payment-link status",
          paidAt: link.updated_at || null,
        });
        if (result.ok) yocoActivated += 1;
      }
    } catch {
      /* Yoco outage must not block expiry maintenance */
    }
  }

  let membershipsExpired = 0;
  for (const sub of expiredSubs || []) {
    const { data: current } = await service
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", sub.user_id)
      .maybeSingle();
    if (
      current?.status !== "active" ||
      !current.current_period_end ||
      new Date(current.current_period_end).getTime() >= Date.now()
    ) {
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

  const summary = `requests=${expiredRequests?.length || 0} memberships=${membershipsExpired} yoco=${yocoActivated}`;
  await recordCronRun(
    service,
    "manual-billing",
    "ok",
    summary,
    {
      requestsExpired: expiredRequests?.length || 0,
      membershipsExpired,
      yocoActivated,
    },
    startedAt,
  );

  return NextResponse.json({
    ok: true,
    requestsExpired: expiredRequests?.length || 0,
    membershipsExpired,
    yocoActivated,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

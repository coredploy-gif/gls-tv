import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import {
  createPaymentQr,
  createYocoPaymentLink,
  ensureMemberReference,
  getManualPaymentSettings,
  isManualPlan,
  manualPlanCents,
  paymentReferenceFor,
  yocoConfigured,
  type ManualPaymentMethod,
} from "@/lib/manual-billing";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });

  const paymentId = req.nextUrl.searchParams.get("id");
  const member = await ensureMemberReference(service, user);
  const settings = await getManualPaymentSettings(service);

  let query = service
    .from("manual_payment_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (paymentId) query = query.eq("id", paymentId);
  const { data: payments, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = await Promise.all(
    (payments || []).map(async (payment) => ({
      ...payment,
      qrCode:
        payment.yoco_payment_url && settings.yoco_enabled
          ? await createPaymentQr(payment.yoco_payment_url)
          : null,
    })),
  );

  const { data: receipts } = await service
    .from("payment_receipts")
    .select(
      "id, receipt_number, payment_request_id, amount_zar_cents, plan, issued_at, membership_ends_at, refunded_at",
    )
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    member,
    settings: {
      ...settings,
      yoco_ready: settings.yoco_enabled && yocoConfigured(),
    },
    payments: rows,
    payment: paymentId ? rows[0] || null : null,
    receipts: receipts || [],
  });
}

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("payments"))) {
    return NextResponse.json(
      { error: "Payments are temporarily unavailable" },
      { status: 503 },
    );
  }
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "create");

  if (action === "create") {
    const plan = String(body.plan || "");
    if (!isManualPlan(plan)) {
      return NextResponse.json({ error: "Choose a valid plan" }, { status: 400 });
    }

    const member = await ensureMemberReference(service, user);
    const settings = await getManualPaymentSettings(service);
    const paymentReference = paymentReferenceFor(member.memberReference);
    const amountCents = manualPlanCents(plan);
    const requestedMethod = String(
      body.paymentMethod || "unselected",
    ) as ManualPaymentMethod;
    const paymentMethod: ManualPaymentMethod = [
      "unselected",
      "yoco",
      "eft",
    ].includes(requestedMethod)
      ? requestedMethod
      : "unselected";

    const { data: payment, error } = await service
      .from("manual_payment_requests")
      .insert({
        user_id: user.id,
        member_reference: member.memberReference,
        payment_reference: paymentReference,
        plan,
        amount_zar_cents: amountCents,
        payment_method: paymentMethod,
        status: "pending",
        member_note:
          body.memberNote != null ? String(body.memberNote).slice(0, 500) : null,
      })
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    let yocoWarning: string | null = null;
    let current = payment;
    if (
      settings.yoco_enabled &&
      yocoConfigured() &&
      paymentMethod !== "eft"
    ) {
      try {
        const link = await createYocoPaymentLink({
          amountCents,
          paymentReference,
          orderId: payment.id,
          description: `${settings.trading_name} ${plan} · 30 days`,
        });
        if (link) {
          const { data: updated } = await service
            .from("manual_payment_requests")
            .update({
              payment_method: "yoco",
              yoco_link_id: link.id,
              yoco_payment_url: link.url,
              yoco_status: link.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .select("*")
            .single();
          if (updated) current = updated;
        }
      } catch (err) {
        yocoWarning =
          err instanceof Error
            ? `Yoco is temporarily unavailable: ${err.message}. Use EFT.`
            : "Yoco is temporarily unavailable. Use EFT.";
      }
    }

    await Promise.all([
      service.from("manual_payment_events").insert({
        payment_request_id: payment.id,
        user_id: user.id,
        event_type: "payment_request_created",
        actor_email: user.email,
        meta: { plan, amountCents, method: current.payment_method },
      }),
      service.from("billing_events").insert({
        event_type: "manual_payment_requested",
        user_id: user.id,
        amount_zar_cents: amountCents,
        payload: {
          paymentId: payment.id,
          paymentReference,
          plan,
          method: current.payment_method,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      payment: {
        ...current,
        qrCode: current.yoco_payment_url
          ? await createPaymentQr(current.yoco_payment_url)
          : null,
      },
      settings,
      warning: yocoWarning,
      url: `/pricing/pay/${payment.id}`,
    });
  }

  const paymentId = String(body.paymentId || "");
  if (!paymentId)
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  const { data: payment } = await service
    .from("manual_payment_requests")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!payment)
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  if (action === "submit_proof") {
    if (["paid", "refunded", "canceled"].includes(payment.status)) {
      return NextResponse.json(
        { error: "This payment can no longer be submitted" },
        { status: 409 },
      );
    }
    const method = String(body.paymentMethod || payment.payment_method);
    if (!["yoco", "eft"].includes(method)) {
      return NextResponse.json(
        { error: "Choose Yoco or EFT" },
        { status: 400 },
      );
    }
    const proofReference = String(body.proofReference || "").trim().slice(0, 160);
    const proofNote = String(body.proofNote || "").trim().slice(0, 1000);
    if (method === "eft" && !proofReference && !proofNote) {
      return NextResponse.json(
        { error: "Add your bank transaction reference or payment note" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await service
      .from("manual_payment_requests")
      .update({
        payment_method: method,
        status: "proof_submitted",
        proof_reference: proofReference || null,
        proof_note: proofNote || null,
        submitted_at: now,
        updated_at: now,
      })
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    await Promise.all([
      service.from("manual_payment_events").insert({
        payment_request_id: paymentId,
        user_id: user.id,
        event_type: "proof_submitted",
        actor_email: user.email,
        note: proofNote || null,
        meta: { method, proofReference },
      }),
      service.from("user_reminders").insert({
        user_id: user.id,
        kind: "system",
        title: "Payment received for verification",
        body: `We are checking ${payment.payment_reference}. You will be notified after activation.`,
        href: `/pricing/pay/${paymentId}`,
        severity: "info",
        dedupe_key: `payment-submitted-${paymentId}`,
        created_by: "billing",
      }),
    ]);
    return NextResponse.json({ ok: true, payment: updated });
  }

  if (action === "cancel") {
    if (payment.status === "paid") {
      return NextResponse.json(
        { error: "Paid payments cannot be canceled" },
        { status: 409 },
      );
    }
    const { error } = await service
      .from("manual_payment_requests")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("user_id", user.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await service.from("manual_payment_events").insert({
      payment_request_id: paymentId,
      user_id: user.id,
      event_type: "payment_canceled",
      actor_email: user.email,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

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
  payfastConfigured,
  yocoConfigured,
  type ManualPaymentMethod,
} from "@/lib/manual-billing";
import {
  buildDebitOrderQuote,
  debitDayLabel,
  parsePayfastDebitDay,
  type PayfastDebitDay,
} from "@/lib/payfast-debit";
import { buildPayfastCheckout } from "@/lib/payfast";
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

function payfastReady(settings: { payfast_enabled: boolean }) {
  return settings.payfast_enabled && payfastConfigured();
}

function yocoReady(settings: { yoco_enabled: boolean }) {
  return settings.yoco_enabled && yocoConfigured();
}

function payfastItemName(
  settings: { trading_name: string },
  plan: string,
  billingKind: string,
) {
  if (billingKind === "debit_order") {
    return `${settings.trading_name} ${plan} · monthly debit`;
  }
  return `${settings.trading_name} ${plan} · 30 days`;
}

function checkoutPayload(
  payment: Record<string, unknown>,
  settings: Awaited<ReturnType<typeof getManualPaymentSettings>>,
  member: { email: string | null; displayName: string | null },
  origin: string | null,
) {
  if (!payfastReady(settings)) return null;
  if (
    ["paid", "canceled", "expired", "refunded"].includes(
      String(payment.status || ""),
    )
  ) {
    return null;
  }
  const billingKind = String(payment.billing_kind || "once");
  const plan = String(payment.plan);
  const subscription =
    billingKind === "debit_order" &&
    payment.recurring_amount_cents != null &&
    payment.next_billing_at
      ? {
          billingDateIso: String(payment.next_billing_at).slice(0, 10),
          recurringAmountCents: Number(payment.recurring_amount_cents) || 0,
        }
      : undefined;
  return buildPayfastCheckout({
    paymentId: String(payment.id),
    paymentReference: String(payment.payment_reference),
    amountCents: Number(payment.amount_zar_cents) || 0,
    itemName: payfastItemName(settings, plan, billingKind),
    email: member.email,
    nameFirst: member.displayName?.split(/\s+/)[0] || null,
    nameLast: member.displayName?.split(/\s+/).slice(1).join(" ") || null,
    origin,
    subscription,
  });
}

function debitOrderFields(plan: string, debitDay: PayfastDebitDay) {
  const monthlyCents = manualPlanCents(plan);
  const quote = buildDebitOrderQuote({ monthlyCents, debitDay });
  return {
    billing_kind: "debit_order" as const,
    debit_day: debitDay,
    recurring_amount_cents: monthlyCents,
    amount_zar_cents: quote.amountCents,
    next_billing_at: quote.billingDateIso,
  };
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
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;

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
      payfast:
        !["paid", "canceled", "expired", "refunded"].includes(payment.status)
          ? checkoutPayload(payment, settings, member, origin)
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
      yoco_ready: yocoReady(settings),
      payfast_ready: payfastReady(settings),
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
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    req.headers.get("origin") ||
    req.nextUrl.origin;

  if (action === "create") {
    const plan = String(body.plan || "");
    if (!isManualPlan(plan)) {
      return NextResponse.json({ error: "Choose a valid plan" }, { status: 400 });
    }

    const member = await ensureMemberReference(service, user);
    const settings = await getManualPaymentSettings(service);
    const paymentReference = paymentReferenceFor(member.memberReference);
    const monthlyCents = manualPlanCents(plan);
    const requestedMethod = String(
      body.paymentMethod || "unselected",
    ) as ManualPaymentMethod;
    const allowedMethods: ManualPaymentMethod[] = [
      "unselected",
      "yoco",
      "payfast",
      "eft",
    ];
    const paymentMethod: ManualPaymentMethod = allowedMethods.includes(
      requestedMethod,
    )
      ? requestedMethod
      : "unselected";

    const debitDay = parsePayfastDebitDay(body.debitDay);
    const isPayfastDebit =
      paymentMethod === "payfast" ||
      (paymentMethod === "unselected" && payfastReady(settings));
    const isEftOnce = paymentMethod === "eft";

    if (paymentMethod === "payfast" && !debitDay) {
      return NextResponse.json(
        { error: "Choose a debit day (1, 15, or 30) for PayFast" },
        { status: 400 },
      );
    }

    const insertRow: Record<string, unknown> = {
      user_id: user.id,
      member_reference: member.memberReference,
      payment_reference: paymentReference,
      plan,
      amount_zar_cents: monthlyCents,
      payment_method: paymentMethod,
      status: "pending",
      billing_kind: "once",
      member_note:
        body.memberNote != null ? String(body.memberNote).slice(0, 500) : null,
    };

    if (isEftOnce) {
      insertRow.billing_kind = "once";
      insertRow.amount_zar_cents = monthlyCents;
    } else if (isPayfastDebit && debitDay) {
      Object.assign(insertRow, debitOrderFields(plan, debitDay));
      insertRow.payment_method =
        paymentMethod === "unselected" ? "payfast" : paymentMethod;
    }

    const { data: payment, error } = await service
      .from("manual_payment_requests")
      .insert(insertRow)
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    let yocoWarning: string | null = null;
    let current = payment;
    const preferPayfast =
      paymentMethod === "payfast" ||
      (paymentMethod === "unselected" &&
        payfastReady(settings) &&
        !yocoReady(settings));
    const preferYoco =
      !preferPayfast &&
      paymentMethod !== "eft" &&
      yocoReady(settings);

    if (preferYoco) {
      try {
        const link = await createYocoPaymentLink({
          amountCents: monthlyCents,
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
            ? `Yoco is temporarily unavailable: ${err.message}. Use PayFast or EFT.`
            : "Yoco is temporarily unavailable. Use PayFast or EFT.";
      }
    } else if (preferPayfast && payfastReady(settings)) {
      const { data: updated } = await service
        .from("manual_payment_requests")
        .update({
          payment_method: "payfast",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .select("*")
        .single();
      if (updated) current = updated;
    }

    await Promise.all([
      service.from("manual_payment_events").insert({
        payment_request_id: payment.id,
        user_id: user.id,
        event_type: "payment_request_created",
        actor_email: user.email,
        meta: { plan, amountCents: current.amount_zar_cents, method: current.payment_method },
      }),
      service.from("billing_events").insert({
        event_type: "manual_payment_requested",
        user_id: user.id,
        amount_zar_cents: current.amount_zar_cents,
        payload: {
          paymentId: payment.id,
          paymentReference,
          plan,
          method: current.payment_method,
        },
      }),
    ]);

    const payfast = checkoutPayload(current, settings, member, origin);

    return NextResponse.json({
      ok: true,
      payment: {
        ...current,
        qrCode: current.yoco_payment_url
          ? await createPaymentQr(current.yoco_payment_url)
          : null,
        payfast,
      },
      settings: {
        ...settings,
        yoco_ready: yocoReady(settings),
        payfast_ready: payfastReady(settings),
      },
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

  if (action === "start_payfast") {
    const settings = await getManualPaymentSettings(service);
    if (!payfastReady(settings)) {
      return NextResponse.json(
        { error: "PayFast is not available right now" },
        { status: 503 },
      );
    }
    if (["paid", "refunded", "canceled", "expired"].includes(payment.status)) {
      return NextResponse.json(
        { error: "This payment can no longer be started" },
        { status: 409 },
      );
    }
    const debitDay =
      parsePayfastDebitDay(body.debitDay) ??
      parsePayfastDebitDay(payment.debit_day);
    if (!debitDay) {
      return NextResponse.json(
        { error: "Choose a debit day (1, 15, or 30) for PayFast" },
        { status: 400 },
      );
    }
    const member = await ensureMemberReference(service, user);
    const now = new Date().toISOString();
    const debitFields = debitOrderFields(String(payment.plan), debitDay);
    const { data: updated, error } = await service
      .from("manual_payment_requests")
      .update({
        payment_method: "payfast",
        status: payment.status === "pending" ? "verifying" : payment.status,
        ...debitFields,
        updated_at: now,
      })
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const payfast = checkoutPayload(updated, settings, member, origin);
    if (!payfast) {
      return NextResponse.json(
        { error: "PayFast is not configured" },
        { status: 503 },
      );
    }

    await Promise.all([
      service.from("manual_payment_events").insert({
        payment_request_id: paymentId,
        user_id: user.id,
        event_type: "payfast_checkout_started",
        actor_email: user.email,
        meta: { debitDay, billingKind: "debit_order" },
      }),
      service.from("user_reminders").insert({
        user_id: user.id,
        kind: "system",
        title: "Debit order setup",
        body: `Complete card setup on PayFast for ${payment.payment_reference}. Your monthly debit continues on the ${debitDayLabel(debitDay)}.`,
        href: `/pricing/pay/${paymentId}`,
        severity: "info",
        dedupe_key: `payfast-started-${paymentId}`,
        created_by: "billing",
      }),
    ]);

    return NextResponse.json({ ok: true, payment: updated, payfast });
  }

  if (action === "submit_proof") {
    if (["paid", "refunded", "canceled"].includes(payment.status)) {
      return NextResponse.json(
        { error: "This payment can no longer be submitted" },
        { status: 409 },
      );
    }
    const method = String(body.paymentMethod || payment.payment_method);
    if (!["yoco", "eft", "payfast"].includes(method)) {
      return NextResponse.json(
        { error: "Choose PayFast, Yoco, or EFT" },
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
        body: `We are checking ${payment.payment_reference}. Watch the notification bell — activation updates are in-app only for now.`,
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

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import {
  activateManualPayment,
  paymentReferenceFor,
  renewPayfastDebit,
} from "@/lib/manual-billing";
import {
  declineFeeCents,
  dunningSchedule,
  formatZarFromCents,
  outstandingCents,
} from "@/lib/payfast-debit";
import {
  confirmPayfastItn,
  isPayfastItnIpAllowed,
  parsePayfastFormBody,
  payfastConfigured,
  payfastCredentials,
  payfastRequestIp,
  verifyPayfastItnSignature,
} from "@/lib/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function amountGrossToCents(amountGross: string): number {
  const parsed = Number.parseFloat(amountGross);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

async function resolveRenewUserId(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  token: string | null,
  mPaymentId: string,
): Promise<string | null> {
  if (token) {
    const { data: subByToken } = await service
      .from("subscriptions")
      .select("user_id")
      .eq("payfast_token", token)
      .maybeSingle();
    if (subByToken?.user_id) return subByToken.user_id;
  }

  if (mPaymentId) {
    const { data: priorPaid } = await service
      .from("manual_payment_requests")
      .select("user_id")
      .eq("payment_reference", mPaymentId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorPaid?.user_id) return priorPaid.user_id;
  }

  if (token) {
    const { data: priorByToken } = await service
      .from("manual_payment_requests")
      .select("user_id")
      .eq("payfast_token", token)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorByToken?.user_id) return priorByToken.user_id;
  }

  return null;
}

async function handleDebitFailure(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
  token: string,
  paymentStatus: string,
  pfPaymentId: string,
  mPaymentId: string,
) {
  const parentKey = pfPaymentId || `m:${mPaymentId}` || token;
  if (pfPaymentId) {
    const { data: existing } = await service
      .from("manual_payment_requests")
      .select("id")
      .eq("billing_kind", "outstanding")
      .eq("dunning_parent_pf_payment_id", pfPaymentId)
      .in("status", ["pending", "verifying", "proof_submitted", "paid"])
      .maybeSingle();
    if (existing) return;
  }

  const { data: sub } = await service
    .from("subscriptions")
    .select(
      "plan, amount_zar_cents, debit_day, next_billing_at, payfast_token",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const { data: profile } = await service
    .from("profiles")
    .select("member_reference, plan")
    .eq("id", userId)
    .maybeSingle();

  const plan = String(sub?.plan || profile?.plan || "gls_55");
  const monthlyCents =
    Number(sub?.amount_zar_cents) > 0
      ? Number(sub?.amount_zar_cents)
      : plan === "gls_65"
        ? 5500
        : plan === "gls_75"
          ? 6500
          : 4500;
  const feeCents = declineFeeCents(monthlyCents);
  const dueCents = outstandingCents(monthlyCents);
  const schedule = dunningSchedule();
  const memberRef = profile?.member_reference || `GLS-${userId.slice(0, 8)}`;
  const paymentReference = paymentReferenceFor(memberRef);

  const { data: outstanding, error } = await service
    .from("manual_payment_requests")
    .insert({
      user_id: userId,
      member_reference: memberRef,
      payment_reference: paymentReference,
      plan,
      amount_zar_cents: dueCents,
      recurring_amount_cents: monthlyCents,
      dunning_fee_cents: feeCents,
      currency: "zar",
      status: "pending",
      payment_method: "payfast",
      billing_kind: "outstanding",
      debit_day: sub?.debit_day ?? null,
      next_billing_at: sub?.next_billing_at ?? null,
      payfast_token: token || sub?.payfast_token || null,
      dunning_opened_at: schedule.openedAt.toISOString(),
      dunning_remind3_at: schedule.remind3At.toISOString(),
      dunning_pause_at: schedule.pauseAt.toISOString(),
      dunning_parent_pf_payment_id: pfPaymentId || parentKey,
      member_note: `Failed debit ${paymentStatus}; outstanding = plan + 3% fee`,
      expires_at: new Date(
        schedule.pauseAt.getTime() + 30 * 86_400_000,
      ).toISOString(),
    })
    .select("id")
    .single();

  if (error || !outstanding) {
    return;
  }

  const now = new Date().toISOString();
  await service
    .from("subscriptions")
    .update({
      debit_status: "past_due",
      updated_at: now,
    })
    .eq("user_id", userId);

  await Promise.all([
    service.from("manual_payment_events").insert({
      payment_request_id: outstanding.id,
      user_id: userId,
      event_type: "debit_dunning_opened",
      actor_email: "payfast-itn",
      meta: {
        pfPaymentId,
        mPaymentId,
        paymentStatus,
        monthlyCents,
        feeCents,
        dueCents,
        remind3At: schedule.remind3At.toISOString(),
        pauseAt: schedule.pauseAt.toISOString(),
      },
    }),
    service.from("user_reminders").insert({
      user_id: userId,
      kind: "payment_failed",
      title: "Please pay this month’s outstanding",
      body: `Your card debit did not go through. Please click here and pay ${formatZarFromCents(dueCents)} outstanding for this month (plan + 3% fee). Access stays on for 5 days.`,
      href: `/pricing/pay/${outstanding.id}`,
      severity: "urgent",
      dedupe_key: `payfast-dunning-day0-${parentKey}`,
      created_by: "payfast-itn",
      meta: {
        paymentStatus,
        pfPaymentId,
        mPaymentId,
        token,
        outstandingId: outstanding.id,
        feeCents,
        dueCents,
      },
    }),
  ]);
}

/**
 * PayFast Instant Transaction Notification (ITN).
 * Responds with HTTP 200 quickly after processing; must be idempotent.
 */
export async function POST(req: NextRequest) {
  if (!payfastConfigured()) {
    return new NextResponse("PayFast not configured", { status: 503 });
  }

  const sourceIp = payfastRequestIp(req);
  if (!isPayfastItnIpAllowed(sourceIp)) {
    return new NextResponse("Invalid source IP", { status: 403 });
  }

  const rawBody = await req.text();
  const { data, ordered, paramString } = parsePayfastFormBody(rawBody);
  const signature = data.signature || "";
  const { passphrase, merchantId } = payfastCredentials();

  if (
    !signature ||
    !verifyPayfastItnSignature(ordered, signature, passphrase || null)
  ) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  if (data.merchant_id && data.merchant_id !== merchantId) {
    return new NextResponse("Merchant mismatch", { status: 401 });
  }

  let validServer = false;
  try {
    validServer = await confirmPayfastItn(paramString);
  } catch {
    validServer = false;
  }
  if (!validServer) {
    return new NextResponse("Invalid server confirmation", { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return new NextResponse("Service unavailable", { status: 503 });
  }

  const mPaymentId = String(data.m_payment_id || "").trim();
  const pfPaymentId = String(data.pf_payment_id || "").trim();
  const paymentStatus = String(data.payment_status || "").toUpperCase();
  const token = String(data.token || "").trim() || null;
  const amountGross = String(data.amount_gross || "").trim();

  if (!mPaymentId && !pfPaymentId) {
    return new NextResponse("OK", { status: 200 });
  }

  // Idempotent: same PayFast transaction already recorded as paid.
  if (pfPaymentId) {
    const { data: alreadyByPf } = await service
      .from("manual_payment_requests")
      .select("id")
      .eq("pf_payment_id", pfPaymentId)
      .eq("status", "paid")
      .maybeSingle();
    if (alreadyByPf) {
      return new NextResponse("OK", { status: 200 });
    }
  }

  let openPayment: {
    id: string;
    payment_reference: string;
    amount_zar_cents: number;
    status: string;
    payment_method: string;
    user_id: string;
    pf_payment_id: string | null;
  } | null = null;

  if (mPaymentId) {
    const { data } = await service
      .from("manual_payment_requests")
      .select(
        "id, payment_reference, amount_zar_cents, status, payment_method, user_id, pf_payment_id",
      )
      .eq("payment_reference", mPaymentId)
      .in("status", ["pending", "proof_submitted", "verifying"])
      .maybeSingle();
    openPayment = data;
  } else if (pfPaymentId) {
    const { data } = await service
      .from("manual_payment_requests")
      .select(
        "id, payment_reference, amount_zar_cents, status, payment_method, user_id, pf_payment_id",
      )
      .eq("pf_payment_id", pfPaymentId)
      .in("status", ["pending", "proof_submitted", "verifying"])
      .maybeSingle();
    openPayment = data;
  }

  let paidOriginal: { id: string; user_id: string } | null = null;
  if (mPaymentId) {
    const { data } = await service
      .from("manual_payment_requests")
      .select("id, user_id")
      .eq("payment_reference", mPaymentId)
      .eq("status", "paid")
      .maybeSingle();
    paidOriginal = data;
  }

  // First payment: pending checkout row still open.
  if (openPayment) {
    const expectedAmount = (openPayment.amount_zar_cents / 100).toFixed(2);
    if (amountGross && amountGross !== expectedAmount) {
      await service.from("manual_payment_events").insert({
        payment_request_id: openPayment.id,
        user_id: openPayment.user_id,
        event_type: "payfast_amount_mismatch",
        actor_email: "payfast-itn",
        meta: {
          amountGross,
          expectedAmount,
          pfPaymentId,
          paymentStatus,
          sourceIp,
        },
      });
      return new NextResponse("OK", { status: 200 });
    }

    const now = new Date().toISOString();
    await service
      .from("manual_payment_requests")
      .update({
        payment_method: "payfast",
        pf_payment_id: pfPaymentId || openPayment.pf_payment_id,
        payfast_token: token,
        payfast_status: paymentStatus.toLowerCase() || null,
        status:
          paymentStatus === "COMPLETE"
            ? openPayment.status === "paid"
              ? "paid"
              : "verifying"
            : openPayment.status,
        updated_at: now,
      })
      .eq("id", openPayment.id)
      .neq("status", "paid");

    await service.from("manual_payment_events").insert({
      payment_request_id: openPayment.id,
      user_id: openPayment.user_id,
      event_type: "payfast_itn",
      actor_email: "payfast-itn",
      meta: {
        pfPaymentId,
        paymentStatus,
        amountGross,
        mPaymentId,
        sourceIp,
        flow: "first",
      },
    });

    if (paymentStatus !== "COMPLETE") {
      // First checkout decline: leave pending; no dunning until an active debit exists.
      return new NextResponse("OK", { status: 200 });
    }

    const result = await activateManualPayment({
      service,
      paymentId: openPayment.id,
      adminEmail: "payfast-itn",
      externalTransactionId: `payfast:${pfPaymentId || mPaymentId}`,
      paymentMethod: "payfast",
      adminNote: "Activated from PayFast ITN",
    });

    if (!result.ok && !String(result.error || "").includes("already")) {
      await service.from("manual_payment_events").insert({
        payment_request_id: openPayment.id,
        user_id: openPayment.user_id,
        event_type: "payfast_activation_failed",
        actor_email: "payfast-itn",
        note: result.error,
      });
    }

    return new NextResponse("OK", { status: 200 });
  }

  // Recurring or post-activation ITN: original row paid, new pf_payment_id.
  const renewUserId = await resolveRenewUserId(service, token, mPaymentId);

  if (paymentStatus !== "COMPLETE") {
    if (token && renewUserId) {
      await handleDebitFailure(
        service,
        renewUserId,
        token,
        paymentStatus,
        pfPaymentId,
        mPaymentId,
      );
    }
    return new NextResponse("OK", { status: 200 });
  }

  if (!renewUserId || !pfPaymentId) {
    return new NextResponse("OK", { status: 200 });
  }

  const amountCents = amountGrossToCents(amountGross);
  if (amountGross && amountCents <= 0) {
    return new NextResponse("OK", { status: 200 });
  }

  if (paidOriginal) {
    await service.from("manual_payment_events").insert({
      payment_request_id: paidOriginal.id,
      user_id: renewUserId,
      event_type: "payfast_itn",
      actor_email: "payfast-itn",
      meta: {
        pfPaymentId,
        paymentStatus,
        amountGross,
        mPaymentId,
        sourceIp,
        flow: "renew",
      },
    });
  }

  const renewResult = await renewPayfastDebit({
    service,
    userId: renewUserId,
    pfPaymentId,
    token,
    amountCents: amountCents > 0 ? amountCents : 100,
    adminEmail: "payfast-itn",
  });

  if (!renewResult.ok && paidOriginal?.id) {
    await service.from("manual_payment_events").insert({
      payment_request_id: paidOriginal.id,
      user_id: renewUserId,
      event_type: "payfast_renew_failed",
      actor_email: "payfast-itn",
      note: renewResult.error,
      meta: { pfPaymentId, mPaymentId, amountGross },
    });
  }

  return new NextResponse("OK", { status: 200 });
}

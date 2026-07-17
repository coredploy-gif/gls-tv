import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { activateManualPayment } from "@/lib/manual-billing";
import {
  confirmPayfastItn,
  parsePayfastFormBody,
  payfastConfigured,
  payfastCredentials,
  verifyPayfastItnSignature,
} from "@/lib/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayFast Instant Transaction Notification (ITN).
 * Responds with HTTP 200 quickly after processing; must be idempotent.
 */
export async function POST(req: NextRequest) {
  if (!payfastConfigured()) {
    return new NextResponse("PayFast not configured", { status: 503 });
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

  let query = service
    .from("manual_payment_requests")
    .select(
      "id, payment_reference, amount_zar_cents, status, payment_method, user_id, pf_payment_id",
    )
    .in("status", ["pending", "proof_submitted", "verifying"]);

  if (mPaymentId) query = query.eq("payment_reference", mPaymentId);
  else query = query.eq("pf_payment_id", pfPaymentId);

  const { data: payment } = await query.maybeSingle();
  if (!payment) {
    return new NextResponse("OK", { status: 200 });
  }

  const expectedAmount = (payment.amount_zar_cents / 100).toFixed(2);
  if (amountGross && amountGross !== expectedAmount) {
    await service.from("manual_payment_events").insert({
      payment_request_id: payment.id,
      user_id: payment.user_id,
      event_type: "payfast_amount_mismatch",
      actor_email: "payfast-itn",
      meta: { amountGross, expectedAmount, pfPaymentId, paymentStatus },
    });
    return new NextResponse("OK", { status: 200 });
  }

  const now = new Date().toISOString();
  await service
    .from("manual_payment_requests")
    .update({
      payment_method: "payfast",
      pf_payment_id: pfPaymentId || payment.pf_payment_id,
      payfast_token: token,
      payfast_status: paymentStatus.toLowerCase() || null,
      status:
        paymentStatus === "COMPLETE"
          ? payment.status === "paid"
            ? "paid"
            : "verifying"
          : payment.status,
      updated_at: now,
    })
    .eq("id", payment.id)
    .neq("status", "paid");

  await service.from("manual_payment_events").insert({
    payment_request_id: payment.id,
    user_id: payment.user_id,
    event_type: "payfast_itn",
    actor_email: "payfast-itn",
    meta: {
      pfPaymentId,
      paymentStatus,
      amountGross,
      mPaymentId,
    },
  });

  if (paymentStatus !== "COMPLETE") {
    return new NextResponse("OK", { status: 200 });
  }

  const result = await activateManualPayment({
    service,
    paymentId: payment.id,
    adminEmail: "payfast-itn",
    externalTransactionId: `payfast:${pfPaymentId || mPaymentId}`,
    paymentMethod: "payfast",
    adminNote: "Activated from PayFast ITN",
  });

  if (!result.ok && !String(result.error || "").includes("already")) {
    await service.from("manual_payment_events").insert({
      payment_request_id: payment.id,
      user_id: payment.user_id,
      event_type: "payfast_activation_failed",
      actor_email: "payfast-itn",
      note: result.error,
    });
  }

  return new NextResponse("OK", { status: 200 });
}

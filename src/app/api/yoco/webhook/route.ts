import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import {
  activateManualPayment,
  yocoConfigured,
} from "@/lib/manual-billing";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.YOCO_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/i, ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Yoco payment-link webhook (event-driven activation).
 * Falls back to cron sync_yoco when webhook secret is unset (non-prod).
 */
export async function POST(req: NextRequest) {
  if (!yocoConfigured()) {
    return NextResponse.json({ error: "Yoco not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get("x-yoco-signature") ||
    req.headers.get("yoco-signature") ||
    req.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const data = (payload.data || payload.payload || payload) as Record<
    string,
    unknown
  >;
  const status = String(data.status || payload.status || "").toLowerCase();
  const linkId = String(data.id || data.payment_link_id || "").trim();
  const orderId = String(data.order_id || "").trim();
  const customerRef = String(
    data.customer_reference || data.metadata || "",
  ).trim();

  if (status !== "paid" && status !== "successful" && status !== "completed") {
    return NextResponse.json({ ok: true, ignored: true, status });
  }

  let query = service
    .from("manual_payment_requests")
    .select("id, yoco_link_id, payment_reference")
    .eq("payment_method", "yoco")
    .in("status", ["pending", "proof_submitted", "verifying"]);

  if (linkId) query = query.eq("yoco_link_id", linkId);
  else if (orderId) query = query.eq("id", orderId);
  else if (customerRef) query = query.eq("payment_reference", customerRef);
  else {
    return NextResponse.json({ error: "No payment identifiers" }, { status: 400 });
  }

  const { data: payment } = await query.maybeSingle();
  if (!payment) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const result = await activateManualPayment({
    service,
    paymentId: payment.id,
    adminEmail: "yoco-webhook",
    externalTransactionId: `yoco-webhook:${linkId || payment.id}`,
    paymentMethod: "yoco",
    adminNote: "Activated from Yoco webhook",
    paidAt: typeof data.updated_at === "string" ? data.updated_at : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    alreadyPaid: result.alreadyPaid,
    paymentId: payment.id,
  });
}

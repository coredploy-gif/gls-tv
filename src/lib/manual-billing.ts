import type { SupabaseClient, User } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { maxViewerSlots, type GlsPlanId } from "@/lib/membership/plans";

export type ManualPlanId = Extract<GlsPlanId, "gls_55" | "gls_65" | "gls_75">;
export type ManualPaymentStatus =
  | "pending"
  | "proof_submitted"
  | "verifying"
  | "paid"
  | "rejected"
  | "expired"
  | "canceled"
  | "refunded";

export type ManualPaymentMethod =
  | "unselected"
  | "yoco"
  | "eft"
  | "cash"
  | "other";

export const MEMBERSHIP_DAYS = 30;

export function isManualPlan(value: string): value is ManualPlanId {
  return value === "gls_55" || value === "gls_65" || value === "gls_75";
}

export function manualPlanCents(plan: ManualPlanId) {
  if (plan === "gls_65") return 6500;
  if (plan === "gls_75") return 7500;
  return 5500;
}

export function memberReferenceFor(userId: string) {
  return `GLS-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function paymentReferenceFor(memberReference: string) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase();
  return `${memberReference}-${suffix}`;
}

export function yocoConfigured() {
  return Boolean(process.env.YOCO_SECRET_KEY?.trim());
}

export async function createPaymentQr(value: string | null | undefined) {
  if (!value) return null;
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#09090b", light: "#ffffff" },
  });
}

export async function createYocoPaymentLink(input: {
  amountCents: number;
  paymentReference: string;
  orderId: string;
  description: string;
}) {
  const secret = process.env.YOCO_SECRET_KEY?.trim();
  if (!secret) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.yoco.com/v1/payment_links/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: "ZAR",
        customer_reference: input.paymentReference,
        customer_description: input.description,
        order_id: input.orderId,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as
      | {
          id?: string;
          url?: string;
          status?: string;
          detail?: string;
          message?: string;
        }
      | null;
    if (!response.ok || !json?.id || !json.url) {
      throw new Error(
        json?.detail || json?.message || `Yoco returned ${response.status}`,
      );
    }
    return {
      id: json.id,
      url: json.url,
      status: json.status || "pending",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listYocoPaymentLinks() {
  const secret = process.env.YOCO_SECRET_KEY?.trim();
  if (!secret) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      "https://api.yoco.com/v1/payment_links/?limit=100",
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const json = (await response.json().catch(() => null)) as
      | {
          data?: Array<{
            id: string;
            order_id: string;
            customer_reference: string;
            status: string;
            url: string;
            updated_at?: string | null;
          }>;
          detail?: string;
          message?: string;
        }
      | null;
    if (!response.ok) {
      throw new Error(
        json?.detail || json?.message || `Yoco returned ${response.status}`,
      );
    }
    return json?.data || [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function ensureMemberReference(
  service: SupabaseClient,
  user: User,
) {
  const { data: profile } = await service
    .from("profiles")
    .select("member_reference, email, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const memberReference =
    profile?.member_reference || memberReferenceFor(user.id);
  if (!profile?.member_reference) {
    await service
      .from("profiles")
      .update({
        member_reference: memberReference,
        email: user.email || profile?.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }
  return {
    memberReference,
    email: user.email || profile?.email || null,
    displayName: profile?.display_name || null,
  };
}

export async function getManualPaymentSettings(service: SupabaseClient) {
  const { data } = await service
    .from("manual_payment_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  return {
    id: "default",
    trading_name: data?.trading_name || "GLS TV",
    support_email: data?.support_email || null,
    yoco_enabled: data?.yoco_enabled !== false,
    eft_enabled: data?.eft_enabled !== false,
    bank_name: data?.bank_name || null,
    account_holder: data?.account_holder || null,
    account_number: data?.account_number || null,
    branch_code: data?.branch_code || null,
    account_type: data?.account_type || null,
    payment_note:
      data?.payment_note ||
      "Use the exact GLS payment reference. Access is activated after payment verification.",
    receipt_footer:
      data?.receipt_footer || "Thank you for your GLS TV membership.",
  };
}

export async function activateManualPayment(input: {
  service: SupabaseClient;
  paymentId: string;
  adminEmail: string;
  externalTransactionId?: string | null;
  adminNote?: string | null;
  paidAt?: string | null;
}) {
  const { service, paymentId, adminEmail } = input;
  const { data: payment, error } = await service
    .from("manual_payment_requests")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (error || !payment) {
    return { ok: false as const, error: error?.message || "Payment not found" };
  }

  const { data: existingReceipt } = await service
    .from("payment_receipts")
    .select("*")
    .eq("payment_request_id", paymentId)
    .maybeSingle();
  if (existingReceipt) {
    return {
      ok: true as const,
      alreadyPaid: true,
      payment,
      receipt: existingReceipt,
    };
  }

  const { data: currentSub } = await service
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", payment.user_id)
    .maybeSingle();
  const now = new Date(input.paidAt || Date.now());
  const existingEnd = currentSub?.current_period_end
    ? new Date(currentSub.current_period_end)
    : null;
  const startsAt =
    existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;
  const endsAt = new Date(
    startsAt.getTime() + MEMBERSHIP_DAYS * 86_400_000,
  );
  const transactionId =
    input.externalTransactionId?.trim() ||
    payment.external_transaction_id ||
    null;

  const { error: profileError } = await service
    .from("profiles")
    .update({
      plan: payment.plan,
      is_premium: true,
      is_admin_exception: false,
      max_viewer_profiles: maxViewerSlots(payment.plan),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.user_id);
  if (profileError) {
    return { ok: false as const, error: profileError.message };
  }

  const { error: subError } = await service.from("subscriptions").upsert(
    {
      user_id: payment.user_id,
      plan: payment.plan,
      status: "active",
      provider: payment.payment_method === "yoco" ? "yoco" : "manual",
      external_id: transactionId || payment.payment_reference,
      current_period_end: endsAt.toISOString(),
      amount_zar_cents: payment.amount_zar_cents,
      currency: "zar",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (subError) return { ok: false as const, error: subError.message };

  const paidAt = now.toISOString();
  const { data: paidPayment, error: paymentError } = await service
    .from("manual_payment_requests")
    .update({
      status: "paid",
      paid_at: paidAt,
      submitted_at: payment.submitted_at || paidAt,
      verified_at: new Date().toISOString(),
      verified_by: adminEmail,
      external_transaction_id: transactionId,
      admin_note: input.adminNote || payment.admin_note || null,
      membership_starts_at: startsAt.toISOString(),
      membership_ends_at: endsAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select("*")
    .single();
  if (paymentError) {
    return { ok: false as const, error: paymentError.message };
  }

  const [{ data: profile }, settings] = await Promise.all([
    service
      .from("profiles")
      .select("email, display_name")
      .eq("id", payment.user_id)
      .maybeSingle(),
    getManualPaymentSettings(service),
  ]);

  const { data: receipt, error: receiptError } = await service
    .from("payment_receipts")
    .insert({
      payment_request_id: paymentId,
      user_id: payment.user_id,
      member_reference: payment.member_reference,
      payment_reference: payment.payment_reference,
      plan: payment.plan,
      amount_zar_cents: payment.amount_zar_cents,
      payment_method: payment.payment_method,
      external_transaction_id: transactionId,
      customer_name: profile?.display_name || null,
      customer_email: profile?.email || null,
      trading_name: settings.trading_name,
      membership_starts_at: startsAt.toISOString(),
      membership_ends_at: endsAt.toISOString(),
      paid_at: paidAt,
      issued_by: adminEmail,
      receipt_footer: settings.receipt_footer,
    })
    .select("*")
    .single();
  if (receiptError) {
    return { ok: false as const, error: receiptError.message };
  }

  await Promise.all([
    service.from("manual_payment_events").insert({
      payment_request_id: paymentId,
      user_id: payment.user_id,
      event_type: "payment_approved",
      actor_email: adminEmail,
      note: input.adminNote || null,
      meta: {
        transactionId,
        receiptNumber: receipt.receipt_number,
        membershipEndsAt: endsAt.toISOString(),
      },
    }),
    service.from("billing_events").insert({
      event_type: "manual_payment_approved",
      user_id: payment.user_id,
      amount_zar_cents: payment.amount_zar_cents,
      payload: {
        paymentId,
        paymentReference: payment.payment_reference,
        receiptNumber: receipt.receipt_number,
        method: payment.payment_method,
        by: adminEmail,
      },
    }),
    service.from("user_reminders").insert({
      user_id: payment.user_id,
      kind: "admin",
      title: "Membership activated",
      body: `Your ${MEMBERSHIP_DAYS}-day GLS TV membership is active until ${endsAt.toLocaleDateString("en-ZA")}.`,
      href: `/receipts/${receipt.id}`,
      severity: "info",
      dedupe_key: `payment-approved-${paymentId}`,
      created_by: adminEmail,
      meta: { paymentId, receiptId: receipt.id },
    }),
  ]);

  return {
    ok: true as const,
    alreadyPaid: false,
    payment: paidPayment,
    receipt,
  };
}

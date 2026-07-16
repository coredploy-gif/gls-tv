import type { SupabaseClient, User } from "@supabase/supabase-js";
import QRCode from "qrcode";
import type { GlsPlanId } from "@/lib/membership/plans";

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
  if (plan === "gls_65") return 5500;
  if (plan === "gls_75") return 6500;
  return 4500;
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
  paymentMethod: Exclude<ManualPaymentMethod, "unselected">;
  adminNote?: string | null;
  paidAt?: string | null;
}) {
  const paidAt = new Date(input.paidAt || Date.now());
  if (Number.isNaN(paidAt.getTime())) {
    return { ok: false as const, error: "Invalid paid date" };
  }
  const { data, error } = await input.service.rpc("activate_manual_payment", {
    p_payment_id: input.paymentId,
    p_admin_email: input.adminEmail,
    p_external_transaction_id: input.externalTransactionId?.trim() || null,
    p_payment_method: input.paymentMethod,
    p_admin_note: input.adminNote?.trim() || null,
    p_paid_at: paidAt.toISOString(),
  });
  if (error || !data) {
    return { ok: false as const, error: error?.message || "Activation failed" };
  }
  const result = data as {
    alreadyPaid: boolean;
    payment: Record<string, unknown>;
    receipt: Record<string, unknown>;
  };
  return { ok: true as const, ...result };
}

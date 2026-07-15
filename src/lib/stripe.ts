import Stripe from "stripe";
import type { GlsPlanId } from "@/lib/membership/plans";
import { GLS_PLANS } from "@/lib/membership/plans";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}

/** Prefer Dashboard Price IDs when set; otherwise Checkout uses price_data. */
export function stripePriceIdForPlan(plan: GlsPlanId): string | null {
  switch (plan) {
    case "gls_55":
      return process.env.STRIPE_PRICE_GLS_55 || null;
    case "gls_65":
      return process.env.STRIPE_PRICE_GLS_65 || null;
    case "gls_75":
      return process.env.STRIPE_PRICE_GLS_75 || null;
    default:
      return null;
  }
}

export function isBillablePlan(
  plan: string,
): plan is "gls_55" | "gls_65" | "gls_75" {
  return plan === "gls_55" || plan === "gls_65" || plan === "gls_75";
}

export function planFromStripeMetadata(
  meta: Stripe.Metadata | null | undefined,
): GlsPlanId | null {
  const p = meta?.gls_plan || meta?.plan;
  if (p && isBillablePlan(p)) return p;
  return null;
}

export function planFromAmountZarCents(cents: number): GlsPlanId | null {
  const match = GLS_PLANS.find((p) => (p.priceZar || 0) * 100 === cents);
  return match?.id ?? null;
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

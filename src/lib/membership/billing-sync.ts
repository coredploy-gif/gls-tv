import type Stripe from "stripe";
import { createServiceClient } from "@/lib/eadmin";
import { maxViewerSlots, type GlsPlanId } from "@/lib/membership/plans";
import {
  getStripe,
  isBillablePlan,
  planFromAmountZarCents,
  planFromStripeMetadata,
} from "@/lib/stripe";

export async function resolvePlanFromSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<GlsPlanId | null> {
  const fromMeta = planFromStripeMetadata(subscription.metadata);
  if (fromMeta) return fromMeta;

  const item = subscription.items.data[0];
  const price = item?.price;
  if (!price) return null;
  if (typeof price === "string") {
    const full = await stripe.prices.retrieve(price);
    return planFromAmountZarCents(full.unit_amount || 0);
  }
  const fromProductMeta =
    typeof price.product === "object" &&
    price.product &&
    !("deleted" in price.product && price.product.deleted)
      ? planFromStripeMetadata((price.product as Stripe.Product).metadata)
      : null;
  if (fromProductMeta) return fromProductMeta;
  return planFromAmountZarCents(price.unit_amount || 0);
}

export function periodEndIso(subscription: Stripe.Subscription): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

export function amountCentsForPlan(plan: GlsPlanId): number {
  if (plan === "gls_55") return 4500;
  if (plan === "gls_65") return 5500;
  if (plan === "gls_75") return 6500;
  return 0;
}

export async function applyPaidPlan(opts: {
  userId: string;
  plan: GlsPlanId;
  customerId?: string | null;
  subscriptionId: string;
  status: string;
  periodEnd: string | null;
  stripeEventId?: string | null;
  eventType?: string;
}) {
  const service = createServiceClient();
  if (!service) return { ok: false as const, error: "No service role" };

  const active =
    opts.status === "active" ||
    opts.status === "trialing" ||
    opts.status === "past_due";
  const amount = amountCentsForPlan(opts.plan);

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      plan: active ? opts.plan : "trial",
      is_premium: active,
      max_viewer_profiles: maxViewerSlots(opts.plan),
      stripe_customer_id: opts.customerId || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.userId);

  if (profileErr) return { ok: false as const, error: profileErr.message };

  const { error: subErr } = await service.from("subscriptions").upsert(
    {
      user_id: opts.userId,
      plan: opts.plan,
      status: opts.status,
      provider: "stripe",
      external_id: opts.subscriptionId,
      stripe_customer_id: opts.customerId || null,
      current_period_end: opts.periodEnd,
      amount_zar_cents: amount,
      currency: "zar",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (subErr) return { ok: false as const, error: subErr.message };

  const eventRow = {
    event_type: opts.eventType || `subscription_${opts.status}`,
    user_id: opts.userId,
    amount_zar_cents: amount,
    payload: {
      subscriptionId: opts.subscriptionId,
      plan: opts.plan,
      customerId: opts.customerId,
      status: opts.status,
    },
  };

  if (opts.stripeEventId) {
    await service.from("billing_events").upsert(
      { ...eventRow, stripe_event_id: opts.stripeEventId },
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    );
  } else {
    await service.from("billing_events").insert(eventRow);
  }

  return { ok: true as const, plan: opts.plan, active };
}

/** Apply a completed Checkout Session to local membership. */
export async function syncCheckoutSession(sessionId: string, userId?: string) {
  const stripe = getStripe();
  if (!stripe) return { ok: false as const, error: "Stripe not configured" };

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  if (session.mode !== "subscription") {
    return { ok: false as const, error: "Not a subscription checkout" };
  }

  const owner =
    userId ||
    session.client_reference_id ||
    session.metadata?.supabase_user_id ||
    null;
  if (!owner) return { ok: false as const, error: "Missing user on session" };

  if (userId && session.client_reference_id && session.client_reference_id !== userId) {
    return { ok: false as const, error: "Session does not belong to this user" };
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subId) return { ok: false as const, error: "No subscription on session" };

  const sub =
    typeof session.subscription === "object" && session.subscription
      ? (session.subscription as Stripe.Subscription)
      : await stripe.subscriptions.retrieve(subId);

  const plan =
    planFromStripeMetadata(session.metadata) ||
    (await resolvePlanFromSubscription(stripe, sub)) ||
    "gls_55";

  if (!isBillablePlan(plan)) {
    return { ok: false as const, error: "Could not resolve plan" };
  }

  const result = await applyPaidPlan({
    userId: owner,
    plan,
    customerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id,
    subscriptionId: subId,
    status: sub.status,
    periodEnd: periodEndIso(sub),
    eventType: "checkout_session_synced",
    stripeEventId: `sync_${sessionId}`,
  });

  return result.ok
    ? { ok: true as const, plan, status: sub.status, userId: owner }
    : result;
}

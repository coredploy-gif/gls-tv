import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { GLS_PLANS } from "@/lib/membership/plans";
import {
  getStripe,
  isBillablePlan,
  siteUrl,
  stripePriceIdForPlan,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create Stripe Checkout Session (subscription, ZAR) for R45/R55/R65. */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local (see .env.local.example).",
      },
      { status: 503 },
    );
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json()) as { plan?: string };
  const plan = String(body.plan || "");
  if (!isBillablePlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const tier = GLS_PLANS.find((p) => p.id === plan)!;
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || profile?.email || undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await service
      .from("profiles")
      .update({ stripe_customer_id: customerId, email: user.email })
      .eq("id", user.id);
  }

  const priceId = stripePriceIdForPlan(plan);
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "zar",
            unit_amount: (tier.priceZar || 0) * 100,
            recurring: { interval: "month" as const },
            product_data: {
              name: `GLS TV ${tier.name}`,
              description: `${tier.badge} — monthly membership`,
              metadata: { gls_plan: plan },
            },
          },
        },
      ];

  const origin = siteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: lineItems,
    success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=1`,
    allow_promotion_codes: true,
    metadata: {
      gls_plan: plan,
      supabase_user_id: user.id,
    },
    subscription_data: {
      metadata: {
        gls_plan: plan,
        supabase_user_id: user.id,
      },
    },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}

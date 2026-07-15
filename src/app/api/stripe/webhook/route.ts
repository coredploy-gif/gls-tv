import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/eadmin";
import {
  applyPaidPlan,
  periodEndIso,
  resolvePlanFromSubscription,
} from "@/lib/membership/billing-sync";
import { getStripe, planFromStripeMetadata } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe webhook secret is not configured" },
      { status: 503 },
    );
  }
  const raw = await req.text();
  let event: Stripe.Event;

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId =
          session.client_reference_id ||
          session.metadata?.supabase_user_id ||
          null;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!userId || !subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const plan =
          planFromStripeMetadata(session.metadata) ||
          (await resolvePlanFromSubscription(stripe, sub)) ||
          "gls_55";

        await applyPaidPlan({
          userId,
          plan,
          customerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          subscriptionId: subId,
          status: sub.status,
          periodEnd: periodEndIso(sub),
          stripeEventId: event.id,
          eventType: event.type,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.supabase_user_id || null;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        if (!userId) {
          const { data: prof } = await service
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = prof?.id || null;
        }
        if (!userId) break;

        const plan =
          (await resolvePlanFromSubscription(stripe, sub)) || "gls_55";
        await applyPaidPlan({
          userId,
          plan,
          customerId,
          subscriptionId: sub.id,
          status:
            event.type === "customer.subscription.deleted"
              ? "canceled"
              : sub.status,
          periodEnd: periodEndIso(sub),
          stripeEventId: event.id,
          eventType: event.type,
        });
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        const { data: prof } = customerId
          ? await service
              .from("profiles")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle()
          : { data: null };

        await service.from("billing_events").upsert(
          {
            event_type: "invoice.paid",
            stripe_event_id: event.id,
            user_id: prof?.id || null,
            amount_zar_cents: inv.amount_paid || 0,
            currency: inv.currency || "zar",
            payload: {
              invoiceId: inv.id,
              number: inv.number,
              customerEmail: inv.customer_email,
            },
          },
          { onConflict: "stripe_event_id", ignoreDuplicates: true },
        );
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

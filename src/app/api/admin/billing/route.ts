import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { GLS_PLANS, maxViewerSlots, type GlsPlanId } from "@/lib/membership/plans";
import { getStripe, isBillablePlan, siteUrl } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) return null;
  return access.user;
}

function planZarCents(plan: string) {
  const t = GLS_PLANS.find((p) => p.id === plan);
  return (t?.priceZar || 0) * 100;
}

async function findUserIdByEmail(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  email: string,
) {
  const { data: byProfile } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (byProfile?.id) return byProfile.id;

  const { data: listed } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  return (
    listed?.users?.find((u) => (u.email || "").toLowerCase() === email)?.id ||
    null
  );
}

export async function GET(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  if (!service) {
    const { serviceRoleStatus } = await import("@/lib/eadmin");
    const st = serviceRoleStatus();
    return NextResponse.json(
      { error: st.hint || "No service role" },
      { status: 500 },
    );
  }

  const view = req.nextUrl.searchParams.get("view") || "overview";
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const stripe = getStripe();

  if (view === "overview") {
    const { data: profiles } = await service
      .from("profiles")
      .select(
        "id, email, plan, is_premium, trial_ends_at, is_admin_exception, trial_bypassed, stripe_customer_id",
      )
      .limit(2000);

    const rows = profiles || [];
    const byPlan: Record<string, number> = {};
    let paid = 0;
    let trial = 0;
    let exception = 0;
    let mrrZar = 0;
    const now = Date.now();

    for (const p of rows) {
      const plan = String(p.plan || "trial");
      byPlan[plan] = (byPlan[plan] || 0) + 1;
      if (p.is_admin_exception || p.trial_bypassed || plan === "exception") {
        exception += 1;
      } else if (isBillablePlan(plan) && p.is_premium) {
        paid += 1;
        mrrZar += planZarCents(plan) / 100;
      } else if (
        plan === "trial" ||
        (p.trial_ends_at && new Date(p.trial_ends_at).getTime() > now)
      ) {
        trial += 1;
      }
    }

    const { data: subs } = await service
      .from("subscriptions")
      .select("status, plan, current_period_end")
      .limit(2000);

    const subRows = subs || [];
    const pastDue = subRows.filter((s) => s.status === "past_due").length;
    const canceled = subRows.filter((s) => s.status === "canceled").length;
    const activeSubs = subRows.filter((s) =>
      ["active", "trialing", "past_due"].includes(String(s.status)),
    ).length;

    let stripeRevenue30dZar = 0;
    let stripeConfigured = Boolean(stripe);
    let recentInvoices: Array<{
      id: string;
      number: string | null;
      amount: number;
      currency: string;
      status: string | null;
      customerEmail: string | null;
      created: number;
      hostedUrl: string | null;
    }> = [];

    if (stripe) {
      try {
        const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
        const invoices = await stripe.invoices.list({
          limit: 40,
          created: { gte: since },
        });
        for (const inv of invoices.data) {
          if (inv.status === "paid") {
            stripeRevenue30dZar += (inv.amount_paid || 0) / 100;
          }
        }
        recentInvoices = invoices.data.slice(0, 8).map((inv) => ({
          id: inv.id,
          number: inv.number,
          amount: (inv.amount_paid || inv.amount_due || 0) / 100,
          currency: (inv.currency || "zar").toUpperCase(),
          status: inv.status,
          customerEmail: inv.customer_email,
          created: inv.created,
          hostedUrl: inv.hosted_invoice_url || null,
        }));
      } catch {
        stripeConfigured = true;
      }
    }

    const { data: events } = await service
      .from("billing_events")
      .select("id, event_type, amount_zar_cents, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(12);

    return NextResponse.json({
      stripeConfigured,
      stats: {
        accounts: rows.length,
        paid,
        trial,
        exception,
        mrrZar,
        pastDue,
        canceled,
        activeSubs,
        stripeRevenue30dZar,
        byPlan,
      },
      recentInvoices,
      recentEvents: events || [],
      plans: GLS_PLANS.map((p) => ({
        ...p,
        envPriceId:
          p.id === "gls_55"
            ? process.env.STRIPE_PRICE_GLS_55 || null
            : p.id === "gls_65"
              ? process.env.STRIPE_PRICE_GLS_65 || null
              : process.env.STRIPE_PRICE_GLS_75 || null,
      })),
    });
  }

  if (view === "customers") {
    const query = service
      .from("profiles")
      .select(
        "id, email, display_name, plan, is_premium, trial_ends_at, is_admin_exception, trial_bypassed, stripe_customer_id, max_viewer_profiles, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    let customers = data || [];
    if (q) {
      customers = customers.filter(
        (c) =>
          (c.email || "").toLowerCase().includes(q) ||
          (c.display_name || "").toLowerCase().includes(q) ||
          (c.plan || "").toLowerCase().includes(q) ||
          (c.stripe_customer_id || "").toLowerCase().includes(q),
      );
    }

    const { data: subs } = await service
      .from("subscriptions")
      .select("user_id, status, external_id, current_period_end, plan")
      .in(
        "user_id",
        customers.map((c) => c.id),
      );
    const subMap = new Map((subs || []).map((s) => [s.user_id, s]));

    return NextResponse.json({
      customers: customers.map((c) => ({
        ...c,
        subscription: subMap.get(c.id) || null,
      })),
    });
  }

  if (view === "subscriptions") {
    const { data, error } = await service
      .from("subscriptions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const userIds = [...new Set((data || []).map((s) => s.user_id))];
    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, display_name, plan, is_premium")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const pmap = new Map((profiles || []).map((p) => [p.id, p]));

    let rows = (data || []).map((s) => ({
      ...s,
      email: pmap.get(s.user_id)?.email || null,
      display_name: pmap.get(s.user_id)?.display_name || null,
    }));
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.email || "").toLowerCase().includes(q) ||
          (r.plan || "").toLowerCase().includes(q) ||
          (r.status || "").toLowerCase().includes(q) ||
          (r.external_id || "").toLowerCase().includes(q),
      );
    }
    return NextResponse.json({ subscriptions: rows });
  }

  if (view === "invoices") {
    if (!stripe) {
      return NextResponse.json({
        invoices: [],
        error: "Stripe not configured — set STRIPE_SECRET_KEY",
      });
    }
    try {
      const invoices = await stripe.invoices.list({ limit: 50 });
      let list = invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: (inv.amount_paid || inv.amount_due || 0) / 100,
        currency: (inv.currency || "zar").toUpperCase(),
        status: inv.status,
        customerEmail: inv.customer_email,
        customerId:
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id,
        created: inv.created,
        hostedUrl: inv.hosted_invoice_url,
        pdf: inv.invoice_pdf,
      }));
      if (q) {
        list = list.filter(
          (i) =>
            (i.customerEmail || "").toLowerCase().includes(q) ||
            (i.number || "").toLowerCase().includes(q) ||
            (i.id || "").toLowerCase().includes(q) ||
            (i.status || "").toLowerCase().includes(q),
        );
      }
      return NextResponse.json({ invoices: list });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error";
      return NextResponse.json({ error: message, invoices: [] }, { status: 500 });
    }
  }

  if (view === "collections") {
    const nowIso = new Date().toISOString();
    const in7d = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const [{ data: pastDue }, { data: renewing }] = await Promise.all([
      service
        .from("subscriptions")
        .select("*")
        .eq("status", "past_due")
        .order("updated_at", { ascending: false })
        .limit(100),
      service
        .from("subscriptions")
        .select("*")
        .in("status", ["active", "trialing"])
        .gte("current_period_end", nowIso)
        .lte("current_period_end", in7d)
        .order("current_period_end", { ascending: true })
        .limit(100),
    ]);

    const ids = [
      ...new Set([
        ...(pastDue || []).map((s) => s.user_id),
        ...(renewing || []).map((s) => s.user_id),
      ]),
    ];
    const { data: profiles } = ids.length
      ? await service
          .from("profiles")
          .select(
            "id, email, display_name, plan, is_premium, stripe_customer_id",
          )
          .in("id", ids)
      : { data: [] as Array<Record<string, unknown>> };
    const pmap = new Map((profiles || []).map((p) => [p.id as string, p]));

    const enrich = (rows: Array<Record<string, unknown>> | null) =>
      (rows || []).map((s) => {
        const p = pmap.get(String(s.user_id));
        return {
          ...s,
          email: (p?.email as string) || null,
          display_name: (p?.display_name as string) || null,
          stripe_customer_id:
            (s.stripe_customer_id as string) ||
            (p?.stripe_customer_id as string) ||
            null,
        };
      });

    return NextResponse.json({
      pastDue: enrich(pastDue as Array<Record<string, unknown>> | null),
      renewals: enrich(renewing as Array<Record<string, unknown>> | null),
    });
  }

  return NextResponse.json({ error: "Unknown view" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  if (!service) {
    const { serviceRoleStatus } = await import("@/lib/eadmin");
    const st = serviceRoleStatus();
    return NextResponse.json(
      { error: st.hint || "No service role" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");

  if (action === "grant_plan") {
    const email = String(body.email || "").trim().toLowerCase();
    const plan = String(body.plan || "gls_55");
    if (!email)
      return NextResponse.json({ error: "email required" }, { status: 400 });
    if (!isBillablePlan(plan) && plan !== "exception") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const targetId = await findUserIdByEmail(service, email);
    if (!targetId)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    await service
      .from("profiles")
      .update({
        plan,
        is_premium: true,
        trial_bypassed: true,
        is_admin_exception: plan === "exception",
        max_viewer_profiles: maxViewerSlots(plan as GlsPlanId),
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    await service.from("subscriptions").upsert(
      {
        user_id: targetId,
        plan,
        status: "active",
        provider: "admin",
        external_id: `admin-grant-${Date.now()}`,
        current_period_end: null,
        amount_zar_cents: planZarCents(plan),
        currency: "zar",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    await service.from("billing_events").insert({
      event_type: "admin_grant_plan",
      user_id: targetId,
      amount_zar_cents: planZarCents(plan),
      payload: { plan, by: admin.email },
    });

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "billing_grant_plan",
      entityType: "profile",
      entityId: targetId,
      summary: `Granted ${plan} to ${email}`,
      meta: { plan },
    });

    return NextResponse.json({ ok: true, userId: targetId, plan });
  }

  if (action === "revoke_premium") {
    const userId = String(body.userId || "");
    if (!userId)
      return NextResponse.json({ error: "userId required" }, { status: 400 });

    await service
      .from("profiles")
      .update({
        plan: "trial",
        is_premium: false,
        max_viewer_profiles: maxViewerSlots("trial"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await service
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await service.from("billing_events").insert({
      event_type: "admin_revoke_premium",
      user_id: userId,
      payload: { by: admin.email },
    });

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "billing_revoke_premium",
      entityType: "profile",
      entityId: userId,
      summary: "Revoked premium",
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "cancel_stripe") {
    const stripe = getStripe();
    if (!stripe)
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    const subId = String(body.subscriptionId || "");
    if (!subId)
      return NextResponse.json(
        { error: "subscriptionId required" },
        { status: 400 },
      );
    const atPeriodEnd = body.atPeriodEnd !== false;
    let status = "active";
    if (atPeriodEnd) {
      const sub = await stripe.subscriptions.update(subId, {
        cancel_at_period_end: true,
      });
      status = sub.status;
    } else {
      const sub = await stripe.subscriptions.cancel(subId);
      status = "canceled";
      void sub;
    }

    await service
      .from("subscriptions")
      .update({
        status: atPeriodEnd ? status : "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("external_id", subId);

    if (!atPeriodEnd) {
      const { data: row } = await service
        .from("subscriptions")
        .select("user_id")
        .eq("external_id", subId)
        .maybeSingle();
      if (row?.user_id) {
        await service
          .from("profiles")
          .update({
            is_premium: false,
            plan: "trial",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.user_id);
      }
    }

    await service.from("billing_events").insert({
      event_type: "admin_cancel_stripe",
      payload: { subscriptionId: subId, atPeriodEnd, by: admin.email, status },
    });

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "billing_cancel_stripe",
      entityType: "subscription",
      entityId: subId,
      summary: atPeriodEnd
        ? "Cancel at period end"
        : "Canceled immediately",
      meta: { status },
    });
    return NextResponse.json({ ok: true, status });
  }

  if (action === "refund_invoice") {
    const stripe = getStripe();
    if (!stripe)
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    const invoiceId = String(body.invoiceId || "");
    if (!invoiceId)
      return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

    const invoice = await stripe.invoices.retrieve(invoiceId);
    const inv = invoice as unknown as {
      payment_intent?: string | { id: string } | null;
      charge?: string | { id: string } | null;
      customer?: string | { id: string } | null;
      amount_paid?: number;
    };
    const pi =
      typeof inv.payment_intent === "string"
        ? inv.payment_intent
        : inv.payment_intent?.id;
    const charge =
      typeof inv.charge === "string" ? inv.charge : inv.charge?.id;
    if (!pi && !charge) {
      return NextResponse.json(
        { error: "Invoice has no payment_intent/charge to refund" },
        { status: 400 },
      );
    }

    const amount =
      body.amountCents != null ? Number(body.amountCents) : undefined;
    const refund = await stripe.refunds.create({
      ...(pi ? { payment_intent: pi } : { charge: charge! }),
      ...(amount && amount > 0 ? { amount } : {}),
      reason: "requested_by_customer",
      metadata: {
        by: admin.email || "admin",
        invoice_id: invoiceId,
      },
    });

    const customerId =
      typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
    let userId: string | null = null;
    if (customerId) {
      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = profile?.id || null;
    }

    await service.from("billing_events").insert({
      event_type: "admin_refund",
      user_id: userId,
      stripe_event_id: refund.id,
      amount_zar_cents: refund.amount,
      payload: {
        invoiceId,
        refundId: refund.id,
        by: admin.email,
        status: refund.status,
      },
    });

    if (userId) {
      await service.from("user_reminders").insert({
        user_id: userId,
        kind: "admin",
        title: "Refund processed",
        body: `A refund of R${((refund.amount || 0) / 100).toFixed(2)} was issued on your account.`,
        href: "/pricing",
        severity: "info",
        dedupe_key: `refund-${refund.id}`,
        created_by: admin.email,
      });
    }

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "billing_refund",
      entityType: "invoice",
      entityId: invoiceId,
      summary: `Refund R${((refund.amount || 0) / 100).toFixed(2)}`,
      meta: { refundId: refund.id },
    });

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      amount: (refund.amount || 0) / 100,
      status: refund.status,
    });
  }

  if (action === "send_billing_reminder") {
    const userId = String(body.userId || "");
    const kind = String(body.kind || "past_due");
    if (!userId)
      return NextResponse.json({ error: "userId required" }, { status: 400 });

    const title =
      kind === "renewal"
        ? "Renewal reminder"
        : kind === "trial_ending"
          ? "Trial ending soon"
          : kind === "admin"
            ? "Message from GLS TV"
            : "Payment needs attention";
    const reminderBody =
      kind === "renewal"
        ? "Your GLS TV plan renews soon. Manage billing from Pricing anytime."
        : kind === "trial_ending"
          ? "Your free trial is ending — pick a plan to keep watching."
          : kind === "admin"
            ? "You have a new message from GLS TV support. Open Pricing or browse to continue."
            : "Your subscription is past due. Update your payment method to restore premium.";

    const remKind =
      kind === "renewal"
        ? "renewal"
        : kind === "trial_ending"
          ? "trial_ending"
          : kind === "admin"
            ? "admin"
            : "past_due";

    const { data: rem, error } = await service
      .from("user_reminders")
      .insert({
        user_id: userId,
        kind: remKind,
        title,
        body: reminderBody,
        href: "/pricing",
        severity: remKind === "renewal" || remKind === "admin" ? "info" : "urgent",
        dedupe_key: `manual-${remKind}-${new Date().toISOString().slice(0, 10)}-${userId.slice(0, 8)}`,
        created_by: admin.email,
      })
      .select("*")
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "billing_send_reminder",
      entityType: "user_reminder",
      entityId: rem.id,
      summary: `${kind} reminder`,
      meta: { userId },
    });

    return NextResponse.json({ ok: true, reminder: rem });
  }

  if (action === "portal_link") {
    const stripe = getStripe();
    if (!stripe)
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    const customerId = String(body.customerId || "");
    if (!customerId)
      return NextResponse.json({ error: "customerId required" }, { status: 400 });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl()}/admin/finance/customers`,
    });
    return NextResponse.json({ url: session.url });
  }

  if (action === "sync_stripe") {
    const stripe = getStripe();
    if (!stripe)
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    const customerId = String(body.customerId || "");
    const userId = String(body.userId || "");
    if (!customerId || !userId)
      return NextResponse.json(
        { error: "customerId and userId required" },
        { status: 400 },
      );

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });
    const sub = subs.data[0];
    if (!sub) {
      return NextResponse.json({ ok: true, synced: false, reason: "No Stripe subs" });
    }

    const amount = sub.items.data[0]?.price?.unit_amount || 0;
    const planMeta = sub.metadata?.gls_plan;
    const plan: GlsPlanId =
      (planMeta && isBillablePlan(planMeta) && planMeta) ||
      (amount === 4500
        ? "gls_55"
        : amount === 5500
          ? "gls_65"
          : amount === 6500
            ? "gls_75"
            : amount === 7500
              ? "gls_75"
              : "gls_55");

    const active = ["active", "trialing", "past_due"].includes(sub.status);
    const periodEnd = sub.items.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
      : null;

    await service
      .from("profiles")
      .update({
        plan: active ? plan : "trial",
        is_premium: active,
        max_viewer_profiles: maxViewerSlots(plan),
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await service.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        status: sub.status,
        provider: "stripe",
        external_id: sub.id,
        stripe_customer_id: customerId,
        current_period_end: periodEnd,
        amount_zar_cents: amount,
        currency: "zar",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return NextResponse.json({ ok: true, synced: true, plan, status: sub.status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  activateManualPayment,
  getManualPaymentSettings,
  isManualPlan,
  listYocoPaymentLinks,
  manualPlanCents,
  memberReferenceFor,
  paymentReferenceFor,
  type ManualPaymentMethod,
} from "@/lib/manual-billing";
import {
  getAdminAccess,
  hasAdminPermission,
  requireAal2,
} from "@/lib/admin/access";
import {
  fetchArAging,
  fetchDaybook,
  fetchMemberStatement,
  fetchReconcileSummary,
} from "@/lib/finance/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) return null;
  return access.user;
}

function safeMethod(
  value: unknown,
): Exclude<ManualPaymentMethod, "unselected"> {
  const method = String(value || "eft");
  return ["yoco", "payfast", "eft", "cash", "other"].includes(method)
    ? (method as Exclude<ManualPaymentMethod, "unselected">)
    : "eft";
}

async function profilesMap(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  userIds: string[],
) {
  if (!userIds.length) return new Map<string, Record<string, unknown>>();
  const { data } = await service
    .from("profiles")
    .select(
      "id, email, display_name, member_reference, plan, is_premium, trial_ends_at, created_at",
    )
    .in("id", [...new Set(userIds)]);
  return new Map(
    (data || []).map((p) => [p.id, p as Record<string, unknown>]),
  );
}

export async function GET(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 503 });

  const view = req.nextUrl.searchParams.get("view") || "queue";
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const status = req.nextUrl.searchParams.get("status") || "all";
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const member = (req.nextUrl.searchParams.get("member") || "").trim();

  if (view === "daybook") {
    try {
      return NextResponse.json(await fetchDaybook(service, from, to));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Daybook failed" },
        { status: 500 },
      );
    }
  }

  if (view === "ar-aging") {
    try {
      return NextResponse.json(await fetchArAging(service));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "AR aging failed" },
        { status: 500 },
      );
    }
  }

  if (view === "statement") {
    try {
      return NextResponse.json(
        await fetchMemberStatement(service, member || q),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Statement failed";
      return NextResponse.json(
        { error: message },
        { status: message.includes("required") ? 400 : 500 },
      );
    }
  }

  if (view === "reconcile") {
    try {
      return NextResponse.json(await fetchReconcileSummary(service));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Reconcile failed" },
        { status: 500 },
      );
    }
  }

  if (view === "queue" || view === "payments") {
    let query = service
      .from("manual_payment_requests")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const pmap = await profilesMap(
      service,
      (data || []).map((row) => row.user_id),
    );
    let payments = (data || []).map((row) => ({
      ...row,
      email: pmap.get(row.user_id)?.email || null,
      display_name: pmap.get(row.user_id)?.display_name || null,
    }));
    if (q) {
      payments = payments.filter((row) =>
        [
          row.payment_reference,
          row.member_reference,
          row.email,
          row.display_name,
          row.external_transaction_id,
          row.proof_reference,
          row.plan,
          row.status,
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      );
    }
    return NextResponse.json({ payments });
  }

  if (view === "members") {
    const { data: profiles, error } = await service
      .from("profiles")
      .select(
        "id, email, display_name, member_reference, plan, is_premium, trial_ends_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = (profiles || []).map((p) => p.id);
    const [{ data: subs }, { data: receipts }, { data: pending }] =
      await Promise.all([
        ids.length
          ? service
              .from("subscriptions")
              .select(
                "user_id, status, current_period_end, provider, plan, debit_day, next_billing_at, debit_status, dunning_paused_at",
              )
              .in("user_id", ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? service
              .from("payment_receipts")
              .select("user_id, amount_zar_cents, issued_at, refunded_at")
              .in("user_id", ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? service
              .from("manual_payment_requests")
              .select("user_id, status")
              .in("user_id", ids)
              .in("status", ["pending", "proof_submitted", "verifying"])
          : Promise.resolve({ data: [] }),
      ]);
    const smap = new Map((subs || []).map((s) => [s.user_id, s]));
    const totals = new Map<string, { total: number; payments: number }>();
    for (const receipt of receipts || []) {
      if (receipt.refunded_at) continue;
      const current = totals.get(receipt.user_id) || { total: 0, payments: 0 };
      current.total += receipt.amount_zar_cents || 0;
      current.payments += 1;
      totals.set(receipt.user_id, current);
    }
    const pendingCount = new Map<string, number>();
    for (const row of pending || []) {
      pendingCount.set(row.user_id, (pendingCount.get(row.user_id) || 0) + 1);
    }
    let members = (profiles || []).map((profile) => ({
      ...profile,
      member_reference:
        profile.member_reference || memberReferenceFor(profile.id),
      subscription: smap.get(profile.id) || null,
      total_paid_zar_cents: totals.get(profile.id)?.total || 0,
      payment_count: totals.get(profile.id)?.payments || 0,
      pending_count: pendingCount.get(profile.id) || 0,
    }));
    if (q) {
      members = members.filter((member) =>
        [
          member.email,
          member.display_name,
          member.member_reference,
          member.plan,
          member.subscription?.provider,
          member.subscription?.status,
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      );
    }
    return NextResponse.json({ members });
  }

  if (view === "receipts") {
    const { data, error } = await service
      .from("payment_receipts")
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(500);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    let receipts = data || [];
    if (q) {
      receipts = receipts.filter((receipt) =>
        [
          receipt.receipt_number,
          receipt.payment_reference,
          receipt.member_reference,
          receipt.customer_email,
          receipt.customer_name,
          receipt.external_transaction_id,
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      );
    }
    return NextResponse.json({ receipts });
  }

  if (view === "reports") {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const [{ data: receipts }, { data: requests }, { data: profiles }] =
      await Promise.all([
        service
          .from("payment_receipts")
          .select("*")
          .gte("issued_at", since.toISOString())
          .order("issued_at", { ascending: true })
          .limit(5000),
        service
          .from("manual_payment_requests")
          .select("status, payment_method, created_at")
          .gte("created_at", since.toISOString())
          .limit(5000),
        service
          .from("profiles")
          .select("id, is_premium, plan, created_at")
          .limit(5000),
      ]);

    const valid = (receipts || []).filter((r) => !r.refunded_at);
    const totalCents = valid.reduce(
      (sum, receipt) => sum + (receipt.amount_zar_cents || 0),
      0,
    );
    const now = new Date();
    const start30 = now.getTime() - 30 * 86_400_000;
    const revenue30dCents = valid
      .filter((r) => new Date(r.issued_at).getTime() >= start30)
      .reduce((sum, r) => sum + (r.amount_zar_cents || 0), 0);

    const byPlan: Record<string, { count: number; cents: number }> = {};
    const byMethod: Record<string, { count: number; cents: number }> = {};
    const monthly: Record<string, { count: number; cents: number }> = {};
    const uniqueMembers = new Set<string>();
    const receiptsByMember = new Map<string, number>();
    for (const receipt of valid) {
      uniqueMembers.add(receipt.user_id);
      receiptsByMember.set(
        receipt.user_id,
        (receiptsByMember.get(receipt.user_id) || 0) + 1,
      );
      const plan = receipt.plan || "unknown";
      const method = receipt.payment_method || "unknown";
      const month = String(receipt.issued_at).slice(0, 7);
      byPlan[plan] ||= { count: 0, cents: 0 };
      byMethod[method] ||= { count: 0, cents: 0 };
      monthly[month] ||= { count: 0, cents: 0 };
      byPlan[plan].count += 1;
      byPlan[plan].cents += receipt.amount_zar_cents || 0;
      byMethod[method].count += 1;
      byMethod[method].cents += receipt.amount_zar_cents || 0;
      monthly[month].count += 1;
      monthly[month].cents += receipt.amount_zar_cents || 0;
    }

    const statusCounts: Record<string, number> = {};
    for (const request of requests || []) {
      statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
    }
    const activeMembers = (profiles || []).filter(
      (profile) => profile.is_premium,
    ).length;
    const renewals = Math.max(0, valid.length - uniqueMembers.size);
    const renewedMembers = [...receiptsByMember.values()].filter(
      (count) => count >= 2,
    ).length;
    const renewalRate =
      uniqueMembers.size > 0
        ? Math.min(100, Math.round((renewedMembers / uniqueMembers.size) * 100))
        : 0;

    return NextResponse.json({
      summary: {
        totalRevenueZarCents: totalCents,
        revenue30dZarCents: revenue30dCents,
        receiptCount: valid.length,
        uniquePayingMembers: uniqueMembers.size,
        activeMembers,
        renewals,
        renewalRate,
        pending:
          (statusCounts.pending || 0) +
          (statusCounts.proof_submitted || 0) +
          (statusCounts.verifying || 0),
        rejected: statusCounts.rejected || 0,
        refunded: (receipts || []).filter((r) => r.refunded_at).length,
      },
      byPlan,
      byMethod,
      monthly: Object.entries(monthly).map(([month, value]) => ({
        month,
        ...value,
      })),
      statusCounts,
      receipts: valid.slice(-100).reverse(),
    });
  }

  if (view === "settings") {
    return NextResponse.json({
      settings: await getManualPaymentSettings(service),
      yocoConfigured: Boolean(process.env.YOCO_SECRET_KEY?.trim()),
      payfastConfigured: Boolean(
        process.env.PAYFAST_MERCHANT_ID?.trim() &&
          process.env.PAYFAST_MERCHANT_KEY?.trim(),
      ),
      payfastSandbox:
        (process.env.PAYFAST_SANDBOX || "true").trim().toLowerCase() !==
          "false" &&
        (process.env.PAYFAST_SANDBOX || "true").trim() !== "0",
    });
  }

  return NextResponse.json({ error: "Unknown view" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");
  if (["approve", "refund"].includes(action)) {
    const access = await getAdminAccess(admin);
    if (!access || !hasAdminPermission(access, "finance.write") || !requireAal2(access)) {
      return NextResponse.json(
        { error: "Payment activation and refunds require finance permission and verified MFA (AAL2)." },
        { status: 403 },
      );
    }
  }

  if (action === "approve") {
    const paymentId = String(body.paymentId || "");
    const transactionId = String(body.transactionId || "").trim() || null;
    const method = safeMethod(body.paymentMethod);
    if (!paymentId)
      return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    if ((method === "eft" || method === "yoco" || method === "payfast") && !transactionId) {
      return NextResponse.json(
        { error: "Bank/Yoco/PayFast transaction ID required before approval" },
        { status: 400 },
      );
    }

    const result = await activateManualPayment({
      service,
      paymentId,
      adminEmail: admin.email || "admin",
      externalTransactionId: transactionId,
      paymentMethod: method,
      adminNote:
        body.adminNote != null ? String(body.adminNote).slice(0, 1000) : null,
      paidAt: body.paidAt != null ? String(body.paidAt) : null,
    });
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "manual_payment_approve",
      entityType: "payment",
      entityId: paymentId,
      summary: `Approved ${result.payment.payment_reference}`,
      meta: {
        receiptNumber: result.receipt.receipt_number,
        transactionId,
      },
    });
    return NextResponse.json(result);
  }

  if (action === "sync_yoco") {
    const paymentId = String(body.paymentId || "");
    const { data: payment } = await service
      .from("manual_payment_requests")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment?.yoco_link_id) {
      return NextResponse.json(
        { error: "This request has no Yoco payment link" },
        { status: 400 },
      );
    }
    try {
      const links = await listYocoPaymentLinks();
      const link = links.find(
        (item) =>
          item.id === payment.yoco_link_id ||
          item.order_id === payment.id ||
          item.customer_reference === payment.payment_reference,
      );
      if (!link) {
        return NextResponse.json(
          { error: "Yoco link was not found in the latest 100 payments" },
          { status: 404 },
        );
      }
      await service
        .from("manual_payment_requests")
        .update({
          yoco_status: link.status,
          status: link.status === "paid" ? "verifying" : payment.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
      if (link.status !== "paid") {
        return NextResponse.json({
          ok: true,
          paid: false,
          yocoStatus: link.status,
        });
      }
      const result = await activateManualPayment({
        service,
        paymentId,
        adminEmail: admin.email || "admin",
        externalTransactionId: `yoco:${link.id}`,
        paymentMethod: "yoco",
        adminNote: "Confirmed from Yoco payment-link status",
        paidAt: link.updated_at || null,
      });
      if (!result.ok)
        return NextResponse.json({ error: result.error }, { status: 500 });
      await writeAuditLog(service, {
        actorEmail: admin.email,
        actorUserId: admin.id,
        action: "yoco_payment_sync",
        entityType: "payment",
        entityId: paymentId,
        summary: `Yoco confirmed ${payment.payment_reference}`,
        meta: { yocoLinkId: link.id },
      });
      return NextResponse.json({ ...result, yocoStatus: link.status });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Could not query Yoco",
        },
        { status: 502 },
      );
    }
  }

  if (action === "sync_payfast") {
    const paymentId = String(body.paymentId || "").trim();
    let stuckQuery = service
      .from("manual_payment_requests")
      .select(
        "id, payment_reference, pf_payment_id, payfast_status, status, user_id",
      )
      .eq("payment_method", "payfast")
      .in("status", ["pending", "proof_submitted", "verifying"])
      .ilike("payfast_status", "complete");
    if (paymentId) stuckQuery = stuckQuery.eq("id", paymentId);
    const { data: stuck, error: stuckError } = await stuckQuery.limit(50);
    if (stuckError) {
      return NextResponse.json({ error: stuckError.message }, { status: 500 });
    }
    if (!stuck?.length) {
      return NextResponse.json({
        ok: true,
        activated: 0,
        message:
          "No PayFast rows with COMPLETE ITN waiting for activation. If a member paid, wait for ITN or approve with the PayFast transaction ID.",
      });
    }
    let activated = 0;
    const errors: string[] = [];
    for (const row of stuck) {
      const pfId = row.pf_payment_id || row.payment_reference;
      const result = await activateManualPayment({
        service,
        paymentId: row.id,
        adminEmail: admin.email || "admin",
        externalTransactionId: `payfast:${pfId}`,
        paymentMethod: "payfast",
        adminNote: "Confirmed from PayFast COMPLETE status (admin sync)",
      });
      if (result.ok) activated += 1;
      else if (!String(result.error || "").includes("already")) {
        errors.push(`${row.payment_reference}: ${result.error}`);
      } else {
        activated += 1;
      }
    }
    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "payfast_payment_sync",
      entityType: "payment",
      entityId: paymentId || "batch",
      summary: `PayFast sync activated ${activated}/${stuck.length}`,
      meta: { activated, errors },
    });
    return NextResponse.json({
      ok: true,
      activated,
      scanned: stuck.length,
      errors,
    });
  }

  if (action === "set_status") {
    const paymentId = String(body.paymentId || "");
    const status = String(body.status || "");
    if (!["verifying", "rejected", "canceled", "expired"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const note = String(body.adminNote || "").trim().slice(0, 1000);
    const { data: payment, error } = await service
      .from("manual_payment_requests")
      .update({
        status,
        admin_note: note || null,
        verified_by: admin.email,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .neq("status", "paid")
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await Promise.all([
      service.from("manual_payment_events").insert({
        payment_request_id: paymentId,
        user_id: payment.user_id,
        event_type: `payment_${status}`,
        actor_email: admin.email,
        note: note || null,
      }),
      status === "rejected"
        ? service.from("user_reminders").insert({
            user_id: payment.user_id,
            kind: "payment_failed",
            title: "Payment needs attention",
            body:
              note ||
              `We could not match ${payment.payment_reference}. Check your reference or contact support.`,
            href: `/pricing/pay/${paymentId}`,
            severity: "urgent",
            dedupe_key: `payment-rejected-${paymentId}`,
            created_by: admin.email,
          })
        : Promise.resolve(),
      writeAuditLog(service, {
        actorEmail: admin.email,
        actorUserId: admin.id,
        action: `manual_payment_${status}`,
        entityType: "payment",
        entityId: paymentId,
        summary: `${status} ${payment.payment_reference}`,
      }),
    ]);
    return NextResponse.json({ ok: true, payment });
  }

  if (action === "record_payment") {
    const identity = String(body.identity || "").trim().toLowerCase();
    const plan = String(body.plan || "");
    if (!identity || !isManualPlan(plan)) {
      return NextResponse.json(
        { error: "Member email/reference and valid plan required" },
        { status: 400 },
      );
    }
    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, display_name, member_reference")
      .limit(2000);
    const profile = (profiles || []).find(
      (p) =>
        String(p.email || "").toLowerCase() === identity ||
        String(p.member_reference || "").toLowerCase() === identity ||
        String(p.id).toLowerCase() === identity,
    );
    if (!profile)
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const memberReference =
      profile.member_reference || memberReferenceFor(profile.id);
    if (!profile.member_reference) {
      await service
        .from("profiles")
        .update({ member_reference: memberReference })
        .eq("id", profile.id);
    }
    const transactionId = String(body.transactionId || "").trim() || null;
    const recordedMethod = safeMethod(body.paymentMethod);
    if (
      (recordedMethod === "eft" ||
        recordedMethod === "yoco" ||
        recordedMethod === "payfast") &&
      !transactionId
    ) {
      return NextResponse.json(
        { error: "Bank/Yoco transaction ID required" },
        { status: 400 },
      );
    }
    const { data: payment, error } = await service
      .from("manual_payment_requests")
      .insert({
        user_id: profile.id,
        member_reference: memberReference,
        payment_reference: paymentReferenceFor(memberReference),
        plan,
        amount_zar_cents: manualPlanCents(plan),
        payment_method: recordedMethod,
        status: "verifying",
        external_transaction_id: transactionId,
        proof_reference: transactionId,
        submitted_at: new Date().toISOString(),
        member_note: "Recorded from bank/Yoco reconciliation",
        admin_note:
          body.adminNote != null ? String(body.adminNote).slice(0, 1000) : null,
      })
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const result = await activateManualPayment({
      service,
      paymentId: payment.id,
      adminEmail: admin.email || "admin",
      externalTransactionId: transactionId,
      paymentMethod: recordedMethod,
      adminNote: "Recorded from reconciliation",
      paidAt: body.paidAt != null ? String(body.paidAt) : null,
    });
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "manual_payment_record",
      entityType: "payment",
      entityId: payment.id,
      summary: `Recorded ${payment.payment_reference} for ${profile.email}`,
      meta: { transactionId, plan },
    });
    return NextResponse.json(result);
  }

  if (action === "refund") {
    const receiptId = String(body.receiptId || "");
    const note = String(body.note || "").trim().slice(0, 1000);
    const refundReference = String(body.refundReference || "").trim().slice(0, 200);
    const refundMethod = String(body.refundMethod || "").trim().toLowerCase();
    if (
      body.confirmExternalRefund !== true ||
      !refundReference ||
      !["yoco", "eft"].includes(refundMethod)
    ) {
      return NextResponse.json(
        {
          error:
            "Confirm the external Yoco/EFT refund and provide its reference before recording it.",
        },
        { status: 400 },
      );
    }
    const { data: receipt } = await service
      .from("payment_receipts")
      .select("*")
      .eq("id", receiptId)
      .maybeSingle();
    if (!receipt)
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    if (receipt.refunded_at)
      return NextResponse.json({ error: "Already refunded" }, { status: 409 });
    const now = new Date().toISOString();
    await Promise.all([
      service
        .from("payment_receipts")
        .update({
          refunded_at: now,
          refund_note: note || null,
          meta: {
            ...(receipt.meta || {}),
            externalRefundCompleted: true,
            refundMethod,
            refundReference,
          },
        })
        .eq("id", receiptId),
      service
        .from("manual_payment_requests")
        .update({ status: "refunded", updated_at: now })
        .eq("id", receipt.payment_request_id),
      service.from("billing_events").insert({
        event_type: "manual_payment_refunded",
        user_id: receipt.user_id,
        amount_zar_cents: receipt.amount_zar_cents,
        payload: {
          receiptId,
          receiptNumber: receipt.receipt_number,
          by: admin.email,
          note,
          refundMethod,
          refundReference,
        },
      }),
      service.from("user_reminders").insert({
        user_id: receipt.user_id,
        kind: "admin",
        title: "Payment marked refunded",
        body:
          note ||
          `The externally completed ${refundMethod.toUpperCase()} refund for receipt ${receipt.receipt_number} has been recorded.`,
        href: `/receipts/${receiptId}`,
        severity: "info",
        dedupe_key: `receipt-refund-${receiptId}`,
        created_by: admin.email,
      }),
      writeAuditLog(service, {
        actorEmail: admin.email,
        actorUserId: admin.id,
        action: "manual_payment_refund",
        entityType: "receipt",
        entityId: receiptId,
        summary: `Refunded ${receipt.receipt_number}`,
        meta: { note, refundMethod, refundReference },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "update_settings") {
    const allowed = [
      "trading_name",
      "support_email",
      "yoco_enabled",
      "payfast_enabled",
      "eft_enabled",
      "bank_name",
      "account_holder",
      "account_number",
      "branch_code",
      "account_type",
      "payment_note",
      "receipt_footer",
    ] as const;
    const patch: Record<string, unknown> = {
      updated_by: admin.email,
      updated_at: new Date().toISOString(),
    };
    for (const key of allowed) {
      if (body[key] == null) continue;
      patch[key] =
        key === "yoco_enabled" ||
        key === "payfast_enabled" ||
        key === "eft_enabled"
          ? Boolean(body[key])
          : String(body[key]).trim().slice(0, key.includes("note") ? 1500 : 250) ||
            null;
    }
    const { data, error } = await service
      .from("manual_payment_settings")
      .upsert({ id: "default", ...patch }, { onConflict: "id" })
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: admin.email,
      actorUserId: admin.id,
      action: "manual_billing_settings_update",
      entityType: "settings",
      entityId: "default",
      summary: "Updated payment settings",
      meta: { fields: Object.keys(patch).filter((key) => key !== "updated_by") },
    });
    return NextResponse.json({ ok: true, settings: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

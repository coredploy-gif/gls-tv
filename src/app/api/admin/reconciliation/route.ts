import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { listYocoPaymentLinks, yocoConfigured } from "@/lib/manual-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertFinance() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) return null;
  return access;
}

/** Compare GLS paid receipts/requests against recent Yoco payment links. */
export async function GET() {
  const access = await assertFinance();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: paid } = await service
    .from("manual_payment_requests")
    .select(
      "id, payment_reference, member_reference, amount_zar_cents, status, payment_method, yoco_link_id, external_transaction_id, updated_at, paid_at",
    )
    .eq("status", "paid")
    .order("updated_at", { ascending: false })
    .limit(100);

  let yocoLinks: Awaited<ReturnType<typeof listYocoPaymentLinks>> = [];
  let yocoError: string | null = null;
  if (yocoConfigured()) {
    try {
      yocoLinks = await listYocoPaymentLinks();
    } catch (cause) {
      yocoError = cause instanceof Error ? cause.message : "Yoco list failed";
    }
  }

  const rows = (paid || []).map((payment) => {
    const link = yocoLinks.find(
      (item) =>
        item.id === payment.yoco_link_id ||
        item.order_id === payment.id ||
        item.customer_reference === payment.payment_reference,
    );
    let match: "matched" | "yoco_unpaid" | "missing_in_yoco" | "eft_or_manual" =
      "eft_or_manual";
    if (payment.payment_method === "yoco") {
      if (!link) match = "missing_in_yoco";
      else if (link.status === "paid") match = "matched";
      else match = "yoco_unpaid";
    }
    return {
      ...payment,
      yoco_status: link?.status || null,
      yoco_url: link?.url || null,
      match,
    };
  });

  const summary = {
    paidCount: rows.length,
    matched: rows.filter((r) => r.match === "matched").length,
    missingInYoco: rows.filter((r) => r.match === "missing_in_yoco").length,
    yocoUnpaid: rows.filter((r) => r.match === "yoco_unpaid").length,
    eftOrManual: rows.filter((r) => r.match === "eft_or_manual").length,
    yocoConfigured: yocoConfigured(),
    yocoError,
  };

  return NextResponse.json({ generatedAt: new Date().toISOString(), summary, rows });
}

export async function POST(req: NextRequest) {
  const access = await assertFinance();
  if (!access || !hasAdminPermission(access, "finance.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    note?: string;
  };
  if (body.action !== "record_run") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Rebuild a lightweight summary for the audit/snapshot
  const snapshotRes = await GET();
  if (!snapshotRes.ok) {
    return NextResponse.json({ error: "Could not build snapshot" }, { status: 500 });
  }
  const json = (await snapshotRes.json()) as {
    summary: Record<string, unknown>;
  };

  await writeAuditLog(service, {
    actorEmail: access.user.email,
    actorUserId: access.user.id,
    action: "reconciliation.snapshot",
    entityType: "reconciliation",
    entityId: "manual",
    summary: body.note || "Reconciliation snapshot",
    meta: json.summary,
  });

  const { error } = await service.from("reconciliation_runs").insert({
    created_by: access.user.id,
    source: "manual_ops",
    status: "completed",
    period_start: new Date(Date.now() - 30 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    stable_total_cents: Number(json.summary.matched || 0),
  });

  return NextResponse.json({
    ok: true,
    stored: !error,
    warning: error?.message || null,
    summary: json.summary,
  });
}

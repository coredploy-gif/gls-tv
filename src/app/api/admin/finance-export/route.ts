import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/eadmin";
import { csvRow } from "@/lib/finance/csv";
import { writeAuditLog } from "@/lib/admin/audit";

export async function GET(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Finance service unavailable" }, { status: 503 });
  const params = req.nextUrl.searchParams;
  const type = params.get("type") === "payments" ? "payments" : "receipts";
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(1000, Math.max(1, Number(params.get("pageSize") || 250)));
  const from = params.get("from");
  const to = params.get("to");
  const status = params.get("status");
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  if (type === "payments") {
    let query = service
      .from("manual_payment_requests")
      .select("id, member_reference, plan, amount_zar_cents, currency, payment_method, status, created_at, paid_at", { count: "exact" })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
    if (to) query = query.lt("created_at", `${to}T23:59:59.999Z`);
    if (status && status !== "all") query = query.eq("status", status);
    const { data, count, error } = await query.range(rangeStart, rangeEnd);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    const totalCents = (data || []).reduce((sum, row) => sum + row.amount_zar_cents, 0);
    const csv = [
      csvRow(["id", "member_reference", "plan", "amount_zar_cents", "currency", "payment_method", "status", "created_at", "paid_at"]),
      ...(data || []).map((row) => csvRow([row.id, row.member_reference, row.plan, row.amount_zar_cents, row.currency, row.payment_method, row.status, row.created_at, row.paid_at])),
    ].join("\r\n");
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "finance.export",
      entityType: "manual_payment_requests",
      summary: `Exported ${data?.length || 0} payment rows`,
      meta: { type, page, pageSize, from, to, status, rowCount: data?.length || 0 },
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gls-payments-${from || "all"}-${to || "all"}-p${page}.csv"`,
        "X-Total-Count": String(count || 0),
        "X-Page-Amount-Cents": String(totalCents),
        "Cache-Control": "no-store",
      },
    });
  }

  let query = service
    .from("payment_receipts")
    .select("id, receipt_number, member_reference, plan, amount_zar_cents, currency, payment_method, membership_starts_at, membership_ends_at, paid_at, issued_at, refunded_at", { count: "exact" })
    .order("issued_at", { ascending: true })
    .order("id", { ascending: true });
  if (from) query = query.gte("issued_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lt("issued_at", `${to}T23:59:59.999Z`);
  if (status === "refunded") query = query.not("refunded_at", "is", null);
  if (status === "paid") query = query.is("refunded_at", null);
  const { data, count, error } = await query.range(rangeStart, rangeEnd);
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
  const totalCents = (data || []).reduce((sum, row) => sum + row.amount_zar_cents, 0);
  const csv = [
    csvRow(["id", "receipt_number", "member_reference", "plan", "amount_zar_cents", "currency", "payment_method", "membership_starts_at", "membership_ends_at", "paid_at", "issued_at", "refunded_at"]),
    ...(data || []).map((row) => csvRow([row.id, row.receipt_number, row.member_reference, row.plan, row.amount_zar_cents, row.currency, row.payment_method, row.membership_starts_at, row.membership_ends_at, row.paid_at, row.issued_at, row.refunded_at])),
  ].join("\r\n");
  await writeAuditLog(service, {
    actorEmail: access.user.email,
    actorUserId: access.user.id,
    action: "finance.export",
    entityType: "payment_receipts",
    summary: `Exported ${data?.length || 0} receipt rows`,
    meta: { type, page, pageSize, from, to, status, rowCount: data?.length || 0 },
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gls-receipts-${from || "all"}-${to || "all"}-p${page}.csv"`,
      "X-Total-Count": String(count || 0),
      "X-Page-Amount-Cents": String(totalCents),
      "Cache-Control": "no-store",
    },
  });
}

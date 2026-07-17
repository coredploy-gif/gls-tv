import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/eadmin";
import { csvRow } from "@/lib/finance/csv";
import {
  BOOKKEEPER_CSV_HEADERS,
  bookkeeperCsvRow,
  splitOutstandingAmount,
} from "@/lib/finance/ledger";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  filterMembersByBucket,
  loadMembershipOverview,
} from "@/lib/membership/admin-metrics-query";
import {
  MEMBERSHIP_METRIC_DEFINITIONS,
  type MembershipBucket,
} from "@/lib/membership/admin-metrics";

export async function GET(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Finance service unavailable" }, { status: 503 });
  const params = req.nextUrl.searchParams;
  const type = params.get("type") || "receipts";
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(1000, Math.max(1, Number(params.get("pageSize") || 250)));
  const from = params.get("from");
  const to = params.get("to");
  const status = params.get("status");
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  if (type === "bookkeeper") {
    let query = service
      .from("payment_receipts")
      .select(
        "receipt_number, member_reference, payment_reference, plan, amount_zar_cents, paid_at, issued_at, payment_request_id",
        { count: "exact" },
      )
      .is("refunded_at", null)
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true });
    if (from) query = query.gte("paid_at", `${from}T00:00:00.000Z`);
    if (to) query = query.lt("paid_at", `${to}T23:59:59.999Z`);
    const { data: receipts, count, error } = await query.range(rangeStart, rangeEnd);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });

    const paymentIds = [...new Set((receipts || []).map((r) => r.payment_request_id).filter(Boolean))];
    const { data: payments } = paymentIds.length
      ? await service
          .from("manual_payment_requests")
          .select("id, pf_payment_id, billing_kind, dunning_fee_cents, amount_zar_cents")
          .in("id", paymentIds)
      : { data: [] };
    const paymentMap = new Map((payments || []).map((p) => [p.id, p]));

    const rows = (receipts || []).map((receipt) => {
      const payment = paymentMap.get(receipt.payment_request_id);
      const feeCents =
        payment?.dunning_fee_cents ??
        (payment?.billing_kind === "outstanding"
          ? splitOutstandingAmount(
              payment.amount_zar_cents || receipt.amount_zar_cents,
              payment.dunning_fee_cents,
            ).feeCents
          : 0);
      return bookkeeperCsvRow({
        paidAt: receipt.paid_at || receipt.issued_at,
        paymentReference: receipt.payment_reference,
        memberReference: receipt.member_reference,
        plan: receipt.plan,
        amountZarCents: receipt.amount_zar_cents,
        feeCents,
        pfPaymentId: payment?.pf_payment_id || null,
        billingKind: payment?.billing_kind || "once",
        receiptNumber: receipt.receipt_number,
      });
    });

    const csv = [csvRow([...BOOKKEEPER_CSV_HEADERS]), ...rows.map((row) => csvRow(row))].join("\r\n");
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "finance.export",
      entityType: "bookkeeper",
      summary: `Exported ${rows.length} bookkeeper rows`,
      meta: { type, page, pageSize, from, to, rowCount: rows.length },
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gls-bookkeeper-${from || "all"}-${to || "all"}-p${page}.csv"`,
        "X-Total-Count": String(count || 0),
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "membership") {
    const bucket = (params.get("bucket") || "overview") as
      | MembershipBucket
      | "overview";
    try {
      const overview = await loadMembershipOverview();
      const stamp = new Date().toISOString().slice(0, 10);

      if (bucket === "overview") {
        const { summary } = overview;
        const conversion =
          summary.allUsers > 0
            ? Math.round((summary.subscribed / summary.allUsers) * 100)
            : 0;
        const rows = [
          csvRow(["metric", "value", "definition"]),
          csvRow(["all_users", summary.allUsers, MEMBERSHIP_METRIC_DEFINITIONS.allUsers]),
          csvRow([
            "subscribed",
            summary.subscribed,
            MEMBERSHIP_METRIC_DEFINITIONS.subscribed,
          ]),
          csvRow(["trial", summary.trial, MEMBERSHIP_METRIC_DEFINITIONS.trial]),
          csvRow([
            "never_subscribed",
            summary.neverSubscribed,
            MEMBERSHIP_METRIC_DEFINITIONS.neverSubscribed,
          ]),
          csvRow(["lapsed", summary.lapsed, MEMBERSHIP_METRIC_DEFINITIONS.lapsed]),
          csvRow(["signups_30d", summary.signups30d, "Profiles created in the last 30 days"]),
          csvRow(["paid_conversion_pct", conversion, "Subscribed divided by all users"]),
          csvRow([]),
          csvRow(["plan", "users"]),
          ...Object.entries(overview.byPlan)
            .sort((a, b) => b[1] - a[1])
            .map(([plan, count]) => csvRow([plan, count])),
        ];
        const csv = rows.join("\r\n");
        await writeAuditLog(service, {
          actorEmail: access.user.email,
          actorUserId: access.user.id,
          action: "finance.export",
          entityType: "membership_overview",
          summary: "Exported membership funnel overview CSV",
          meta: { type, bucket },
        });
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="gls-membership-overview-${stamp}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const members = filterMembersByBucket(overview.members, bucket);
      const csv = [
        csvRow([
          "member_reference",
          "email",
          "display_name",
          "plan",
          "is_premium",
          "subscription_status",
          "current_period_end",
          "trial_ends_at",
          "payment_count",
          "bucket",
          "created_at",
        ]),
        ...members.map((member) =>
          csvRow([
            member.member_reference,
            member.email || "",
            member.display_name || "",
            member.plan,
            member.is_premium,
            member.subscription?.status || "",
            member.subscription?.current_period_end || "",
            member.trial_ends_at || "",
            member.payment_count,
            member.bucket,
            member.created_at || "",
          ]),
        ),
      ].join("\r\n");
      await writeAuditLog(service, {
        actorEmail: access.user.email,
        actorUserId: access.user.id,
        action: "finance.export",
        entityType: "membership_members",
        summary: `Exported ${members.length} membership rows (${bucket})`,
        meta: { type, bucket, rowCount: members.length },
      });
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gls-membership-${bucket}-${stamp}.csv"`,
          "X-Total-Count": String(members.length),
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json({ error: "Membership export failed" }, { status: 500 });
    }
  }

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

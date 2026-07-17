import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/eadmin";
import {
  filterMembersByBucket,
  loadMembershipOverview,
} from "@/lib/membership/admin-metrics-query";
import type { MembershipBucket } from "@/lib/membership/admin-metrics";
import { MEMBERSHIP_METRIC_DEFINITIONS } from "@/lib/membership/admin-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKETS = new Set<MembershipBucket>([
  "all",
  "subscribed",
  "trial",
  "never_subscribed",
  "lapsed",
]);

export async function GET(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 503 });
  }

  try {
    const bucketParam = (req.nextUrl.searchParams.get("bucket") ||
      "all") as MembershipBucket;
    const bucket = BUCKETS.has(bucketParam) ? bucketParam : "all";
    const limit = Math.min(
      500,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50)),
    );

    const overview = await loadMembershipOverview();
    const filtered = filterMembersByBucket(overview.members, bucket);

    return NextResponse.json({
      generatedAt: overview.generatedAt,
      definitions: MEMBERSHIP_METRIC_DEFINITIONS,
      summary: overview.summary,
      byPlan: overview.byPlan,
      bucket,
      members: filtered.slice(0, limit).map((member) => ({
        id: member.id,
        email: member.email,
        display_name: member.display_name,
        member_reference: member.member_reference,
        plan: member.plan,
        is_premium: member.is_premium,
        trial_ends_at: member.trial_ends_at,
        trial_started_at: member.trial_started_at,
        created_at: member.created_at,
        payment_count: member.payment_count,
        bucket: member.bucket,
        subscription: member.subscription
          ? {
              status: member.subscription.status,
              current_period_end: member.subscription.current_period_end,
              provider: member.subscription.provider || null,
              plan: member.subscription.plan || null,
            }
          : null,
      })),
      memberTotal: filtered.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Overview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "audit_view") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  await writeAuditLog(service, {
    actorEmail: access.user.email,
    actorUserId: access.user.id,
    action: "membership.overview_view",
    entityType: "membership_overview",
    summary: "Opened membership funnel overview",
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess, hasAdminPermission, requireAal2 } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";

export async function GET(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "catalog.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Admin service unavailable" }, { status: 503 });
  const status = req.nextUrl.searchParams.get("status");
  let query = service.from("content_rights").select("*").order("updated_at", { ascending: false }).limit(250);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  return error
    ? NextResponse.json({ error: "Rights records could not be loaded" }, { status: 500 })
    : NextResponse.json({ rights: data || [] });
}

export async function POST(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "catalog.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Admin service unavailable" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const status = String(body.status || "pending");
  if (status === "approved" && (!hasAdminPermission(access, "catalog.publish") || !requireAal2(access))) {
    return NextResponse.json({ error: "Approval requires catalog publish permission and verified MFA (AAL2)" }, { status: 403 });
  }
  const rightsHolder = String(body.rightsHolder || "").trim();
  const evidenceReference = String(body.evidenceReference || "").trim();
  const sourceName = String(body.sourceName || "").trim();
  if (!sourceName || (status === "approved" && (!rightsHolder || !evidenceReference))) {
    return NextResponse.json({ error: "Source is required; approval also requires rights holder and evidence" }, { status: 400 });
  }
  const row = {
    id: body.id || undefined,
    channel_id: body.channelId || null,
    stream_seed_slug: body.streamSeedSlug || null,
    rights_holder: rightsHolder || null,
    source_name: sourceName,
    evidence_reference: evidenceReference || null,
    territories: Array.isArray(body.territories) ? body.territories.map(String).slice(0, 100) : [],
    commercial_use: body.commercialUse === true,
    redistribution: body.redistribution === true,
    proxy_permission: body.proxyPermission === true,
    starts_at: body.startsAt || null,
    expires_at: body.expiresAt || null,
    review_at: body.reviewAt || null,
    status,
    approved_by: status === "approved" ? access.user.id : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    takedown_reference: body.takedownReference || null,
    disable_reason: body.disableReason || null,
    updated_at: new Date().toISOString(),
  };
  if (!row.channel_id && !row.stream_seed_slug) {
    return NextResponse.json({ error: "Channel ID or stream seed slug is required" }, { status: 400 });
  }
  if (status === "approved" && (!row.commercial_use || !row.redistribution || !row.proxy_permission)) {
    return NextResponse.json({ error: "Approval requires explicit commercial, redistribution and proxy permission" }, { status: 400 });
  }
  const { data, error } = await service.from("content_rights").upsert(row).select("*").single();
  if (error) return NextResponse.json({ error: "Rights record could not be saved" }, { status: 400 });
  await Promise.all([
    service.from("content_rights_history").insert({
      rights_id: data.id,
      action: `rights.${status}`,
      actor_user_id: access.user.id,
      snapshot: data,
    }),
    writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: `rights.${status}`,
      entityType: "content_rights",
      entityId: data.id,
      summary: `Set source rights to ${status}`,
      meta: { channelId: data.channel_id, streamSeedSlug: data.stream_seed_slug },
    }),
  ]);
  return NextResponse.json({ ok: true, rights: data });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOps() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) return null;
  return access;
}

/** Quarantine / restore / recheck channel health from Daily Ops. */
export async function POST(req: NextRequest) {
  const access = await assertOps();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    slug?: string;
  };
  const slug = (body.slug || "").trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  if (body.action === "quarantine") {
    const { error } = await service
      .from("channels")
      .update({
        health_status: "dead",
        is_online: false,
        last_checked_at: new Date().toISOString(),
      })
      .eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await service
      .from("channel_sources")
      .update({ health_status: "dead" })
      .eq(
        "channel_id",
        (
          await service.from("channels").select("id").eq("slug", slug).maybeSingle()
        ).data?.id || "",
      );
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "channel.quarantine",
      entityType: "channel",
      entityId: slug,
      summary: `Quarantined ${slug} (force dead)`,
    });
    return NextResponse.json({ ok: true, health_status: "dead" });
  }

  if (body.action === "restore") {
    const { error } = await service
      .from("channels")
      .update({
        health_status: "degraded",
        is_online: true,
        last_checked_at: new Date().toISOString(),
      })
      .eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "channel.restore",
      entityType: "channel",
      entityId: slug,
      summary: `Restored ${slug} to degraded (await health sweep)`,
    });
    return NextResponse.json({ ok: true, health_status: "degraded" });
  }

  if (body.action === "recheck") {
    // Mark checking so next cron/health-sweep prioritizes it.
    const { error } = await service
      .from("channels")
      .update({
        health_status: "degraded",
        last_checked_at: new Date(0).toISOString(),
      })
      .eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "channel.recheck",
      entityType: "channel",
      entityId: slug,
      summary: `Queued recheck for ${slug}`,
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

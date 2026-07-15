import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  const access = user ? await getAdminAccess(user) : null;
  const admin = Boolean(access && hasAdminPermission(access, "ops.write"));
  const service = createServiceClient();
  const sb = admin && service ? service : auth;
  let query = sb
    .from("admin_system_links")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!admin) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "System links could not be loaded" }, { status: 500 });
  return NextResponse.json({ links: data || [], admin });
}

function validLinkUrl(raw: string) {
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const access = user ? await getAdminAccess(user) : null;
  if (!access || !hasAdminPermission(access, "ops.write"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action === "delete") {
    const id = String(body.id || "");
    const { data, error } = await service
      .from("admin_system_links")
      .delete()
      .eq("id", id)
      .select("id, title")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Link could not be deleted" }, { status: 500 });
    }
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "system_link.delete",
      entityType: "admin_system_link",
      entityId: id,
      summary: `Deleted system link ${data.title}`,
    });
    return NextResponse.json({ ok: true });
  }

  const row = {
    title: String(body.title || "").trim(),
    url: String(body.url || "").trim(),
    placement: String(body.placement || "nav").toLowerCase(),
    icon: String(body.icon || "") || null,
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };
  if (!row.title || row.title.length > 80 || !row.url)
    return NextResponse.json({ error: "title and url required" }, { status: 400 });
  if (!["nav", "footer"].includes(row.placement)) {
    return NextResponse.json({ error: "Unsupported placement" }, { status: 400 });
  }
  if (!validLinkUrl(row.url)) {
    return NextResponse.json(
      { error: "Use an internal /path or an HTTPS URL without credentials" },
      { status: 400 },
    );
  }

  if (body.id) {
    const { data, error } = await service
      .from("admin_system_links")
      .update(row)
      .eq("id", String(body.id))
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "system_link.update",
      entityType: "admin_system_link",
      entityId: String(body.id),
      summary: `Updated ${row.placement} system link`,
      meta: { active: row.is_active },
    });
    return NextResponse.json({ link: data });
  }

  const { data, error } = await service
    .from("admin_system_links")
    .insert(row)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAuditLog(service, {
    actorEmail: access.user.email,
    actorUserId: access.user.id,
    action: "system_link.create",
    entityType: "admin_system_link",
    entityId: data.id,
    summary: `Created ${row.placement} system link`,
    meta: { active: row.is_active },
  });
  return NextResponse.json({ link: data });
}

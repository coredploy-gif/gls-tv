import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { COPY_FALLBACKS, allCopyEntries, t } from "@/lib/copy";
import { writeAuditLog } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminMode = req.nextUrl.searchParams.get("admin") === "1";
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (adminMode) {
    const access = user ? await getAdminAccess(user) : null;
    if (!access || !hasAdminPermission(access, "support.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const service = createServiceClient();
    const sb = service || auth;
    const { data, error } = await sb
      .from("app_copy")
      .select("key, value, updated_at, updated_by")
      .order("key");
    if (error) {
      // Table may not exist yet locally — still return fallbacks for the UI.
      return NextResponse.json({
        entries: allCopyEntries(),
        fallbacks: COPY_FALLBACKS,
        warning: error.message,
      });
    }
    const dbMap: Record<string, string> = {};
    const meta: Record<string, { updated_at?: string; updated_by?: string | null }> =
      {};
    for (const row of data || []) {
      dbMap[row.key] = row.value;
      meta[row.key] = {
        updated_at: row.updated_at,
        updated_by: row.updated_by,
      };
    }
    const entries = allCopyEntries(dbMap).map((e) => ({
      ...e,
      ...meta[e.key],
      fromDb: Object.prototype.hasOwnProperty.call(dbMap, e.key),
    }));
    return NextResponse.json({ entries, fallbacks: COPY_FALLBACKS });
  }

  // Public: merged map for clients
  const { data } = await auth.from("app_copy").select("key, value");
  const map: Record<string, string> = { ...COPY_FALLBACKS };
  for (const row of data || []) {
    if (row?.key && typeof row.value === "string" && row.value.trim()) {
      map[row.key] = row.value;
    }
  }
  return NextResponse.json({ copy: map });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const access = user ? await getAdminAccess(user) : null;
  if (!access || !hasAdminPermission(access, "support.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 500 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "upsert");

  if (action === "reset") {
    const key = String(body.key || "").trim();
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    const { error } = await service.from("app_copy").delete().eq("key", key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await writeAuditLog(service, {
      actorUserId: user!.id,
      actorEmail: user!.email,
      action: "app_copy.reset",
      entityType: "app_copy",
      entityId: key,
      summary: `Reset copy key ${key}`,
      meta: { fallback: t(key) },
    });
    return NextResponse.json({ ok: true, value: t(key) });
  }

  const key = String(body.key || "").trim();
  const value = String(body.value ?? "");
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  if (key.length > 120) {
    return NextResponse.json({ error: "key too long" }, { status: 400 });
  }
  if (value.length > 8000) {
    return NextResponse.json({ error: "value too long" }, { status: 400 });
  }

  const row = {
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: user!.id,
  };
  const { data, error } = await service
    .from("app_copy")
    .upsert(row, { onConflict: "key" })
    .select("key, value, updated_at, updated_by")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog(service, {
    actorUserId: user!.id,
    actorEmail: user!.email,
    action: "app_copy.upsert",
    entityType: "app_copy",
    entityId: key,
    summary: `Updated copy key ${key}`,
    meta: { chars: value.length },
  });

  return NextResponse.json({ entry: data });
}

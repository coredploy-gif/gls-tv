import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import { consumeRateLimit, clientIp } from "@/lib/rate-limit";

const REASONS = [
  "copyright",
  "illegal",
  "broken",
  "malware",
  "other",
] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to report a link." }, { status: 401 });
  }

  const rl = await consumeRateLimit({
    bucket: "link-report",
    key: `${user.id}:${clientIp(req)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many reports. Try again later." },
      { status: 429 },
    );
  }

  let body: {
    target_kind?: string;
    target_id?: string;
    target_url?: string;
    target_title?: string;
    reason?: string;
    details?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.target_kind || "";
  if (
    !["user_media_link", "admin_media_link", "playlist_channel", "catalog"].includes(
      kind,
    )
  ) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  const targetId = (body.target_id || "").trim();
  if (!targetId) {
    return NextResponse.json({ error: "Missing target id" }, { status: 400 });
  }
  const reason = REASONS.includes(body.reason as (typeof REASONS)[number])
    ? body.reason!
    : "other";

  const { data, error } = await supabase
    .from("link_reports")
    .insert({
      reporter_user_id: user.id,
      target_kind: kind,
      target_id: targetId,
      target_url: (body.target_url || "").trim().slice(0, 2000) || null,
      target_title: (body.target_title || "").trim().slice(0, 200) || null,
      reason,
      details: (body.details || "").trim().slice(0, 1000) || null,
      status: "open",
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ report: data });
}

export async function GET() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const { data, error } = await service
    .from("link_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data || [] });
}

export async function PATCH(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    admin_note?: string;
  };
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const status = body.status || "resolved";
  if (!["open", "reviewing", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const { data, error } = await service
    .from("link_reports")
    .update({
      status,
      admin_note: (body.admin_note || "").trim().slice(0, 500) || null,
      resolved_by: access.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}

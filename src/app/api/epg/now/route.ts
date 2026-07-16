import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";

/** Now / next programme for a live channel slug. */
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: nowRow } = await supabase
    .from("epg_slots")
    .select("id, title, description, starts_at, ends_at")
    .eq("channel_slug", slug)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: nextRow } = await supabase
    .from("epg_slots")
    .select("id, title, description, starts_at, ends_at")
    .eq("channel_slug", slug)
    .gt("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    slug,
    now: nowRow || null,
    next: nextRow || null,
  });
}

export async function POST(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "catalog.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    channel_slug?: string;
    title?: string;
    description?: string;
    starts_at?: string;
    ends_at?: string;
  };
  const slug = (body.channel_slug || "").trim();
  const title = (body.title || "").trim();
  if (!slug || !title || !body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const { data, error } = await service
    .from("epg_slots")
    .insert({
      channel_slug: slug,
      title: title.slice(0, 200),
      description: (body.description || "").trim().slice(0, 500) || null,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      source: "manual",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot: data });
}

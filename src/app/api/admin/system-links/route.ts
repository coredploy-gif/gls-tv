import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const service = createServiceClient();
  const sb = service || (await createClient());
  const { data } = await sb
    .from("admin_system_links")
    .select("*")
    .order("sort_order", { ascending: true });
  return NextResponse.json({ links: data || [] });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isEadminEmail(user.email))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const body = (await req.json()) as Record<string, unknown>;
  if (body.action === "delete") {
    await service.from("admin_system_links").delete().eq("id", String(body.id));
    return NextResponse.json({ ok: true });
  }

  const row = {
    title: String(body.title || "").trim(),
    url: String(body.url || "").trim(),
    placement: String(body.placement || "nav"),
    icon: String(body.icon || "") || null,
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };
  if (!row.title || !row.url)
    return NextResponse.json({ error: "title and url required" }, { status: 400 });

  if (body.id) {
    const { data, error } = await service
      .from("admin_system_links")
      .update(row)
      .eq("id", String(body.id))
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ link: data });
  }

  const { data, error } = await service
    .from("admin_system_links")
    .insert(row)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

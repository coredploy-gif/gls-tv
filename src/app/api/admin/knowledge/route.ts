import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail, normalizeSlug } from "@/lib/eadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const admin = req.nextUrl.searchParams.get("admin") === "1";
  const service = createServiceClient();
  const sb = service || (await createClient());

  let query = sb
    .from("kb_articles")
    .select("*")
    .order("sort_order", { ascending: true });

  if (!admin) query = query.eq("is_published", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let articles = data || [];
  if (q) {
    articles = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.body_md.toLowerCase().includes(q) ||
        (a.tags || []).some((t: string) => t.toLowerCase().includes(q)),
    );
  }
  return NextResponse.json({ articles });
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
  const action = String(body.action || "upsert");

  if (action === "delete") {
    const { error } = await service
      .from("kb_articles")
      .delete()
      .eq("id", String(body.id));
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const title = String(body.title || "").trim();
  if (!title)
    return NextResponse.json({ error: "title required" }, { status: 400 });
  const slug =
    String(body.slug || "").trim() || normalizeSlug(title) || `kb-${Date.now()}`;

  const row = {
    slug,
    title,
    summary: String(body.summary || ""),
    body_md: String(body.body_md || ""),
    category: String(body.category || "general"),
    tags: Array.isArray(body.tags) ? body.tags : [],
    is_published: body.is_published !== false,
    sort_order: Number(body.sort_order) || 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await service
    .from("kb_articles")
    .upsert(row, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ article: data });
}

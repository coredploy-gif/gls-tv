import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Member in-app reminders (DB-backed). */
export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ items: [] });

  const { data, error } = await sb
    .from("user_reminders")
    .select(
      "id, kind, title, body, href, severity, due_at, read_at, dismissed_at, created_at",
    )
    .eq("user_id", user.id)
    .is("dismissed_at", null)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: false })
    .limit(30);

  if (error) {
    // Table may not exist yet — soft fail
    return NextResponse.json({ items: [], error: error.message });
  }

  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");
  const id = String(body.id || "");
  if (!id)
    return NextResponse.json({ error: "id required" }, { status: 400 });

  if (action === "read") {
    const { error } = await sb
      .from("user_reminders")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "dismiss") {
    const { error } = await sb
      .from("user_reminders")
      .update({
        dismissed_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

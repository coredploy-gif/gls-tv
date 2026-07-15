import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const service = createServiceClient();
  const sb = service || (await createClient());
  const { data } = await sb
    .from("chat_widget_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  return NextResponse.json({
    config: data || {
      id: "default",
      welcome_title: "GLS Support",
      welcome_body:
        "Ask anything about GLS TV — we will search the knowledge base first.",
      primary_color: "#ff4d7a",
      position: "bottom-right",
      show_kb_first: true,
      ask_human_label: "Talk to support",
      offline_message:
        "No agents online. We created a ticket for you.",
      is_enabled: true,
    },
  });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const access = user ? await getAdminAccess(user) : null;
  if (!access || !hasAdminPermission(access, "support.write"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const body = (await req.json()) as Record<string, unknown>;
  const { data, error } = await service
    .from("chat_widget_config")
    .upsert(
      {
        id: "default",
        welcome_title: String(body.welcome_title || "GLS Support"),
        welcome_body: String(body.welcome_body || ""),
        primary_color: String(body.primary_color || "#ff4d7a"),
        position: String(body.position || "bottom-right"),
        show_kb_first: body.show_kb_first !== false,
        ask_human_label: String(body.ask_human_label || "Talk to support"),
        offline_message: String(body.offline_message || ""),
        is_enabled: body.is_enabled !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

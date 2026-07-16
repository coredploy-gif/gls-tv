import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import { validateMediaLinkUrl } from "@/lib/media-links";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isEadminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const service = createServiceClient();
  if (!service) {
    return {
      error: NextResponse.json(
        { error: "Service role is not configured" },
        { status: 503 },
      ),
    };
  }
  return { user, service };
}

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { service } = gate;

  const { data, error } = await service
    .from("admin_media_links")
    .select(
      "id, url, title, format, category, thumbnail_url, embed_url, video_id, is_published, notes, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { user, service } = gate;

  let body: {
    url?: string;
    title?: string;
    category?: string;
    notes?: string;
    is_published?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateMediaLinkUrl(body.url || "", body.title);
  if (!validation.ok || !validation.format) {
    return NextResponse.json(
      { error: validation.error || "Unsupported link" },
      { status: 400 },
    );
  }

  const { data, error } = await service
    .from("admin_media_links")
    .upsert(
      {
        created_by: user.id,
        url: (body.url || "").trim(),
        title: validation.title!,
        format: validation.format,
        category: (body.category || "Featured").trim().slice(0, 60) || "Featured",
        thumbnail_url: validation.thumbnailUrl || null,
        embed_url: validation.embedUrl || null,
        video_id: validation.videoId || null,
        is_published: body.is_published !== false,
        notes: (body.notes || "").trim().slice(0, 500) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    )
    .select(
      "id, url, title, format, category, thumbnail_url, embed_url, video_id, is_published, notes, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ link: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { service } = gate;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const { error } = await service.from("admin_media_links").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import {
  validateMediaLinkUrl,
} from "@/lib/media-links";
import { probeMediaLinkReachability } from "@/lib/media-links-probe";

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

const SELECT =
  "id, url, title, format, category, thumbnail_url, embed_url, video_id, is_published, notes, created_at";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { service } = gate;

  const { data, error } = await service
    .from("admin_media_links")
    .select(SELECT)
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
    skip_probe?: boolean;
    /** Validate + reachability only — no DB write (Staff picks Preview). */
    preview_only?: boolean;
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

  const url = (body.url || "").trim();
  let resolvedFormat = validation.format;
  if (!body.skip_probe) {
    const probe = await probeMediaLinkReachability(url, validation.format, {
      provisional: validation.provisional === true,
      requestOrigin: new URL(req.url).origin,
    });
    if (!probe.ok) {
      return NextResponse.json(
        { error: probe.detail || "URL is not reachable" },
        { status: 400 },
      );
    }
    if (probe.format) resolvedFormat = probe.format;

    if (body.preview_only) {
      return NextResponse.json({
        preview: {
          url,
          title: validation.title,
          format: resolvedFormat,
          category: (body.category || "Featured").trim().slice(0, 60) || "Featured",
          notes: (body.notes || "").trim().slice(0, 500),
          thumbnailUrl: validation.thumbnailUrl,
          embedUrl: validation.embedUrl,
          probe: probe.detail || "Reachable",
        },
      });
    }
  } else if (body.preview_only) {
    return NextResponse.json(
      { error: "Preview requires a reachability probe" },
      { status: 400 },
    );
  }

  // New saves are drafts unless explicitly published via confirm step.
  const publish = body.is_published === true;

  const { data, error } = await service
    .from("admin_media_links")
    .upsert(
      {
        created_by: user.id,
        url,
        title: validation.title!,
        format: resolvedFormat,
        category: (body.category || "Featured").trim().slice(0, 60) || "Featured",
        thumbnail_url: validation.thumbnailUrl || null,
        embed_url: validation.embedUrl || null,
        video_id: validation.videoId || null,
        is_published: publish,
        notes: (body.notes || "").trim().slice(0, 500) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    )
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ link: data });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { service } = gate;

  let body: { id?: string; is_published?: boolean; title?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.is_published === "boolean") {
    updates.is_published = body.is_published;
  }
  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 200);
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = title;
  }
  if (typeof body.category === "string") {
    updates.category = body.category.trim().slice(0, 60) || "Featured";
  }
  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await service
    .from("admin_media_links")
    .update(updates)
    .eq("id", body.id)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update link" }, { status: 500 });
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

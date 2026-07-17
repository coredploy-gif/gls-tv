import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";
import {
  normalizeMediaLinkCategory,
  validateMediaLinkUrl,
} from "@/lib/media-links";
import { probeMediaLinkReachability } from "@/lib/media-links-probe";
import { consumeRateLimit, clientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const MAX_LINKS = 100;

const SELECT =
  "id, user_id, url, title, format, status, thumbnail_url, category, is_favorite, embed_url, video_id, metadata, last_checked_at, last_watched_at, created_at, updated_at";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ links: [], entitled: false });
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);
  const { data, error } = await supabase
    .from("user_media_links")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_LINKS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    links: data ?? [],
    entitled: entitlement.allowed,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to save links." }, { status: 401 });
  }

  const rl = await consumeRateLimit({
    bucket: "media-links-post",
    key: `${user.id}:${clientIp(req)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many link imports. Try again in a bit." },
      { status: 429 },
    );
  }

  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: "An active trial or membership is required." },
      { status: 403 },
    );
  }

  let body: { url?: string; title?: string; category?: string };
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
  const probe = await probeMediaLinkReachability(url, validation.format, {
    provisional: validation.provisional === true,
    requestOrigin: req.nextUrl.origin,
  });
  if (!probe.ok) {
    return NextResponse.json(
      {
        error:
          probe.detail ||
          "That URL failed the reachability check. Fix the link and try again.",
      },
      { status: 400 },
    );
  }

  const resolvedFormat = probe.format || validation.format;

  const { count } = await supabase
    .from("user_media_links")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count || 0) >= MAX_LINKS) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_LINKS} links.` },
      { status: 400 },
    );
  }

  const row = {
    user_id: user.id,
    url,
    title: validation.title!,
    format: resolvedFormat,
    status: probe.status,
    thumbnail_url: validation.thumbnailUrl || null,
    category: normalizeMediaLinkCategory(body.category),
    embed_url: validation.embedUrl || null,
    video_id: validation.videoId || null,
    last_checked_at: new Date().toISOString(),
    metadata: {
      probe: probe.detail || null,
      provisional: validation.provisional === true,
    },
  };

  const { data, error } = await supabase
    .from("user_media_links")
    .insert(row)
    .select(SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That link is already in your library." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ link: data, probe });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: string;
    title?: string;
    category?: string;
    is_favorite?: boolean;
    mark_watched?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing link id" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 200);
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = title;
  }
  if (typeof body.category === "string") {
    updates.category = normalizeMediaLinkCategory(body.category);
  }
  if (typeof body.is_favorite === "boolean") {
    updates.is_favorite = body.is_favorite;
  }
  if (body.mark_watched === true) {
    updates.last_watched_at = new Date().toISOString();
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_media_links")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update link" }, { status: 500 });
  }
  return NextResponse.json({ link: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const { error } = await supabase
    .from("user_media_links")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

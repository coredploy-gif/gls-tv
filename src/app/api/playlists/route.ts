import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";
import { PLAYLIST_LIMITS } from "@/lib/playlists";

function redactSource(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}/…`;
  } catch {
    return "Saved source";
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ playlists: [], channels: [], entitled: false });
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);
  const params = new URL(req.url).searchParams;
  const playlistId = params.get("playlistId");
  const offset = Math.max(0, Math.min(Number(params.get("offset")) || 0, 5000));
  const limit = Math.max(
    1,
    Math.min(Number(params.get("limit")) || PLAYLIST_LIMITS.pageSize, 1000),
  );

  const { data: playlists, error: pErr } = await supabase
    .from("user_playlists")
    .select(
      "id, user_id, name, source_url, channel_count, status, error_message, last_synced_at, last_attempt_at, last_import_id, import_stats, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  let channelQuery = supabase
    .from("user_playlist_channels")
    .select(
      "id, playlist_id, user_id, slug, title, description, poster, backdrop, categories, countries, tvg_id, quality, format, sort_order, health_status, fail_count, latency_ms, last_checked_at, last_ok_at, quarantined_at, quarantine_reason",
    )
    .eq("user_id", user.id)
    .order("playlist_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);
  if (playlistId) channelQuery = channelQuery.eq("playlist_id", playlistId);
  const { data: channels, error: cErr } = entitlement.allowed
    ? await channelQuery
    : { data: [], error: null };

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  return NextResponse.json({
    playlists: (playlists ?? []).map((playlist) => ({
      ...playlist,
      source_url: null,
      source_redacted: redactSource(playlist.source_url),
    })),
    channels: channels ?? [],
    entitled: entitlement.allowed,
    page: {
      offset,
      limit,
      hasMore: (channels?.length || 0) === limit,
    },
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { id?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  if (!body.id || !name || name.length > 80) {
    return NextResponse.json({ error: "A valid playlist name is required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("user_playlists")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("id, name")
    .single();
  if (error) return NextResponse.json({ error: "Playlist could not be renamed" }, { status: 500 });
  return NextResponse.json({ playlist: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing playlist id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_playlists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

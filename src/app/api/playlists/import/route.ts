import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseM3u } from "@/lib/iptv";
import { PLAYLIST_LIMITS } from "@/lib/playlists";

export const runtime = "nodejs";
export const maxDuration = 60;

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchM3u(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "GLS-TV/1.0 (playlist-importer)",
        Accept: "application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain,*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Could not download playlist (HTTP ${res.status})`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > PLAYLIST_LIMITS.maxBytes) {
      throw new Error(
        `Playlist is too large (max ${Math.round(PLAYLIST_LIMITS.maxBytes / 1024 / 1024)}MB)`,
      );
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to save a playlist to your account." },
      { status: 401 },
    );
  }

  let body: { url?: string; name?: string; playlistId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = (body.url || "").trim();
  const name = (body.name || "My playlist").trim().slice(0, 80) || "My playlist";
  const playlistId = body.playlistId?.trim() || null;

  if (!url || !isHttpUrl(url)) {
    return NextResponse.json(
      { error: "Paste a valid http(s) M3U / M3U8 playlist link." },
      { status: 400 },
    );
  }

  let text: string;
  try {
    text = await fetchM3u(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!/#EXTM3U|#EXTINF/i.test(text)) {
    return NextResponse.json(
      {
        error:
          "That URL did not look like an M3U playlist. Use a direct .m3u / .m3u8 link.",
      },
      { status: 400 },
    );
  }

  const parsed = parseM3u(text);
  if (!parsed.length) {
    return NextResponse.json(
      { error: "No channels found in that playlist." },
      { status: 400 },
    );
  }

  const channels = parsed.slice(0, PLAYLIST_LIMITS.maxChannels);
  const rawStore =
    text.length <= PLAYLIST_LIMITS.maxRawStore ? text : null;

  let targetId = playlistId;

  if (targetId) {
    const { data: existing, error: exErr } = await supabase
      .from("user_playlists")
      .select("id")
      .eq("id", targetId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (exErr || !existing) {
      return NextResponse.json(
        { error: "Playlist not found on your account." },
        { status: 404 },
      );
    }
    const { error: upErr } = await supabase
      .from("user_playlists")
      .update({
        name,
        source_url: url,
        raw_m3u: rawStore,
        status: "syncing",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .eq("user_id", user.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    await supabase
      .from("user_playlist_channels")
      .delete()
      .eq("playlist_id", targetId)
      .eq("user_id", user.id);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("user_playlists")
      .insert({
        user_id: user.id,
        name,
        source_url: url,
        raw_m3u: rawStore,
        status: "syncing",
        channel_count: 0,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message || "Could not create playlist" },
        { status: 500 },
      );
    }
    targetId = created.id;
  }

  const slugSeen = new Set<string>();
  const rows = channels.map((ch, i) => {
    let slug = ch.slug.replace(/^iptv-/, "") || `ch-${i}`;
    slug = slug.slice(0, 100);
    let unique = slug;
    let n = 2;
    while (slugSeen.has(unique)) {
      unique = `${slug}-${n++}`.slice(0, 110);
    }
    slugSeen.add(unique);

    const src = ch.sources[0];
    return {
      playlist_id: targetId!,
      user_id: user.id,
      slug: unique,
      title: ch.title.slice(0, 200),
      description: ch.description.slice(0, 500),
      poster: ch.poster,
      backdrop: ch.backdrop,
      categories: ch.categories.slice(0, 12),
      countries: ch.countries.slice(0, 6),
      tvg_id: ch.tvgId || null,
      stream_url: src?.url || "",
      quality: src?.quality || "Auto",
      format: src?.format || "hls",
      sort_order: i,
    };
  });

  const batchSize = 250;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error: insErr } = await supabase
      .from("user_playlist_channels")
      .insert(chunk);
    if (insErr) {
      await supabase
        .from("user_playlists")
        .update({
          status: "error",
          error_message: insErr.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId)
        .eq("user_id", user.id);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  const truncated = parsed.length > channels.length;
  const { data: playlist, error: finErr } = await supabase
    .from("user_playlists")
    .update({
      channel_count: rows.length,
      status: "ready",
      error_message: truncated
        ? `Imported first ${rows.length} of ${parsed.length} channels`
        : null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (finErr) {
    return NextResponse.json({ error: finErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    playlist,
    channelCount: rows.length,
    truncated,
    totalFound: parsed.length,
  });
}

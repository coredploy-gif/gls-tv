import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseM3uDetailed } from "@/lib/iptv";
import { PLAYLIST_LIMITS } from "@/lib/playlists";
import { getAccountEntitlement } from "@/lib/membership/account";
import { secureFetchBuffered, validatePublicUrl } from "@/lib/secure-url";
import { shouldSkipUnboundedMediaBodyDownload } from "@/lib/media-path";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";
import { consumeRateLimit, clientIp } from "@/lib/rate-limit";

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

function responseError(
  code: string,
  message: string,
  status: number,
  importId: string,
) {
  return NextResponse.json({ error: { code, message, importId } }, { status });
}

async function fetchM3u(url: string) {
  // Individual /play/… and .m3u8 streams: never buffer live media.
  if (shouldSkipUnboundedMediaBodyDownload(url)) {
    await validatePublicUrl(url);
    return { text: "", finalUrl: url };
  }

  const res = await secureFetchBuffered(url, {
    timeoutMs: 20_000,
    maxRedirects: 4,
    maxBytes: PLAYLIST_LIMITS.maxBytes,
    headers: {
        "User-Agent": "GLS-TV/1.0 (playlist-importer)",
        Accept: "application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain,*/*",
    },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Could not download playlist (HTTP ${res.status})`);
  }
  const contentType = String(res.headers["content-type"] || "");
  if (contentType.includes("text/html")) throw new Error("URL returned HTML");
  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(res.body),
    finalUrl: res.finalUrl,
  };
}

export async function POST(req: NextRequest) {
  const importId = crypto.randomUUID();
  if (!(await isFeatureEnabled("playlist_imports"))) {
    return responseError(
      "M3U_IMPORTS_DISABLED",
      "Playlist imports are temporarily unavailable.",
      503,
      importId,
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return responseError(
      "M3U_UNAUTHORIZED",
      "Sign in to save a playlist to your account.",
      401,
      importId,
    );
  }

  const rl = await consumeRateLimit({
    bucket: "playlist-import",
    key: `${user.id}:${clientIp(req)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return responseError(
      "M3U_RATE_LIMITED",
      "Too many playlist imports. Try again later.",
      429,
      importId,
    );
  }

  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) {
    return responseError(
      "M3U_ENTITLEMENT_REQUIRED",
      "An active trial or membership is required.",
      403,
      importId,
    );
  }

  let body: { url?: string; name?: string; playlistId?: string; channelTitle?: string };
  try {
    body = await req.json();
  } catch {
    return responseError("M3U_BAD_REQUEST", "Invalid JSON body.", 400, importId);
  }

  const name = (body.name || "My playlist").trim().slice(0, 80) || "My playlist";
  const channelTitle = (body.channelTitle || "").trim().slice(0, 200) || undefined;
  const playlistId = body.playlistId?.trim() || null;
  let url = (body.url || "").trim();

  if (playlistId) {
    const { data: existing, error } = await supabase
      .from("user_playlists")
      .select("id, source_url, last_attempt_at")
      .eq("id", playlistId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !existing) {
      return responseError(
        "M3U_PLAYLIST_NOT_FOUND",
        "Playlist not found on your account.",
        404,
        importId,
      );
    }
    if (
      existing.last_attempt_at &&
      Date.now() - new Date(existing.last_attempt_at).getTime() <
        PLAYLIST_LIMITS.refreshCooldownMs
    ) {
      return responseError(
        "M3U_REFRESH_COOLDOWN",
        "Please wait briefly before refreshing this playlist again.",
        429,
        importId,
      );
    }
    url ||= existing.source_url || "";
  } else {
    const { count } = await supabase
      .from("user_playlists")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count || 0) >= PLAYLIST_LIMITS.maxPlaylists) {
      return responseError(
        "M3U_PLAYLIST_LIMIT",
        `Your account can save up to ${PLAYLIST_LIMITS.maxPlaylists} playlists.`,
        409,
        importId,
      );
    }
  }

  if (!url || !isHttpUrl(url)) {
    return responseError(
      "M3U_URL_INVALID",
      "Paste a valid HTTP(S) M3U or HLS (.m3u8) link.",
      400,
      importId,
    );
  }

  let fetched: { text: string; finalUrl: string };
  try {
    fetched = await fetchM3u(url);
  } catch {
    if (playlistId) {
      await supabase
        .from("user_playlists")
        .update({
          status: "error",
          error_message: "The playlist could not be downloaded. Your existing channels were kept.",
          last_attempt_at: new Date().toISOString(),
          last_import_id: importId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", playlistId)
        .eq("user_id", user.id);
    }
    return responseError(
      "M3U_FETCH_FAILED",
      "The playlist could not be downloaded. Existing channels were kept.",
      400,
      importId,
    );
  }

  const parsed = parseM3uDetailed(fetched.text, {
    baseUrl: fetched.finalUrl,
    maxChannels: PLAYLIST_LIMITS.maxChannels,
    // Prefer the user-pasted URL so jmp2/pluto entry points stay stable after redirects.
    singleStreamUrl: url,
    singleStreamTitle: channelTitle,
  });
  if (!parsed.channels.length) {
    return responseError(
      "M3U_NO_CHANNELS",
      "No valid HTTP(S) channels were found in that playlist.",
      400,
      importId,
    );
  }

  const rawStore =
    fetched.text.length <= PLAYLIST_LIMITS.maxRawStore ? fetched.text : null;

  const slugSeen = new Set<string>();
  const rows = parsed.channels.map((ch, i) => {
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

  const stats = { ...parsed.stats, importId };
  const { data: playlist, error } = await supabase.rpc(
    "apply_user_playlist_import",
    {
      p_playlist_id: playlistId,
      p_name: name,
      p_source_url: url,
      p_raw_m3u: rawStore,
      p_import_id: importId,
      p_channels: rows,
      p_stats: stats,
    },
  );
  if (error) {
    if (playlistId) {
      await supabase
        .from("user_playlists")
        .update({
          status: "error",
          error_message: "The new import could not be applied. Your existing channels were kept.",
          last_attempt_at: new Date().toISOString(),
          last_import_id: importId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", playlistId)
        .eq("user_id", user.id);
    }
    const known = error.message.match(/M3U_[A-Z_]+/)?.[0];
    return responseError(
      known || "M3U_APPLY_FAILED",
      known === "M3U_REFRESH_COOLDOWN"
        ? "Another refresh just completed. Wait briefly and try again."
        : "The new import could not be applied. Existing channels were kept.",
      known === "M3U_REFRESH_COOLDOWN" ? 429 : 500,
      importId,
    );
  }

  return NextResponse.json({
    ok: true,
    playlist,
    channelCount: rows.length,
    stats,
    importId,
  });
}

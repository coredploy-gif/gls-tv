import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import { getAccountEntitlement } from "@/lib/membership/account";
import { VIEWER_SESSION_COOKIE } from "@/lib/membership/plans";
import { secureFetchBuffered, validatePublicUrl } from "@/lib/secure-url";
import { isAllowedMediaHost } from "@/lib/media-hosts";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";
import { operationalLog } from "@/lib/operations/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function proxyUrl(absolute: string, channelId?: string | null) {
  const channel = channelId ? `channelId=${encodeURIComponent(channelId)}&` : "";
  // Keep rewritten HLS resources relative to the browser's current origin.
  // Next.js can normalize req.nextUrl.origin to localhost even when the user
  // opened 127.0.0.1, which would drop host-scoped authentication cookies.
  return `/api/hls?${channel}url=${encodeURIComponent(absolute)}`;
}
function rewritePlaylist(
  body: string,
  baseUrl: string,
  channelId?: string | null,
) {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
          try {
            return `URI="${proxyUrl(new URL(uri, baseUrl).href, channelId)}"`;
          } catch {
            return _match;
          }
        });
      }
      try {
        return proxyUrl(new URL(trimmed, baseUrl).href, channelId);
      } catch {
        return line;
      }
    })
    .join("\n");
}
function upstreamHeaders(target: string, range: string | null) {
  const url = new URL(target);
  const headers: Record<string, string> = {
    "User-Agent": "GLS-TV/1.0 (media-proxy)",
    Accept: "*/*",
    Referer: `${url.origin}/`,
  };
  if (range) headers.Range = range;
  return headers;
}

const quotas = new Map<string, { window: number; count: number }>();
function withinQuota(key: string) {
  const minute = Math.floor(Date.now() / 60_000);
  const current = quotas.get(key);
  if (!current || current.window !== minute) {
    quotas.set(key, { window: minute, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 240;
}

function sameOriginCors(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin ? req.nextUrl.origin : null;
}

export async function GET(req: NextRequest) {
  if (!(await isFeatureEnabled("hls_proxy"))) {
    return NextResponse.json(
      { error: "Media delivery is temporarily unavailable" },
      { status: 503 },
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: "An active trial or membership is required" },
      { status: 403 },
    );
  }
  const service = createServiceClient();
  const sessionToken = req.cookies.get(VIEWER_SESSION_COOKIE)?.value;
  if (service && sessionToken) {
    const { validateViewerDeviceSession } = await import(
      "@/lib/membership/viewer-sessions"
    );
    const session = await validateViewerDeviceSession(
      service,
      user.id,
      sessionToken,
    );
    if (!session.ok) {
      return NextResponse.json(
        {
          error:
            "This device is no longer authorised to stream. Choose a profile again or sign out another device.",
        },
        { status: 409 },
      );
    }
  } else if (!isEadminEmail(user.email)) {
    return NextResponse.json(
      { error: "Choose a profile on this device before watching." },
      { status: 409 },
    );
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!withinQuota(`${user.id}:${ip}`)) {
    return NextResponse.json({ error: "Too many media requests" }, { status: 429 });
  }

  const channelId = req.nextUrl.searchParams.get("channelId");
  const raw = req.nextUrl.searchParams.get("url");
  let persistedUrl: string | null = null;
  if (channelId) {
    const { data: channel } = await supabase
      .from("user_playlist_channels")
      .select("stream_url")
      .eq("id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    persistedUrl = channel.stream_url;
  }
  if (!raw && !persistedUrl) {
    return NextResponse.json({ error: "Missing channel" }, { status: 400 });
  }

  let target: string;
  try {
    target = raw ? decodeURIComponent(raw) : persistedUrl!;
    if (channelId && persistedUrl) {
      // HLS manifests commonly hand segment, key, and variant requests to a
      // different CDN hostname. A channelId is owner-scoped and authenticated
      // above, so accept those derived public URLs instead of requiring every
      // customer playlist CDN to be pre-listed in our built-in catalogue.
      // validatePublicUrl still blocks private/reserved network targets.
      await validatePublicUrl(target);
    } else {
      await validatePublicUrl(target, isAllowedMediaHost);
    }
  } catch {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await secureFetchBuffered(target, {
      headers: upstreamHeaders(target, req.headers.get("range")),
      timeoutMs: 15_000,
      maxRedirects: 4,
      maxBytes: 32 * 1024 * 1024,
      allowedHost: channelId ? undefined : isAllowedMediaHost,
    });
    if (upstream.status >= 400) {
      return NextResponse.json(
        { error: "This programme isn’t available right now." },
        { status: upstream.status },
      );
    }

    const contentType = String(upstream.headers["content-type"] || "");
    const probe = upstream.body.subarray(0, 512).toString("utf8");
    const playlist =
      probe.includes("#EXT") ||
      /mpegurl|m3u8/i.test(contentType) ||
      /\.m3u8(?:$|\?)/i.test(upstream.finalUrl);
    const cors = sameOriginCors(req);
    if (!cors) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });

    if (playlist) {
      if (upstream.body.length > 2 * 1024 * 1024 || !probe.includes("#EXT")) {
        return NextResponse.json({ error: "Invalid playlist" }, { status: 502 });
      }
      return new NextResponse(
        rewritePlaylist(
          upstream.body.toString("utf8"),
          upstream.finalUrl,
          channelId,
        ),
        {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": cors,
            Vary: "Origin",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (/text\/html/i.test(contentType)) {
      return NextResponse.json({ error: "Unexpected upstream content" }, { status: 502 });
    }
    const headers: Record<string, string> = {
      "Content-Type": contentType || "application/octet-stream",
      "Access-Control-Allow-Origin": cors,
      Vary: "Origin",
      "Cache-Control": "private, max-age=4",
      "Accept-Ranges": "bytes",
    };
    if (upstream.headers["content-range"]) {
      headers["Content-Range"] = String(upstream.headers["content-range"]);
    }
    return new NextResponse(new Uint8Array(upstream.body), {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (error) {
    let targetHost = "invalid";
    try {
      targetHost = new URL(target).hostname;
    } catch {
      /* keep invalid */
    }
    operationalLog("warn", "hls.proxy_failed", {
      requestId: req.headers.get("x-request-id"),
      errorType: error instanceof Error ? error.name : "unknown",
      errorMessage:
        error instanceof Error ? error.message.slice(0, 160) : "unknown",
      targetHost,
      requestKind: /\.m3u8(?:$|\?)/i.test(target) ? "playlist" : "segment",
      userId: user.id,
    });
    return NextResponse.json(
      { error: "This programme isn’t available right now." },
      { status: 502 },
    );
  }
}

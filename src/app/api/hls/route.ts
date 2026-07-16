import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import { getAccountEntitlement } from "@/lib/membership/account";
import { VIEWER_SESSION_COOKIE } from "@/lib/membership/plans";
import {
  readStreamBuffered,
  secureFetchStream,
  validatePublicUrl,
} from "@/lib/secure-url";
import { isAllowedMediaHost } from "@/lib/media-hosts";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";
import { operationalLog } from "@/lib/operations/logger";
import { issueHlsTicket, verifyHlsTicket } from "@/lib/hls-ticket";
import { rewriteHlsPlaylist } from "@/lib/hls-playlist";
import { hlsUpstreamHeaders } from "@/lib/hls-upstream";
import {
  isFragileHost,
  isRawIpUrl,
  overrideHealUrl,
  primaryPrivateHealUrl,
} from "@/lib/channel-heal";
import {
  isBrokenTraceOrigin,
  isTraceChannel,
} from "@/lib/trace-mirrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "dub1";

type TimingSpan = { name: string; duration: number };

function timedResponse(
  response: NextResponse,
  startedAt: number,
  spans: TimingSpan[],
) {
  const total = performance.now() - startedAt;
  response.headers.set(
    "Server-Timing",
    [
      ...spans.map(
        ({ name, duration }) => `${name};dur=${duration.toFixed(1)}`,
      ),
      `total;dur=${total.toFixed(1)}`,
    ].join(", "),
  );
  response.headers.set("x-gls-region", process.env.VERCEL_REGION || "local");
  return response;
}

function proxyUrl(
  absolute: string,
  channelId?: string | null,
  sessionToken?: string | null,
) {
  const params = new URLSearchParams();
  if (channelId) {
    params.set("channelId", channelId);
    const ticket = issueHlsTicket(channelId, absolute, sessionToken || null);
    if (ticket) {
      params.set("exp", String(ticket.expiresAt));
      params.set("sig", ticket.signature);
    }
  }
  params.set("url", absolute);
  // Keep rewritten HLS resources relative to the browser's current origin.
  // Next.js can normalize req.nextUrl.origin to localhost even when the user
  // opened 127.0.0.1, which would drop host-scoped authentication cookies.
  return `/api/hls?${params.toString()}`;
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
  const startedAt = performance.now();
  const spans: TimingSpan[] = [];
  const measured = async <T,>(name: string, work: PromiseLike<T>) => {
    const started = performance.now();
    try {
      return await work;
    } finally {
      spans.push({ name, duration: performance.now() - started });
    }
  };
  const respond = (response: NextResponse) =>
    timedResponse(response, startedAt, spans);
  const sessionToken = req.cookies.get(VIEWER_SESSION_COOKIE)?.value;
  const channelId = req.nextUrl.searchParams.get("channelId");
  const raw = req.nextUrl.searchParams.get("url");
  const signature = req.nextUrl.searchParams.get("sig");
  const expiresAt = Number(req.nextUrl.searchParams.get("exp"));
  const hasTicket = Boolean(signature || req.nextUrl.searchParams.has("exp"));
  const signedRequest =
    Boolean(channelId && raw && signature) &&
    verifyHlsTicket(
      channelId!,
      raw!,
      expiresAt,
      signature!,
      sessionToken || null,
    );

  if (hasTicket && !signedRequest) {
    return respond(
      NextResponse.json({ error: "Media link expired" }, { status: 403 }),
    );
  }

  let authenticatedUserId: string | null = null;
  let persistedUrl: string | null = null;

  if (!signedRequest) {
    if (!(await measured("flag", isFeatureEnabled("hls_proxy")))) {
      return respond(
        NextResponse.json(
          { error: "Media delivery is temporarily unavailable" },
          { status: 503 },
        ),
      );
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await measured("auth", supabase.auth.getUser());
    if (!user) {
      return respond(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
    authenticatedUserId = user.id;

    const entitlement = await measured(
      "entitlement",
      getAccountEntitlement(user.id, user.email),
    );
    if (!entitlement.allowed) {
      return respond(
        NextResponse.json(
          { error: "An active trial or membership is required" },
          { status: 403 },
        ),
      );
    }
    const service = createServiceClient();
    if (service && sessionToken) {
      const { validateViewerDeviceSession } = await import(
        "@/lib/membership/viewer-sessions"
      );
      const session = await measured(
        "session",
        validateViewerDeviceSession(service, user.id, sessionToken),
      );
      if (!session.ok) {
        return respond(
          NextResponse.json(
            {
              error:
                "This device is no longer authorised to stream. Choose a profile again or sign out another device.",
            },
            { status: 409 },
          ),
        );
      }
    } else if (!isEadminEmail(user.email)) {
      return respond(
        NextResponse.json(
          { error: "Choose a profile on this device before watching." },
          { status: 409 },
        ),
      );
    }

    if (channelId) {
      const { data: channel } = await measured(
        "channel",
        supabase
          .from("user_playlist_channels")
          .select("stream_url, slug, title")
          .eq("id", channelId)
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (!channel) {
        return respond(
          NextResponse.json({ error: "Channel not found" }, { status: 404 }),
        );
      }
      const rawStream = channel.stream_url?.trim() || "";
      const openHeal = primaryPrivateHealUrl(channel.slug, channel.title);
      const override = overrideHealUrl(channel.slug);
      const preferHeal =
        !!openHeal &&
        (!rawStream ||
          isBrokenTraceOrigin(rawStream) ||
          isFragileHost(rawStream) ||
          isRawIpUrl(rawStream) ||
          (!!override && rawStream !== override) ||
          (isTraceChannel(channel.slug, channel.title) &&
            !/amagi\.tv/i.test(rawStream)));
      // Curated open FAST/FTA when stored origin is fragile/dead or overridden.
      // Arena pay-linear returns null from primaryPrivateHealUrl — left alone.
      persistedUrl = preferHeal && openHeal ? openHeal : rawStream;
    }
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!withinQuota(`${authenticatedUserId || channelId || "signed"}:${ip}`)) {
    return respond(
      NextResponse.json({ error: "Too many media requests" }, { status: 429 }),
    );
  }

  if (!raw && !persistedUrl) {
    return respond(
      NextResponse.json({ error: "Missing channel" }, { status: 400 }),
    );
  }

  let target: string;
  try {
    target = raw ? decodeURIComponent(raw) : persistedUrl!;
    if (channelId) {
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
    return respond(NextResponse.json({ error: "Host not allowed" }, { status: 403 }));
  }

  try {
    const upstream = await measured(
      "upstream",
      secureFetchStream(target, {
        headers: hlsUpstreamHeaders(target, req.headers.get("range")),
        timeoutMs: 15_000,
        maxRedirects: 4,
        maxBytes: 32 * 1024 * 1024,
        allowedHost: channelId ? undefined : isAllowedMediaHost,
      }),
    );
    if (upstream.status >= 400) {
      upstream.body.destroy();
      return respond(
        NextResponse.json(
          { error: "This programme isn’t available right now." },
          { status: upstream.status },
        ),
      );
    }

    const contentType = String(upstream.headers["content-type"] || "");
    const playlist =
      /mpegurl|m3u8/i.test(contentType) ||
      /\.m3u8(?:$|\?)/i.test(upstream.finalUrl);
    const cors = sameOriginCors(req);
    if (!cors) {
      upstream.body.destroy();
      return respond(
        NextResponse.json({ error: "Origin not allowed" }, { status: 403 }),
      );
    }

    if (playlist) {
      const manifest = await measured(
        "manifest",
        readStreamBuffered(upstream.body, 2 * 1024 * 1024),
      );
      const probe = manifest.subarray(0, 512).toString("utf8");
      if (!probe.includes("#EXT")) {
        return respond(
          NextResponse.json({ error: "Invalid playlist" }, { status: 502 }),
        );
      }
      return respond(
        new NextResponse(
          rewriteHlsPlaylist(
            manifest.toString("utf8"),
            upstream.finalUrl,
            (absoluteUrl) =>
              proxyUrl(absoluteUrl, channelId, sessionToken || null),
          ),
          {
            headers: {
              "Content-Type": "application/vnd.apple.mpegurl",
              "Access-Control-Allow-Origin": cors,
              Vary: "Origin",
              "Cache-Control": "no-store",
            },
          },
        ),
      );
    }

    if (/text\/html/i.test(contentType)) {
      upstream.body.destroy();
      return respond(
        NextResponse.json(
          { error: "Unexpected upstream content" },
          { status: 502 },
        ),
      );
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
    const body = Readable.toWeb(
      upstream.body,
    ) as unknown as ReadableStream<Uint8Array>;
    return respond(
      new NextResponse(body, {
        status: upstream.status === 206 ? 206 : 200,
        headers,
      }),
    );
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
      userId: authenticatedUserId || undefined,
      signedRequest,
      region: process.env.VERCEL_REGION || "local",
    });
    return respond(
      NextResponse.json(
        { error: "This programme isn’t available right now." },
        { status: 502 },
      ),
    );
  }
}

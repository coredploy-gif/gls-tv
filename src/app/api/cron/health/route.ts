import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { secureFetchBuffered } from "@/lib/secure-url";
import {
  firstHlsResource,
  looksLikePlayableMedia,
  nextPlaylistHealth,
} from "@/lib/playlist-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Local/Vercel cron backup for health-sweep Edge Function.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    req.nextUrl.searchParams.get("secret") === secret
  );
}

async function sweepPrivatePlaylists(sb: SupabaseClient) {
  const { data: channels, error } = await sb
    .from("user_playlist_channels")
    .select("id, stream_url, format, fail_count")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(12);
  if (error) throw error;

  let healthy = 0;
  let unavailable = 0;
  let degraded = 0;
  const queue = [...(channels || [])];

  const worker = async () => {
    while (queue.length) {
      const row = queue.shift();
      if (!row) return;
      const started = Date.now();
      let ok = false;
      let latency: number | null = null;
      try {
        const format = String(row.format || "hls").toLowerCase();
        const result = await secureFetchBuffered(row.stream_url, {
          timeoutMs: 6_000,
          maxRedirects: 4,
          maxBytes: 2 * 1024 * 1024,
          headers: {
            "User-Agent": "GLS-TV-Health/1.0",
            Accept: "*/*",
            ...(format === "mp4" ? { Range: "bytes=0-65535" } : {}),
          },
        });
        latency = Date.now() - started;
        const probe = result.body.subarray(0, 4096).toString("utf8");
        const responseOk = result.status >= 200 && result.status < 400;
        if (format === "hls" && responseOk && /#EXTM3U/i.test(probe)) {
          let mediaManifest = result.body.toString("utf8");
          let mediaBaseUrl = result.finalUrl;
          let mediaUrl = firstHlsResource(mediaManifest, mediaBaseUrl);
          if (/EXT-X-STREAM-INF/i.test(mediaManifest) && mediaUrl) {
            const mediaResult = await secureFetchBuffered(mediaUrl, {
              timeoutMs: 6_000,
              maxRedirects: 4,
              maxBytes: 2 * 1024 * 1024,
              headers: {
                "User-Agent": "GLS-TV-Health/1.0",
                Accept: "*/*",
              },
            });
            mediaManifest = mediaResult.body.toString("utf8");
            mediaBaseUrl = mediaResult.finalUrl;
            mediaUrl = firstHlsResource(mediaManifest, mediaBaseUrl);
          }
          if (mediaUrl) {
            const media = await secureFetchBuffered(mediaUrl, {
              timeoutMs: 8_000,
              maxRedirects: 4,
              maxBytes: 8 * 1024 * 1024,
              headers: {
                "User-Agent": "GLS-TV-Health/1.0",
                Accept: "*/*",
                Range: "bytes=0-262143",
              },
            });
            ok =
              media.status >= 200 &&
              media.status < 400 &&
              looksLikePlayableMedia(media.body);
          }
        } else if (format === "dash") {
          ok = responseOk && /<MPD[\s>]/i.test(probe);
        } else if (format !== "hls") {
          ok = responseOk && result.body.length > 0;
        }
        latency = Date.now() - started;
      } catch {
        latency = Date.now() - started;
      }

      const update = nextPlaylistHealth(
        ok,
        Number(row.fail_count || 0),
        latency,
      );
      if (update.health_status === "healthy") healthy += 1;
      else if (update.health_status === "unavailable") unavailable += 1;
      else degraded += 1;
      await sb.from("user_playlist_channels").update(update).eq("id", row.id);
    }
  };

  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return {
    checked: channels?.length || 0,
    healthy,
    degraded,
    unavailable,
  };
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key) : null;
  let privateHealth = {
    checked: 0,
    healthy: 0,
    degraded: 0,
    unavailable: 0,
  };
  if (sb) {
    try {
      privateHealth = await sweepPrivatePlaylists(sb);
    } catch (error) {
      console.warn(
        "private playlist health sweep failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  const edge =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
      ".supabase.co",
      ".supabase.co/functions/v1/health-sweep",
    ) || "";

  // Prefer invoking Edge Function so one code path owns health
  if (edge && process.env.CRON_SECRET) {
    try {
      const res = await fetch(edge, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      const json = await res.json();
      const { recordCronRun } = await import("@/lib/admin/audit");
      if (sb) {
        await recordCronRun(
          sb,
          "health",
          privateHealth.unavailable > 0 ? "partial" : "ok",
          `private checked=${privateHealth.checked} healthy=${privateHealth.healthy} degraded=${privateHealth.degraded} unavailable=${privateHealth.unavailable}`,
          { privateHealth, publicHealth: json },
        );
      }
      return NextResponse.json(
        { via: "edge", privateHealth, ...json },
        { status: res.status },
      );
    } catch (e) {
      console.warn("edge invoke failed", e);
    }
  }

  // Fallback: light local sweep with service role
  if (!sb) {
    return NextResponse.json(
      {
        error:
          "Set CRON_SECRET + Edge Function, or SUPABASE_SERVICE_ROLE_KEY for local sweep",
      },
      { status: 500 },
    );
  }

  const { data: sources, error } = await sb
    .from("channel_sources")
    .select("id, channel_id, url, fail_count")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let healthy = 0;
  let dead = 0;
  const channels = new Set<string>();

  for (const row of sources || []) {
    channels.add(row.channel_id);
    const started = Date.now();
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2500);
      const res = await fetch(row.url, {
        signal: ac.signal,
        headers: { "User-Agent": "GLS-TV-Health/1.0" },
        redirect: "follow",
      });
      const text = await res.text();
      clearTimeout(t);
      const latency = Date.now() - started;
      const ok = res.ok && /#EXTM3U/i.test(text);
      if (ok) {
        healthy += 1;
        await sb
          .from("channel_sources")
          .update({
            health_status: latency > 1800 ? "degraded" : "healthy",
            latency_ms: latency,
            last_checked_at: new Date().toISOString(),
            last_ok_at: new Date().toISOString(),
            fail_count: 0,
          })
          .eq("id", row.id);
      } else {
        dead += 1;
        const fails = (row.fail_count || 0) + 1;
        await sb
          .from("channel_sources")
          .update({
            health_status: fails >= 2 ? "dead" : "degraded",
            latency_ms: latency,
            last_checked_at: new Date().toISOString(),
            fail_count: fails,
          })
          .eq("id", row.id);
      }
    } catch {
      dead += 1;
      await sb
        .from("channel_sources")
        .update({
          health_status: "dead",
          last_checked_at: new Date().toISOString(),
          fail_count: (row.fail_count || 0) + 1,
        })
        .eq("id", row.id);
    }
  }

  for (const id of channels) {
    await sb.rpc("rollup_channel_health", { p_channel_id: id });
  }

  const { recordCronRun } = await import("@/lib/admin/audit");
  await recordCronRun(
    sb,
    "health",
    dead > 0 ? "partial" : "ok",
    `checked=${sources?.length || 0} healthy=${healthy} dead=${dead}`,
    { healthy, dead, checked: sources?.length || 0 },
  );

  return NextResponse.json({
    via: "local",
    privateHealth,
    checked: sources?.length || 0,
    healthy,
    dead,
  });
}

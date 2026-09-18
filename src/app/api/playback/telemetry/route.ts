import { NextRequest, NextResponse } from "next/server";
import { operationalLog } from "@/lib/operations/logger";
import { consumeRateLimit, clientIp } from "@/lib/rate-limit";
import { buildPlaybackMetric, type PlaybackMetricEvent } from "@/lib/playback-telemetry";

const EVENTS = new Set<PlaybackMetricEvent>(["startup", "rebuffer", "media_error", "cast_started"]);

export async function POST(req: NextRequest) {
  const limit = await consumeRateLimit({ bucket: "playback-telemetry", key: clientIp(req), limit: 120, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return new NextResponse(null, { status: 204 });
  try {
    const body = await req.json();
    if (!EVENTS.has(body.event)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    const metric = buildPlaybackMetric(body);
    operationalLog(metric.event === "media_error" ? "warn" : "info", "playback_metric", metric);
  } catch {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}

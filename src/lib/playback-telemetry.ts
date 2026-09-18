export type PlaybackMetricEvent = "startup" | "rebuffer" | "media_error" | "cast_started";

export function buildPlaybackMetric(input: {
  event: PlaybackMetricEvent;
  slug: string;
  durationMs?: number;
  sourceIndex?: number;
  mode?: string;
}) {
  return {
    event: input.event,
    slug: input.slug.replace(/[^a-z0-9_-]/gi, "").slice(0, 120),
    durationMs: Math.max(0, Math.min(300_000, Math.round(input.durationMs || 0))),
    sourceIndex: Math.max(0, Math.min(50, Math.round(input.sourceIndex || 0))),
    mode: input.mode === "proxy" ? "proxy" : "direct",
  };
}

export function sendPlaybackMetric(metric: ReturnType<typeof buildPlaybackMetric>) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(metric);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/playback/telemetry", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/playback/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

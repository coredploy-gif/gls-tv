export type PlaylistHealthStatus =
  | "unknown"
  | "healthy"
  | "degraded"
  | "unavailable";

export type PlaylistHealthUpdate = {
  health_status: PlaylistHealthStatus;
  fail_count: number;
  latency_ms: number | null;
  last_checked_at: string;
  last_ok_at?: string;
  quarantined_at: string | null;
  quarantine_reason: string | null;
};

export function nextPlaylistHealth(
  ok: boolean,
  currentFailCount: number,
  latencyMs: number | null,
  checkedAt = new Date(),
): PlaylistHealthUpdate {
  const timestamp = checkedAt.toISOString();
  if (ok) {
    return {
      health_status:
        latencyMs !== null && latencyMs > 2_500 ? "degraded" : "healthy",
      fail_count: 0,
      latency_ms: latencyMs,
      last_checked_at: timestamp,
      last_ok_at: timestamp,
      quarantined_at: null,
      quarantine_reason: null,
    };
  }

  const failCount = Math.max(0, currentFailCount) + 1;
  const unavailable = failCount >= 3;
  return {
    health_status: unavailable ? "unavailable" : "degraded",
    fail_count: failCount,
    latency_ms: latencyMs,
    last_checked_at: timestamp,
    quarantined_at: unavailable ? timestamp : null,
    quarantine_reason: unavailable
      ? "The upstream stream failed three consecutive health checks."
      : null,
  };
}

export function playlistHealthRank(status?: string | null) {
  switch (status) {
    case "healthy":
      return 0;
    case "degraded":
      return 1;
    case "unknown":
    case null:
    case undefined:
      return 2;
    case "unavailable":
      return 3;
    default:
      return 2;
  }
}

export function firstHlsResource(manifest: string, baseUrl: string) {
  const resource = manifest
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  if (!resource) return null;
  try {
    return new URL(resource, baseUrl).href;
  } catch {
    return null;
  }
}

export function looksLikePlayableMedia(body: Buffer) {
  if (body.length < 4_096) return false;
  if (body[0] === 0x47) return true;
  const marker = body.subarray(0, 32).toString("latin1");
  return /ftyp|styp|moof/.test(marker);
}

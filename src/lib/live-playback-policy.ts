/**
 * Live HLS playback policy: stay behind the live edge, never auto-snap,
 * and apply a softer ABR / deeper buffer profile on TV-class devices.
 */

export type LivePlaybackDeviceProfile = "tv" | "default";

export type LiveHlsTuning = {
  /** Target seconds behind the live edge (hls.js liveSyncDuration). */
  liveSyncDuration: number;
  /**
   * Max allowed latency before hls.js catch-up. Kept far above sync so we
   * do not chase the edge (which causes rebuffer on weak devices).
   *
   * Duration-based only — never set liveSyncDurationCount /
   * liveMaxLatencyDurationCount alongside these (hls.js rejects the mix).
   */
  liveMaxLatencyDuration: number;
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  backBufferLength: number;
  maxBufferHole: number;
  abrEwmaDefaultEstimate: number;
  abrBandWidthFactor: number;
  abrBandWidthUpFactor: number;
  testBandwidth: boolean;
  /** Cap ABR to this bitrate (bps); null = no hard cap. */
  maxBitrate: number | null;
  /** Prefer mid/low start level index after manifest (0 = lowest). */
  preferStartLevel: number;
  capLevelToPlayerSize: boolean;
  capLevelOnFPSDrop: boolean;
};

export type LiveChannelKind = {
  linear?: boolean;
  sports?: boolean;
  trace?: boolean;
  unstable?: boolean;
  privatePlaylist?: boolean;
};

/** Seconds of lag that count as “behind live” for UI (Back to live). */
export const BEHIND_LIVE_LAG_SEC = 12;

/**
 * Auto snap-to-live is never allowed for stall / recover / waiting paths.
 * Only explicit Back to live or a full page reload may seek to the sync point.
 */
export function shouldAutoSnapToLive(
  _reason:
    | "buffer_stalled"
    | "buffer_seek_hole"
    | "media_error_recover"
    | "waiting_timeout"
    | "level_switched"
    | "canplay"
    | "frag_loaded",
): false {
  return false;
}

export function resolveDeviceProfile(isTvLike: boolean): LivePlaybackDeviceProfile {
  return isTvLike ? "tv" : "default";
}

/**
 * Build hls.js live tuning. TV sticks (Skyworth / Android TV) get a deeper
 * behind-edge target, larger buffers, and a hard bitrate ceiling so MSE ABR
 * does not pick a ladder the SoC cannot decode without stalling.
 */
export function buildLiveHlsTuning(
  profile: LivePlaybackDeviceProfile,
  kind: LiveChannelKind = {},
): LiveHlsTuning {
  const deep = Boolean(
    kind.linear || kind.sports || kind.trace || kind.unstable || kind.privatePlaylist,
  );
  const tv = profile === "tv";

  // Target ~45s behind on phone/PC, ~60s on TV (duration-based only).
  const liveSyncDuration = tv ? 60 : deep ? 48 : 36;
  // Catch-up threshold far above sync — intentional DVR / pause must not yank.
  const liveMaxLatencyDuration = tv ? 900 : 720;

  if (tv) {
    return {
      liveSyncDuration,
      liveMaxLatencyDuration,
      maxBufferLength: kind.privatePlaylist ? 90 : deep ? 240 : 120,
      maxMaxBufferLength: kind.privatePlaylist ? 200 : deep ? 480 : 240,
      maxBufferSize: (deep ? 180 : 90) * 1000 * 1000,
      backBufferLength: deep ? 240 : 120,
      maxBufferHole: 2.2,
      abrEwmaDefaultEstimate: 220_000,
      abrBandWidthFactor: 0.4,
      abrBandWidthUpFactor: 0.2,
      testBandwidth: false,
      // ~2 Mbps ceiling — 1080p sports often stalls on mid-tier Android TV.
      maxBitrate: 2_200_000,
      preferStartLevel: 0,
      capLevelToPlayerSize: true,
      capLevelOnFPSDrop: true,
    };
  }

  return {
    liveSyncDuration,
    liveMaxLatencyDuration,
    maxBufferLength: kind.privatePlaylist
      ? 60
      : kind.linear || kind.trace
        ? 200
        : kind.unstable
          ? 140
          : kind.sports
            ? 120
            : 45,
    maxMaxBufferLength: kind.privatePlaylist
      ? 180
      : kind.linear || kind.trace
        ? 480
        : kind.unstable
          ? 320
          : kind.sports
            ? 280
            : 120,
    maxBufferSize:
      (kind.privatePlaylist
        ? 90
        : kind.linear || kind.trace
          ? 220
          : kind.unstable
            ? 160
            : kind.sports
              ? 130
              : 50) *
      1000 *
      1000,
    backBufferLength:
      kind.linear || kind.trace ? 300 : kind.sports || kind.unstable ? 210 : 90,
    maxBufferHole: deep ? 1.8 : 0.5,
    abrEwmaDefaultEstimate: deep ? 350_000 : 800_000,
    abrBandWidthFactor: deep ? 0.5 : 0.8,
    abrBandWidthUpFactor: deep ? 0.3 : 0.6,
    testBandwidth: !kind.unstable && !kind.linear && !kind.trace,
    maxBitrate: null,
    preferStartLevel: 0,
    capLevelToPlayerSize: false,
    capLevelOnFPSDrop: false,
  };
}

export function deepenLiveBufferTargets(
  profile: LivePlaybackDeviceProfile,
  kind: LiveChannelKind = {},
): Pick<LiveHlsTuning, "maxBufferLength" | "maxMaxBufferLength" | "maxBufferSize"> {
  const tv = profile === "tv";
  const deep = Boolean(
    kind.linear || kind.sports || kind.trace || kind.unstable || kind.privatePlaylist,
  );
  if (tv) {
    return {
      maxBufferLength: kind.privatePlaylist ? 120 : deep ? 360 : 180,
      maxMaxBufferLength: kind.privatePlaylist ? 240 : deep ? 600 : 320,
      maxBufferSize: (deep ? 280 : 140) * 1000 * 1000,
    };
  }
  return {
    maxBufferLength: kind.privatePlaylist
      ? 60
      : kind.linear || kind.trace
        ? 420
        : kind.sports
          ? 320
          : 140,
    maxMaxBufferLength: kind.privatePlaylist
      ? 180
      : kind.linear || kind.trace
        ? 720
        : kind.sports
          ? 540
          : 280,
    maxBufferSize:
      (kind.privatePlaylist
        ? 90
        : kind.linear || kind.trace
          ? 380
          : kind.sports
            ? 280
            : 120) *
      1000 *
      1000,
  };
}

/** Highest level index whose bitrate is ≤ maxBitrate (or last level if uncapped). */
export function capLevelIndexForBitrate(
  levels: ReadonlyArray<{ bitrate?: number }>,
  maxBitrate: number | null,
): number {
  if (!levels.length) return -1;
  if (maxBitrate == null || maxBitrate <= 0) return levels.length - 1;
  let best = 0;
  for (let i = 0; i < levels.length; i++) {
    const br = levels[i]?.bitrate ?? 0;
    if (br > 0 && br <= maxBitrate) best = i;
    if (br > maxBitrate) break;
  }
  return best;
}

export type SeekableWindow = { start: number; end: number };

/** Prefer seekable; fall back to buffered ranges for live DVR memory. */
export function getSeekableWindow(el: HTMLMediaElement): SeekableWindow | null {
  try {
    const { seekable } = el;
    if (seekable.length > 0) {
      return {
        start: seekable.start(0),
        end: seekable.end(seekable.length - 1),
      };
    }
  } catch {
    /* some WebViews throw on seekable access */
  }
  try {
    const { buffered } = el;
    if (buffered.length > 0) {
      return {
        start: buffered.start(0),
        end: buffered.end(buffered.length - 1),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Clamp a seek target into the buffered/seekable DVR window. */
export function clampSeekTime(el: HTMLMediaElement, target: number): number {
  if (!Number.isFinite(target)) return el.currentTime || 0;
  const win = getSeekableWindow(el);
  if (!win) return Math.max(0, target);
  const pad = 0.25;
  const start = win.start + pad;
  const end = Math.max(start, win.end - pad);
  return Math.min(end, Math.max(start, target));
}

export function seekBySeconds(el: HTMLMediaElement, deltaSec: number): number {
  const next = clampSeekTime(el, (el.currentTime || 0) + deltaSec);
  try {
    el.currentTime = next;
  } catch {
    /* ignore */
  }
  return next;
}

/** Lag above this means show Behind live / Back to live. Never auto-clear. */
export function shouldMarkBehindLive(lagSec: number): boolean {
  return lagSec >= BEHIND_LIVE_LAG_SEC;
}

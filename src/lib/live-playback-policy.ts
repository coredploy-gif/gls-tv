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
  /** Personal / staff My Links — short DVR windows; stay near the live edge. */
  myLinks?: boolean;
};

/** Seconds past intentional sync that count as “behind live” for UI. */
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
 * Build hls.js live tuning.
 *
 * Intentional ~45–60s behind the tip is not “stutter lag” — it is headroom so
 * the player can preload a large ahead buffer and ride out network dips.
 * My Links stay nearer the tip (short CDN windows). TV still caps bitrate.
 */
export function buildLiveHlsTuning(
  profile: LivePlaybackDeviceProfile,
  kind: LiveChannelKind = {},
): LiveHlsTuning {
  const deep = Boolean(
    kind.linear || kind.sports || kind.trace || kind.unstable || kind.privatePlaylist,
  );
  const tv = profile === "tv";
  const myLinks = Boolean(kind.myLinks);

  // My Links / staff picks: short CDN windows (~20–40s). Aim near the tip and
  // only preload within that window — a 60s+ buffer target thrashing-aborts
  // every fragment. Catalog sports keep the intentional ~45–60s cushion.
  const liveSyncDuration = myLinks
    ? tv
      ? 8
      : 6
    : tv
      ? 60
      : deep
        ? 48
        : 36;
  // Far above sync — do not chase live when the buffer is healthy.
  const liveMaxLatencyDuration = myLinks
    ? tv
      ? 40
      : 30
    : tv
      ? 900
      : 720;

  if (tv) {
    return {
      liveSyncDuration,
      liveMaxLatencyDuration,
      // Heavy preload from the first second (My Links capped to the DVR window).
      maxBufferLength: myLinks
        ? 20
        : kind.privatePlaylist
          ? 150
          : deep
            ? 240
            : 150,
      maxMaxBufferLength: myLinks
        ? 28
        : kind.privatePlaylist
          ? 280
          : deep
            ? 480
            : 300,
      maxBufferSize: (myLinks ? 40 : deep ? 260 : 160) * 1000 * 1000,
      backBufferLength: myLinks ? 16 : deep ? 240 : 120,
      maxBufferHole: myLinks ? 1.2 : 2.2,
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
    // Strong preload immediately — My Links stay inside the short live window.
    maxBufferLength: myLinks
      ? 18
      : kind.privatePlaylist
        ? 120
        : kind.linear || kind.trace
          ? 240
          : kind.unstable
            ? 180
            : kind.sports
              ? 180
              : 90,
    maxMaxBufferLength: myLinks
      ? 26
      : kind.privatePlaylist
        ? 240
        : kind.linear || kind.trace
          ? 480
          : kind.unstable
            ? 360
            : kind.sports
              ? 360
              : 200,
    maxBufferSize:
      (myLinks
        ? 36
        : kind.privatePlaylist
          ? 140
          : kind.linear || kind.trace
            ? 320
            : kind.unstable
              ? 240
              : kind.sports
                ? 240
                : 120) *
      1000 *
      1000,
    backBufferLength: myLinks
      ? 14
      : kind.linear || kind.trace
        ? 300
        : kind.sports || kind.unstable
          ? 210
          : 90,
    maxBufferHole: myLinks ? 0.8 : deep ? 1.8 : 0.5,
    abrEwmaDefaultEstimate: deep && !myLinks ? 350_000 : 800_000,
    abrBandWidthFactor: deep && !myLinks ? 0.5 : 0.8,
    abrBandWidthUpFactor: deep && !myLinks ? 0.3 : 0.6,
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
  const myLinks = Boolean(kind.myLinks);
  if (tv) {
    return {
      maxBufferLength: myLinks
        ? 24
        : kind.privatePlaylist
          ? 200
          : deep
            ? 360
            : 220,
      maxMaxBufferLength: myLinks
        ? 32
        : kind.privatePlaylist
          ? 360
          : deep
            ? 600
            : 400,
      maxBufferSize: (myLinks ? 48 : deep ? 320 : 200) * 1000 * 1000,
    };
  }
  return {
    maxBufferLength: myLinks
      ? 22
      : kind.privatePlaylist
        ? 180
        : kind.linear || kind.trace
          ? 420
          : kind.sports
            ? 360
            : 200,
    maxMaxBufferLength: myLinks
      ? 30
      : kind.privatePlaylist
        ? 320
        : kind.linear || kind.trace
          ? 720
          : kind.sports
            ? 600
            : 360,
    maxBufferSize:
      (myLinks
        ? 42
        : kind.privatePlaylist
          ? 180
          : kind.linear || kind.trace
            ? 420
            : kind.sports
              ? 360
              : 200) *
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

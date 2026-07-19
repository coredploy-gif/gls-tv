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

/** Seconds of lag that count as “behind live” for UI (Back to live). */
export const BEHIND_LIVE_LAG_SEC = 8;

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
 * Build hls.js live tuning. Prefer a lighter live-edge lag with a strong
 * ahead buffer (“preload”) so playback stays smooth without sitting a minute
 * behind. TV still caps bitrate for weak SoCs.
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

  // Lighter lag for now — still stay a few segments back so short CDN windows
  // and ABR switches do not 404 at the tip.
  const liveSyncDuration = myLinks
    ? tv
      ? 6
      : 4
    : tv
      ? 28
      : deep
        ? 22
        : 16;
  // Soft catch-up when latency drifts far past sync (hls seeks to sync point,
  // not the tip). Kept as a multiple of sync — never mix *DurationCount keys.
  const liveMaxLatencyDuration = myLinks
    ? tv
      ? 28
      : 20
    : tv
      ? 90
      : deep
        ? 70
        : 55;

  if (tv) {
    return {
      liveSyncDuration,
      liveMaxLatencyDuration,
      maxBufferLength: myLinks
        ? 45
        : kind.privatePlaylist
          ? 120
          : deep
            ? 180
            : 100,
      maxMaxBufferLength: myLinks
        ? 90
        : kind.privatePlaylist
          ? 240
          : deep
            ? 360
            : 200,
      maxBufferSize: (myLinks ? 60 : deep ? 200 : 120) * 1000 * 1000,
      backBufferLength: myLinks ? 36 : deep ? 180 : 90,
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
    // Strong preload from the first second — deepenLiveBufferTargets raises later.
    maxBufferLength: myLinks
      ? 36
      : kind.privatePlaylist
        ? 90
        : kind.linear || kind.trace
          ? 160
          : kind.unstable
            ? 120
            : kind.sports
              ? 100
              : 60,
    maxMaxBufferLength: myLinks
      ? 72
      : kind.privatePlaylist
        ? 200
        : kind.linear || kind.trace
          ? 360
          : kind.unstable
            ? 280
            : kind.sports
              ? 240
              : 140,
    maxBufferSize:
      (myLinks
        ? 48
        : kind.privatePlaylist
          ? 110
          : kind.linear || kind.trace
            ? 240
            : kind.unstable
              ? 180
              : kind.sports
                ? 160
                : 80) *
      1000 *
      1000,
    backBufferLength: myLinks
      ? 30
      : kind.linear || kind.trace
        ? 180
        : kind.sports || kind.unstable
          ? 120
          : 60,
    maxBufferHole: myLinks ? 0.8 : deep ? 1.4 : 0.5,
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
        ? 75
        : kind.privatePlaylist
          ? 150
          : deep
            ? 280
            : 160,
      maxMaxBufferLength: myLinks
        ? 120
        : kind.privatePlaylist
          ? 280
          : deep
            ? 480
            : 280,
      maxBufferSize: (myLinks ? 80 : deep ? 280 : 160) * 1000 * 1000,
    };
  }
  return {
    maxBufferLength: myLinks
      ? 60
      : kind.privatePlaylist
        ? 120
        : kind.linear || kind.trace
          ? 320
          : kind.sports
            ? 240
            : 160,
    maxMaxBufferLength: myLinks
      ? 120
      : kind.privatePlaylist
        ? 240
        : kind.linear || kind.trace
          ? 560
          : kind.sports
            ? 420
            : 280,
    maxBufferSize:
      (myLinks
        ? 72
        : kind.privatePlaylist
          ? 140
          : kind.linear || kind.trace
            ? 360
            : kind.sports
              ? 260
              : 140) *
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

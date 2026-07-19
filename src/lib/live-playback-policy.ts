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
  /** Imported M3U tag — playback should set `myLinks`; not a deep-sports signal. */
  privatePlaylist?: boolean;
  /** Personal / staff My Links / My Playlist — short DVR; stay near the live edge. */
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
 * Catalog sports: intentional ~45–60s behind + deep preload.
 * My Links / Staff picks / My Playlist: near the tip, full HD ABR, no
 * artificial bitrate ceiling. Short CDN windows still need a small sync
 * cushion so we do not tip-chase into underruns.
 */
export function buildLiveHlsTuning(
  profile: LivePlaybackDeviceProfile,
  kind: LiveChannelKind = {},
): LiveHlsTuning {
  const deep = Boolean(
    kind.linear || kind.sports || kind.trace || kind.unstable,
  );
  const tv = profile === "tv";
  const myLinks = Boolean(kind.myLinks);

  // My Links / Staff picks / My Playlist: sit ~12–14s behind tip so a short
  // cushion can form without tip-chasing. Catalog sports keep a deep cushion.
  const liveSyncDuration = myLinks
    ? tv
      ? 14
      : 12
    : tv
      ? 60
      : deep
        ? 48
        : 36;
  // Allow some lag before catch-up — never tip-chase into underruns.
  const liveMaxLatencyDuration = myLinks
    ? tv
      ? 60
      : 45
    : tv
      ? 900
      : 720;

  if (tv) {
    return {
      liveSyncDuration,
      liveMaxLatencyDuration,
      maxBufferLength: myLinks
        ? 18
        : deep
          ? 240
          : 150,
      maxMaxBufferLength: myLinks
        ? 24
        : deep
          ? 480
          : 300,
      maxBufferSize: (myLinks ? 64 : deep ? 260 : 160) * 1000 * 1000,
      backBufferLength: myLinks ? 16 : deep ? 240 : 120,
      maxBufferHole: myLinks ? 1.5 : 2.2,
      abrEwmaDefaultEstimate: myLinks ? 2_500_000 : 220_000,
      abrBandWidthFactor: myLinks ? 0.85 : 0.4,
      abrBandWidthUpFactor: myLinks ? 0.7 : 0.2,
      testBandwidth: Boolean(myLinks),
      // TV My Links: soft HD cap only; desktop allows full ladder.
      maxBitrate: myLinks ? 4_500_000 : 1_200_000,
      preferStartLevel: myLinks ? -1 : 0,
      capLevelToPlayerSize: !myLinks,
      capLevelOnFPSDrop: true,
    };
  }

  return {
    liveSyncDuration,
    liveMaxLatencyDuration,
    maxBufferLength: myLinks
      ? 22
      : kind.linear || kind.trace
        ? 240
        : kind.unstable
          ? 180
          : kind.sports
            ? 180
            : 90,
    maxMaxBufferLength: myLinks
      ? 30
      : kind.linear || kind.trace
        ? 480
        : kind.unstable
          ? 360
          : kind.sports
            ? 360
            : 200,
    maxBufferSize:
      (myLinks
        ? 80
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
    maxBufferHole: myLinks ? 1.2 : deep ? 1.8 : 0.5,
    // My Links / playlists: assume decent bandwidth — climb to HD fast.
    abrEwmaDefaultEstimate: myLinks ? 3_500_000 : deep ? 250_000 : 800_000,
    abrBandWidthFactor: myLinks ? 0.9 : deep ? 0.45 : 0.8,
    abrBandWidthUpFactor: myLinks ? 0.75 : deep ? 0.25 : 0.6,
    testBandwidth: myLinks || (!kind.unstable && !kind.linear && !kind.trace),
    // Full HD on My Links / playlists. Soft cap only on heavy catalog sports.
    maxBitrate: myLinks ? null : deep ? 1_200_000 : null,
    preferStartLevel: myLinks ? -1 : 0,
    capLevelToPlayerSize: Boolean(!myLinks && deep),
    capLevelOnFPSDrop: Boolean(!myLinks && deep),
  };
}

export function deepenLiveBufferTargets(
  profile: LivePlaybackDeviceProfile,
  kind: LiveChannelKind = {},
): Pick<LiveHlsTuning, "maxBufferLength" | "maxMaxBufferLength" | "maxBufferSize"> {
  const tv = profile === "tv";
  const deep = Boolean(
    kind.linear || kind.sports || kind.trace || kind.unstable,
  );
  const myLinks = Boolean(kind.myLinks);
  if (tv) {
    return {
      maxBufferLength: myLinks
        ? 20
        : deep
          ? 360
          : 220,
      maxMaxBufferLength: myLinks
        ? 26
        : deep
          ? 600
          : 400,
      maxBufferSize: (myLinks ? 72 : deep ? 320 : 200) * 1000 * 1000,
    };
  }
  return {
    maxBufferLength: myLinks
      ? 20
      : kind.linear || kind.trace
        ? 420
        : kind.sports
          ? 360
          : 200,
    maxMaxBufferLength: myLinks
      ? 28
      : kind.linear || kind.trace
        ? 720
        : kind.sports
          ? 600
          : 360,
    maxBufferSize:
      (myLinks
        ? 96
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

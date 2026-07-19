import { describe, expect, it } from "vitest";
import {
  BEHIND_LIVE_LAG_SEC,
  buildLiveHlsTuning,
  capLevelIndexForBitrate,
  clampSeekTime,
  deepenLiveBufferTargets,
  getSeekableWindow,
  resolveDeviceProfile,
  shouldAutoSnapToLive,
  shouldMarkBehindLive,
} from "./live-playback-policy";

function fakeMedia(opts: {
  currentTime?: number;
  seekable?: Array<[number, number]>;
  buffered?: Array<[number, number]>;
}): HTMLMediaElement {
  const seekable = opts.seekable ?? [];
  const buffered = opts.buffered ?? [];
  const range = (ranges: Array<[number, number]>) => ({
    length: ranges.length,
    start: (i: number) => ranges[i]![0],
    end: (i: number) => ranges[i]![1],
  });
  return {
    currentTime: opts.currentTime ?? 100,
    seekable: range(seekable),
    buffered: range(buffered),
  } as unknown as HTMLMediaElement;
}

describe("live playback policy — no auto snap", () => {
  it("never auto-snaps to live for stall / recover / waiting paths", () => {
    expect(shouldAutoSnapToLive("buffer_stalled")).toBe(false);
    expect(shouldAutoSnapToLive("buffer_seek_hole")).toBe(false);
    expect(shouldAutoSnapToLive("media_error_recover")).toBe(false);
    expect(shouldAutoSnapToLive("waiting_timeout")).toBe(false);
    expect(shouldAutoSnapToLive("level_switched")).toBe(false);
    expect(shouldAutoSnapToLive("canplay")).toBe(false);
    expect(shouldAutoSnapToLive("frag_loaded")).toBe(false);
  });

  it("marks behind-live from intentional latency threshold", () => {
    expect(shouldMarkBehindLive(BEHIND_LIVE_LAG_SEC - 1)).toBe(false);
    expect(shouldMarkBehindLive(BEHIND_LIVE_LAG_SEC)).toBe(true);
    expect(shouldMarkBehindLive(45)).toBe(true);
  });
});

describe("live playback policy — device profiles", () => {
  it("resolves tv vs default", () => {
    expect(resolveDeviceProfile(true)).toBe("tv");
    expect(resolveDeviceProfile(false)).toBe("default");
  });

  it("keeps phone/PC ~30–60s behind with a deep preload buffer", () => {
    const t = buildLiveHlsTuning("default", { sports: true });
    expect(t.liveSyncDuration).toBeGreaterThanOrEqual(30);
    expect(t.liveSyncDuration).toBeLessThanOrEqual(60);
    expect(t.liveMaxLatencyDuration).toBeGreaterThan(t.liveSyncDuration * 5);
    expect(t.maxBufferLength).toBeGreaterThanOrEqual(120);
    expect(t.maxBitrate).toBeTypeOf("number");
    expect(t.maxBitrate!).toBeLessThanOrEqual(1_800_000);
    expect(t).not.toHaveProperty("liveSyncDurationCount");
    expect(t).not.toHaveProperty("liveMaxLatencyDurationCount");
  });

  it("applies a deeper, bitrate-capped TV profile", () => {
    const t = buildLiveHlsTuning("tv", { trace: true });
    expect(t.liveSyncDuration).toBeGreaterThanOrEqual(55);
    expect(t.liveMaxLatencyDuration).toBeGreaterThan(t.liveSyncDuration * 8);
    expect(t.maxBufferLength).toBeGreaterThanOrEqual(180);
    expect(t.maxBitrate).toBeTypeOf("number");
    expect(t.maxBitrate!).toBeLessThanOrEqual(2_500_000);
    expect(t.abrBandWidthFactor).toBeLessThan(0.55);
    expect(t.capLevelOnFPSDrop).toBe(true);
    expect(t.testBandwidth).toBe(false);
    expect(t).not.toHaveProperty("liveSyncDurationCount");
    expect(t).not.toHaveProperty("liveMaxLatencyDurationCount");
  });

  it("keeps My Links / staff picks / My Playlist near the live edge", () => {
    const t = buildLiveHlsTuning("default", {
      myLinks: true,
      privatePlaylist: true,
      sports: true,
    });
    // Ad-site style — near tip with enough cushion for slow IP CDNs.
    expect(t.liveSyncDuration).toBeGreaterThanOrEqual(10);
    expect(t.liveSyncDuration).toBeLessThanOrEqual(16);
    expect(t.liveMaxLatencyDuration).toBeGreaterThan(t.liveSyncDuration * 2);
    expect(t.maxBufferLength).toBeGreaterThanOrEqual(16);
    expect(t.maxBufferLength).toBeLessThanOrEqual(28);
  });

  it("does not treat privatePlaylist alone as deep sports buffering", () => {
    // Callers should set myLinks for playlists; privatePlaylist alone must not
    // force 48s sync / huge buffers.
    const orphan = buildLiveHlsTuning("default", { privatePlaylist: true });
    expect(orphan.liveSyncDuration).toBeLessThan(45);
    expect(orphan.maxBufferLength).toBeLessThan(120);
  });

  it("deepens sports preload well past the initial buffer target", () => {
    const start = buildLiveHlsTuning("default", { sports: true });
    const deep = deepenLiveBufferTargets("default", { sports: true });
    expect(deep.maxBufferLength).toBeGreaterThan(start.maxBufferLength);
    expect(deep.maxBufferLength).toBeGreaterThanOrEqual(300);
  });

  it("allows full HD ABR on My Links (ad-site path)", () => {
    const t = buildLiveHlsTuning("default", { myLinks: true });
    expect(t.maxBitrate).toBeNull();
    expect(t.preferStartLevel).toBeLessThan(0);
    expect(t.abrEwmaDefaultEstimate).toBeGreaterThanOrEqual(2_000_000);
  });

  it("caps ABR levels to the TV bitrate ceiling", () => {
    const levels = [
      { bitrate: 400_000 },
      { bitrate: 1_200_000 },
      { bitrate: 2_000_000 },
      { bitrate: 4_500_000 },
    ];
    expect(capLevelIndexForBitrate(levels, 1_200_000)).toBe(1);
    expect(capLevelIndexForBitrate(levels, null)).toBe(3);
    expect(capLevelIndexForBitrate([], 2_000_000)).toBe(-1);
  });

  it("keeps My Links from tip-chasing (stutter loop)", () => {
    const t = buildLiveHlsTuning("default", {
      myLinks: true,
      sports: true,
      unstable: true,
    });
    expect(t.liveSyncDuration).toBeLessThanOrEqual(16);
    expect(t.liveMaxLatencyDuration).toBeGreaterThanOrEqual(40);
  });
});

describe("live playback policy — DVR seek window", () => {
  it("clamps seeks into the seekable window", () => {
    const el = fakeMedia({
      currentTime: 200,
      seekable: [[120, 260]],
    });
    expect(clampSeekTime(el, 50)).toBeGreaterThanOrEqual(120);
    expect(clampSeekTime(el, 400)).toBeLessThanOrEqual(260);
    expect(clampSeekTime(el, 200)).toBeCloseTo(200, 0);
  });

  it("falls back to buffered when seekable is empty", () => {
    const el = fakeMedia({
      currentTime: 50,
      seekable: [],
      buffered: [[10, 80]],
    });
    const win = getSeekableWindow(el);
    expect(win).toEqual({ start: 10, end: 80 });
    expect(clampSeekTime(el, 5)).toBeGreaterThanOrEqual(10);
  });
});

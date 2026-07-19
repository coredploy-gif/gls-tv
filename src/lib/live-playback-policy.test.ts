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
    expect(t.maxBitrate).toBeNull();
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

  it("keeps My Links / staff picks near the live edge with strong preload", () => {
    const t = buildLiveHlsTuning("default", {
      myLinks: true,
      sports: true,
    });
    expect(t.liveSyncDuration).toBeLessThanOrEqual(10);
    expect(t.liveMaxLatencyDuration).toBeGreaterThan(t.liveSyncDuration);
    // Must stay inside short CDN windows (~20–40s) or fragments thrash/abort.
    expect(t.maxBufferLength).toBeGreaterThanOrEqual(12);
    expect(t.maxBufferLength).toBeLessThanOrEqual(24);
  });

  it("deepens sports preload well past the initial buffer target", () => {
    const start = buildLiveHlsTuning("default", { sports: true });
    const deep = deepenLiveBufferTargets("default", { sports: true });
    expect(deep.maxBufferLength).toBeGreaterThan(start.maxBufferLength);
    expect(deep.maxBufferLength).toBeGreaterThanOrEqual(300);
  });

  it("does not deepen My Links past a short live window", () => {
    const deep = deepenLiveBufferTargets("default", { myLinks: true });
    expect(deep.maxBufferLength).toBeLessThanOrEqual(28);
  });

  it("caps ABR levels to the TV bitrate ceiling", () => {
    const levels = [
      { bitrate: 400_000 },
      { bitrate: 1_200_000 },
      { bitrate: 2_000_000 },
      { bitrate: 4_500_000 },
    ];
    expect(capLevelIndexForBitrate(levels, 2_200_000)).toBe(2);
    expect(capLevelIndexForBitrate(levels, null)).toBe(3);
    expect(capLevelIndexForBitrate([], 2_000_000)).toBe(-1);
  });

  it("keeps My Links near the live edge to avoid black screens", () => {
    const t = buildLiveHlsTuning("default", {
      myLinks: true,
      sports: true,
      unstable: true,
    });
    expect(t.liveSyncDuration).toBeLessThanOrEqual(10);
    expect(t.liveMaxLatencyDuration).toBeLessThanOrEqual(60);
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

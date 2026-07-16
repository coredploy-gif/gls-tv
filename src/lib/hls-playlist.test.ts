import { describe, expect, it } from "vitest";
import { rewriteHlsPlaylist } from "./hls-playlist";

describe("HLS playlist rewriting", () => {
  it("rewrites variants, media segments, and quoted key URIs", () => {
    const input = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="../keys/live.key"',
      "#EXT-X-STREAM-INF:BANDWIDTH=800000",
      "variants/low.m3u8",
      "#EXTINF:6,",
      "segments/part-1.ts",
    ].join("\n");

    const rewritten = rewriteHlsPlaylist(
      input,
      "https://media.example/live/master.m3u8",
      (url) => `/relay?target=${encodeURIComponent(url)}`,
    );

    expect(rewritten).toContain(
      'URI="/relay?target=https%3A%2F%2Fmedia.example%2Fkeys%2Flive.key"',
    );
    expect(rewritten).toContain(
      "/relay?target=https%3A%2F%2Fmedia.example%2Flive%2Fvariants%2Flow.m3u8",
    );
    expect(rewritten).toContain(
      "/relay?target=https%3A%2F%2Fmedia.example%2Flive%2Fsegments%2Fpart-1.ts",
    );
  });
});

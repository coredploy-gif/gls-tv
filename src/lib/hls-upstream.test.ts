import { describe, expect, it } from "vitest";
import { hlsUpstreamHeaders } from "./hls-upstream";

describe("HLS upstream headers", () => {
  it("preserves byte ranges for partial media requests", () => {
    expect(
      hlsUpstreamHeaders(
        "https://media.example/live/segment.ts",
        "bytes=100-999",
      ),
    ).toMatchObject({
      Range: "bytes=100-999",
      Referer: "https://media.example/",
    });
  });

  it("uses Shoof referer for Alkass GCP hosts", () => {
    expect(
      hlsUpstreamHeaders(
        "https://liveeu-gcp.alkassdigital.net/alkass1-p/main.m3u8",
        null,
      ),
    ).toMatchObject({
      Referer: "https://shoof.alkass.net/",
    });
  });
});

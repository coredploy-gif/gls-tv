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
});

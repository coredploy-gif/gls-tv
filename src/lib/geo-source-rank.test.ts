import { describe, expect, it } from "vitest";
import { rankSourcesForCountry, requestCountry } from "@/lib/geo-source-rank";
import type { MediaSource } from "@/data/types";

describe("geo-source-rank", () => {
  it("reads vercel country header", () => {
    const h = new Headers({ "x-vercel-ip-country": "za" });
    expect(requestCountry(h)).toBe("ZA");
  });

  it("prefers country-tagged mirrors", () => {
    const sources: MediaSource[] = [
      { url: "https://a/world.m3u8", quality: "Auto", format: "hls", geo_regions: "WORLD", priority: 1 },
      { url: "https://b/za.m3u8", quality: "Auto", format: "hls", geo_regions: "ZA", priority: 5 },
    ];
    const ranked = rankSourcesForCountry(sources, "ZA");
    expect(ranked[0].url).toContain("za.m3u8");
  });
});

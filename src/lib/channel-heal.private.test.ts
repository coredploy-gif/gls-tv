import { describe, expect, it } from "vitest";
import {
  healPackFor,
  healPrivatePlaylistSources,
  isFragileHost,
  primaryPrivateHealUrl,
} from "@/lib/channel-heal";

describe("private playlist open heals", () => {
  it("exposes FTA packs for SABC / LN24 / Hope / WildEarth", () => {
    expect(healPackFor("sabc3-za-sd", "SABC 3")?.[0]?.url).toContain(
      "mangomolo.com",
    );
    expect(healPackFor("ln24-sa", "LN24")?.[0]?.url).toContain("ln24");
    expect(healPackFor("hope-channel-africa", "Hope Channel")?.[0]?.url).toContain(
      "jstre.am",
    );
    expect(healPackFor("wildearth", "WildEarth")?.[0]?.url).toContain("amagi");
  });

  it("does not swap SABC 1/2/3 onto SABC News", () => {
    for (const [slug, title] of [
      ["sabc-1", "SABC 1"],
      ["sabc1-za-sd", "SABC 1"],
      ["sabc-2", "SABC 2"],
      ["sabc-3", "SABC 3"],
    ] as const) {
      const pack = healPackFor(slug, title) || [];
      expect(pack.some((s) => /\/news\//i.test(s.url))).toBe(false);
      expect(pack.some((s) => /ln24/i.test(s.url))).toBe(false);
      expect(pack[0]?.url).toMatch(/mangomolo\.com/);
    }
  });

  it("strips sister News URLs from healed SABC 1 sources", () => {
    const { sources } = healPrivatePlaylistSources("sabc-1", "SABC 1", [
      {
        url: "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8",
        quality: "Auto",
        format: "hls",
        priority: 1,
      },
    ]);
    expect(sources.every((s) => !/\/news\//i.test(s.url))).toBe(true);
    expect(sources[0]?.url).toMatch(/sabc1/);
  });

  it("does not invent pay ESPN / TSN numbered remaps", () => {
    expect(healPackFor("espn-br-sd", "ESPN")).toBeNull();
    expect(healPackFor("tsn1-ca-sd", "TSN1")).toBeNull();
    expect(primaryPrivateHealUrl("tsn1-ca-sd", "TSN1")).toBeNull();
    expect(healPackFor("espn8theocho-us-espn8theochohd", "ESPN8 The Ocho")?.[0]
      ?.url).toContain("ESPNTheOcho");
  });

  it("marks nghk and sinalmycn as fragile", () => {
    expect(isFragileHost("https://nl1.nghk.ai/AS1/index.m3u8")).toBe(true);
    expect(
      isFragileHost("https://stm.sinalmycn.com/20000/video.m3u8?token=x"),
    ).toBe(true);
  });

  it("merges Afrobeats open mirror ahead of a sticky CDN", () => {
    const { sources, tags } = healPrivatePlaylistSources(
      "itvafrobeatsmusic-ca-hd",
      "iTV Afrobeats Music",
      [
        {
          url: "https://ca1.buximedia.com/itv/afrobeats/tracks-v1a1/mono.m3u8",
          quality: "HD",
          format: "hls",
        },
      ],
    );
    expect(sources[0]?.url).toContain("ecable.tv");
    expect(tags).toEqual(expect.arrayContaining(["Healed", "Playable"]));
  });
});

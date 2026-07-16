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

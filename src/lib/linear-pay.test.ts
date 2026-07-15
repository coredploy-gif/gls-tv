import { describe, expect, it } from "vitest";
import { LINEAR_PAY_CATALOG } from "@/data/linear-pay-catalog";
import { healChannelSources } from "@/lib/channel-heal";
import { getChannelBySlug, getSportsChannels } from "@/lib/channels";
import {
  isLinearPayCategory,
  officialLinearPayDestination,
} from "@/lib/linear-pay";

describe("rights-managed linear channels", () => {
  it("keeps every canonical Arena-family card discoverable without streams", () => {
    expect(LINEAR_PAY_CATALOG).toHaveLength(18);
    expect(LINEAR_PAY_CATALOG.every((item) => item.sources.length === 0)).toBe(
      true,
    );
    expect(
      LINEAR_PAY_CATALOG.every((item) =>
        isLinearPayCategory(item.categories),
      ),
    ).toBe(true);

    const sportsSlugs = new Set(getSportsChannels().map((item) => item.slug));
    for (const item of LINEAR_PAY_CATALOG.filter((channel) =>
      channel.categories.includes("Sports"),
    )) {
      expect(sportsSlugs.has(item.slug)).toBe(true);
      expect(getChannelBySlug(item.slug)?.sources).toEqual([]);
    }
  });

  it("uses verified broadcaster destinations, not the unrelated swimwear site", () => {
    expect(officialLinearPayDestination("arena-sport-1").href).toBe(
      "https://www.tvarenasport.com/",
    );
    expect(
      officialLinearPayDestination("arena-sport-1-hr", null, ["hr"]).href,
    ).toBe("https://tvarenasport.hr/");
    expect(officialLinearPayDestination("arena-fight").href).toBe(
      "https://www.arenafighttv.com/",
    );
    expect(officialLinearPayDestination("match-arena").href).toBe(
      "https://matchtv.ru/video/channel/arena",
    );
    expect(officialLinearPayDestination("vivacom-arena").href).toBe(
      "https://www.vivacom.bg/eon-tv/arena",
    );
  });

  it("keeps TeleArena playable while treating TV Central as technical offline", () => {
    const teleArena = healChannelSources({
      slug: "telearena-it",
      title: "TeleArena",
      categories: ["News"],
      sources: [],
    });
    expect(teleArena.sources[0]?.url).toContain(
      "/TeleArena/TeleArena.stream/playlist.m3u8",
    );
    expect(teleArena.tags).toContain("Playable");

    const tvCentral = healChannelSources({
      slug: "tv-central",
      title: "TV Central",
      categories: ["Unavailable"],
      sources: [
        {
          url: "http://147.135.114.221/live.m3u8",
          quality: "Auto",
          format: "hls",
        },
      ],
    });
    expect(tvCentral.sources).toEqual([]);
    expect(tvCentral.tags).not.toContain("Rights");
    expect(isLinearPayCategory(["Unavailable"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { healChannelSources, healPackFor } from "@/lib/channel-heal";
import {
  applyHostRewrites,
  brandHealPack,
  matchHealBrandId,
  VERIFIED_BY_SLUG,
} from "@/lib/heal-registry";

describe("system-wide heal registry", () => {
  it("indexes probed playable + override slugs", () => {
    expect(VERIFIED_BY_SLUG.size).toBeGreaterThan(100);
    expect(VERIFIED_BY_SLUG.get("beinsportsusa-us-sd")?.url).toContain(
      "bein-xtra-bein.amagi.tv",
    );
  });

  it("heals France 24 language packs onto live HTTPS media playlists", () => {
    expect(matchHealBrandId("france24-fr-english", "France 24 English")).toBe(
      "france24",
    );
    const en = healChannelSources({
      slug: "france24-fr-english",
      title: "France 24 English",
      categories: ["News"],
      sources: [
        {
          url: "https://static.france24.com/live/F24_EN_HI_HLS/live_web.m3u8",
          quality: "Auto",
          format: "hls",
        },
      ],
    });
    expect(en.sources[0]?.url).toContain(
      "live.france24.com/hls/live/2037218-b/F24_EN",
    );
    expect(en.sources.length).toBeGreaterThanOrEqual(2);
    expect(en.tags).toEqual(expect.arrayContaining(["Healed", "Playable"]));

    const fr = brandHealPack("france24-fr-french", "France 24 French");
    expect(fr?.sources[0]?.url).toContain("F24_FR");
    expect(fr?.sources[0]?.url).toContain("live.france24.com");
  });

  it("rewrites foxweather-xumo and AccuWeather Network with sister notice", () => {
    const weather = healChannelSources({
      slug: "foxweather-us-sd",
      title: "Fox Weather",
      categories: ["News"],
      sources: [
        {
          url: "https://foxweather-xumo.amagi.tv/playlist.m3u8",
          quality: "Auto",
          format: "hls",
        },
      ],
    });
    expect(weather.sources[0]?.url).toContain("247wlive.foxweather.com");

    const accu = healChannelSources({
      slug: "accuweathernetwork-us-sd",
      title: "AccuWeather Network",
      categories: ["News"],
      sources: [
        {
          url: "http://40.160.24.52/AccuWeather/index.m3u8",
          quality: "Auto",
          format: "hls",
        },
      ],
    });
    expect(accu.sources[0]?.url).toContain("accuweather-plex");
    expect(accu.tags).toContain("SisterFallback");
    expect(accu.notice).toMatch(/AccuWeather Now/i);
  });

  it("heals Alkass / FIFA+ / LiveNOW brand families", () => {
    expect(
      healPackFor("alkassone-qa-sd", "Alkass One")?.[0]?.url,
    ).toContain("alkass1-p");
    expect(
      healPackFor("fifaplus-uk-unitedstates", "FIFA+ United States")?.[0]?.url,
    ).toContain("cloudfront.net");
    expect(
      healPackFor("livenowfromfox-us-sd", "LiveNOW from FOX")?.[0]?.url,
    ).toContain("livenowbyfox");
  });

  it("does not remap Fox Sports 1 onto LiveNOW", () => {
    expect(brandHealPack("foxsports1-us-sd", "Fox Sports 1")).toBeNull();
  });

  it("rewrites static.france24.com onto live HTTPS media", () => {
    const { sources, rewritten } = applyHostRewrites([
      {
        url: "https://static.france24.com/live/F24_AR_HI_HLS/live_web.m3u8",
        quality: "Auto",
        format: "hls",
      },
    ]);
    expect(rewritten).toBe(1);
    expect(sources[0]?.url).toContain("F24_AR_HI_HLS");
    expect(sources[0]?.url).toContain("live.france24.com");
    expect(sources[0]?.url).not.toContain("static.france24.com");
  });

  it("heals beIN Sports USA onto XTRA with sister notice", () => {
    const healed = healChannelSources({
      slug: "beinsportsusa-us-sd",
      title: "beIN Sports USA",
      categories: ["Sports"],
      sources: [
        {
          url: "http://206.212.244.63/bein/index.m3u8",
          quality: "SD",
          format: "hls",
        },
      ],
    });
    expect(healed.sources[0]?.url).toContain("bein-xtra-bein.amagi.tv");
    expect(healed.tags).toContain("SisterFallback");
  });

  it("heals kids FAST brands onto known-good Amagi/Wurl mirrors", () => {
    expect(matchHealBrandId("happykids-us-sd", "HappyKids")).toBe("happykids");
    expect(matchHealBrandId("babysharktv-us-sd", "Baby Shark TV")).toBe(
      "baby-shark",
    );
    expect(
      healPackFor("toongoggles-us-sd", "ToonGoggles")?.[0]?.url,
    ).toContain("amagi.tv");
    expect(
      healPackFor("mrbeanliveaction-uk-english", "Mr Bean Live Action")?.[0]
        ?.url,
    ).toContain("mrbeanpopupcc");
    expect(VERIFIED_BY_SLUG.get("babysharktv-us-sd")?.url).toContain("wurl.tv");
  });
});

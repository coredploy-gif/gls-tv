import { describe, expect, it } from "vitest";
import { isExcludedBuiltinChannel } from "@/lib/builtin-catalog-policy";
import {
  healChannelSources,
  healPrivatePlaylistSources,
  primaryPrivateHealUrl,
} from "@/lib/channel-heal";
import { getAllChannels, getChannelBySlug } from "@/lib/channels";
import { channelRowToCatalog, mineWatchHref } from "@/lib/playlists";

describe("built-in catalog exclusions", () => {
  it.each([
    ["tsn1-ca-sd", "TSN 1"],
    ["tsn5-ca-sd", "TSN5"],
    ["fox-sports", "FOX Sports"],
    ["foxsports3-ar-sd", "Fox Sports 3"],
    ["fox-sports-1080p-geo-blocked", "FOX Sports (1080p) [Geo-blocked]"],
    ["foxdeportes-us-sd", "Fox Deportes"],
    ["foxsoccerplus-us-sd", "Fox Soccer Plus"],
    ["arenasport10-hr-sd", "Arena Sport 10"],
    ["arena-premium-5", "Arena Premium 5"],
    ["arenafight-rs-sd", "Arena Fight"],
    ["match-arena", "Match! Arena"],
    ["vivacomarena-bg-sd", "Vivacom Arena"],
  ])("excludes %s (%s)", (slug, title) => {
    expect(isExcludedBuiltinChannel(slug, title)).toBe(true);
    expect(getChannelBySlug(slug)).toBeUndefined();
  });

  it("does not leave excluded entries in merged built-in packs", () => {
    expect(
      getAllChannels().some((item) =>
        isExcludedBuiltinChannel(item.slug, item.title),
      ),
    ).toBe(false);
  });

  it("preserves the distinct TeleArena public channel", () => {
    expect(isExcludedBuiltinChannel("telearena-it", "TeleArena")).toBe(false);
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
  });

  it("merges channel overrides without dropping catalog mirrors", () => {
    const hells = getChannelBySlug("gordonramsayshellskitchen-us-sd");
    expect(hells?.sources[0]?.url).toContain("tubi.video");
    expect(hells?.sources.some((s) => /jmp2\.uk/.test(s.url))).toBe(true);
    expect(hells?.sources.length).toBeGreaterThan(1);

    const bbc = getChannelBySlug("bbcfood-us-sd");
    expect(bbc?.sources[0]?.url).toContain("d1e9r0b71zfwk7.cloudfront.net");
    expect(bbc?.sources.some((s) => /stitcher/.test(s.url))).toBe(true);
  });
});

describe("owner-scoped playlist channels", () => {
  it("renders an imported channel through its persisted channel id", () => {
    const channel = channelRowToCatalog({
      id: "8a94349c-609d-4800-a881-b7c80b7f1f7e",
      playlist_id: "77e3191c-111c-43ec-8f4f-7010bcdbd82b",
      user_id: "5a554ebf-22a7-48d6-8863-0bb5b47974a1",
      slug: "authorized-example",
      title: "Authorized Example",
      description: "",
      poster: "",
      backdrop: "",
      categories: ["Sports"],
      countries: ["za"],
      tvg_id: null,
      quality: "Auto",
      format: "hls",
      sort_order: 0,
    });

    expect(channel.id).toBe("user-8a94349c-609d-4800-a881-b7c80b7f1f7e");
    expect(channel.sources[0]?.url).toBe(
      "/api/hls?channelId=8a94349c-609d-4800-a881-b7c80b7f1f7e",
    );
    expect(mineWatchHref(channel.id.replace(/^user-/, ""))).toBe(
      "/watch/mine/8a94349c-609d-4800-a881-b7c80b7f1f7e",
    );
  });

  it("heals Trace+ playlist sources onto Amagi mirrors first", () => {
    const channel = channelRowToCatalog({
      id: "a1b2c3d4-609d-4800-a881-b7c80b7f1f7e",
      playlist_id: "77e3191c-111c-43ec-8f4f-7010bcdbd82b",
      user_id: "5a554ebf-22a7-48d6-8863-0bb5b47974a1",
      slug: "trace-urban-sa",
      title: "Trace Urban Southern Africa",
      description: "",
      poster: "",
      backdrop: "",
      categories: ["Music"],
      countries: ["za"],
      tvg_id: null,
      stream_url: "https://channels.trace.plus/Traceprod/URBAN_SA_hd/index.m3u8",
      quality: "HD",
      format: "hls",
      sort_order: 0,
    });

    expect(channel.sources[0]?.url).toContain("amagi.tv");
    expect(channel.title).toBe("Trace Urban Southern Africa");
    expect(channel.description).toMatch(/Switching to Trace Urban/i);
    expect(channel.categories).toEqual(
      expect.arrayContaining([
        "Healed",
        "Playable",
        "My Playlist",
        "TraceUrbanFallback",
      ]),
    );
  });

  it("heals open FTA packs on private playlists without clearing Arena URLs", () => {
    const sabc = channelRowToCatalog({
      id: "b2c3d4e5-609d-4800-a881-b7c80b7f1f7e",
      playlist_id: "77e3191c-111c-43ec-8f4f-7010bcdbd82b",
      user_id: "5a554ebf-22a7-48d6-8863-0bb5b47974a1",
      slug: "sabc1-za-sd",
      title: "SABC 1",
      description: "",
      poster: "",
      backdrop: "",
      categories: ["Entertainment"],
      countries: ["za"],
      tvg_id: null,
      stream_url: "https://nl1.nghk.ai/SABC1/index.m3u8",
      quality: "HD",
      format: "hls",
      sort_order: 0,
    });
    expect(sabc.sources[0]?.url).toContain("mangomolo.com");
    expect(sabc.categories).toEqual(
      expect.arrayContaining(["Healed", "Playable", "Geo"]),
    );

    const arena = healPrivatePlaylistSources(
      "arenasport1-hr-sd",
      "Arena Sport 1",
      [
        {
          url: "https://nl1.nghk.ai/AS1HRHD/index.m3u8",
          quality: "HD",
          format: "hls",
          label: "browser-direct",
        },
      ],
    );
    expect(arena.sources.some((s) => /nghk\.ai/.test(s.url))).toBe(true);
    expect(arena.tags).toEqual(
      expect.arrayContaining(["LinearPay", "Rights"]),
    );
    expect(primaryPrivateHealUrl("arenasport1-hr-sd", "Arena Sport 1")).toBeNull();
  });

  it("maps beIN Sports USA playlist rows onto curated XTRA FAST", () => {
    const channel = channelRowToCatalog({
      id: "c3d4e5f6-609d-4800-a881-b7c80b7f1f7e",
      playlist_id: "77e3191c-111c-43ec-8f4f-7010bcdbd82b",
      user_id: "5a554ebf-22a7-48d6-8863-0bb5b47974a1",
      slug: "beinsportsusa-us-sd",
      title: "beIN Sports USA",
      description: "",
      poster: "",
      backdrop: "",
      categories: ["Sports"],
      countries: ["us"],
      tvg_id: null,
      stream_url: "http://23.237.104.106:8080/USA_BEIN/index.m3u8",
      quality: "HD",
      format: "hls",
      sort_order: 0,
    });
    expect(channel.sources[0]?.url).toContain("bein-xtra-bein.amagi.tv");
    expect(channel.categories).toEqual(
      expect.arrayContaining(["Healed", "Playable"]),
    );
  });

  it("demotes raw-IP sources but keeps them as last resort", () => {
    const healed = healPrivatePlaylistSources("bridge-ru-sd", "BRIDGE", [
      {
        url: "http://31.148.48.15/Bridge_TV/index.m3u8",
        quality: "Auto",
        format: "hls",
        label: "browser-direct",
      },
      {
        url: "/api/hls?channelId=abc",
        quality: "Auto",
        format: "hls",
        label: "secure-relay",
      },
    ]);
    expect(healed.sources[0]?.label).toBe("secure-relay");
    expect(healed.sources.at(-1)?.url).toContain("31.148.48.15");
    expect(healed.tags).toContain("ProxyOk");
  });
});

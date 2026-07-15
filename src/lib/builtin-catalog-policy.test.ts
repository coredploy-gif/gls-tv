import { describe, expect, it } from "vitest";
import { isExcludedBuiltinChannel } from "@/lib/builtin-catalog-policy";
import { healChannelSources } from "@/lib/channel-heal";
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
});

import { describe, expect, it } from "vitest";
import { parseM3uDetailed } from "./iptv";

describe("parseM3uDetailed", () => {
  it("handles BOM, CRLF, directives, case-insensitive unquoted attributes and relative URLs", () => {
    const result = parseM3uDetailed(
      '\uFEFF#EXTM3U\r\n#extinf:-1 TVG-ID=News.za tvg-logo="../logo.png" GROUP-TITLE=News,News HD\r\n#EXTVLCOPT:http-referrer=x\r\nstreams/news.m3u8\r\n',
      { baseUrl: "https://media.example.test/lists/main.m3u" },
    );
    expect(result.stats).toMatchObject({
      parsed: 1,
      invalid: 0,
      kind: "channel-list",
    });
    expect(result.channels[0].sources[0].url).toBe(
      "https://media.example.test/lists/streams/news.m3u8",
    );
    expect(result.channels[0].poster).toBe(
      "https://media.example.test/logo.png",
    );
    expect(result.channels[0].countries).toEqual(["za"]);
  });

  it("rejects single-stream HLS manifests by default", () => {
    const master = parseM3uDetailed(
      "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n720.m3u8",
      { baseUrl: "https://example.test/master.m3u8" },
    );
    const media = parseM3uDetailed(
      "#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts",
      { baseUrl: "https://example.test/live.m3u8" },
    );
    expect(master.stats.kind).toBe("hls-master");
    expect(media.stats.kind).toBe("hls-media");
    expect(master.channels).toEqual([]);
    expect(media.channels).toEqual([]);
  });

  it("wraps single-stream HLS manifests when singleStreamUrl is set", () => {
    const stream =
      "https://jmp2.uk/rok-0597d2a4b388b1497a9bf48812e5d070.m3u8";
    const master = parseM3uDetailed(
      "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n720.m3u8",
      {
        baseUrl: "https://aka-live.delivery.roku.com/out/v1/live.m3u8",
        singleStreamUrl: stream,
      },
    );
    expect(master.stats).toMatchObject({ kind: "hls-master", parsed: 1, invalid: 0 });
    expect(master.channels).toHaveLength(1);
    expect(master.channels[0].sources[0].url).toBe(stream);
    expect(master.channels[0].sources[0].format).toBe("hls");
    expect(master.channels[0].title.toLowerCase()).toContain("rok");
  });

  it("validates URLs, deduplicates deterministically and reports truncation", () => {
    const result = parseM3uDetailed(
      [
        "#EXTM3U",
        '#EXTINF:-1 tvg-id="a",One',
        "https://example.test/one.m3u8",
        '#EXTINF:-1 tvg-id="a",One duplicate',
        "https://example.test/one.m3u8",
        "#EXTINF:-1,Invalid",
        "javascript:alert(1)",
        "#EXTINF:-1,Two",
        "https://example.test/two.m3u8",
      ].join("\n"),
      { maxChannels: 1 },
    );
    expect(result.stats).toMatchObject({
      parsed: 1,
      duplicates: 1,
      invalid: 1,
      truncated: 1,
    });
    expect(result.channels[0].title).toBe("One");
  });
});

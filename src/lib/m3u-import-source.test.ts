import { describe, expect, it, vi } from "vitest";
import {
  fetchAndParseM3uImport,
  m3uImportPreviewErrorMessage,
  shouldSkipM3uBodyDownload,
  singleStreamM3uPreview,
} from "./m3u-import-source";

const GATEWAY = "http://103.253.18.58:8000/play/a03o";

describe("shouldSkipM3uBodyDownload", () => {
  it("skips body download for IPTV /play/ gateways and .m3u8 leaves", () => {
    expect(shouldSkipM3uBodyDownload(GATEWAY)).toBe(true);
    expect(shouldSkipM3uBodyDownload("http://1.2.3.4:8080/live/u/p/1")).toBe(
      true,
    );
    expect(
      shouldSkipM3uBodyDownload("http://40.160.24.55/TSN_5/index.m3u8"),
    ).toBe(true);
  });

  it("still downloads multi-channel .m3u list bodies", () => {
    expect(
      shouldSkipM3uBodyDownload("https://lists.example.org/channels.m3u"),
    ).toBe(false);
  });
});

describe("singleStreamM3uPreview", () => {
  it("returns one HLS channel for the IPTV gateway URL", () => {
    const parsed = singleStreamM3uPreview(GATEWAY);
    expect(parsed.channels).toHaveLength(1);
    expect(parsed.stats.kind).toBe("hls-media");
    expect(parsed.channels[0].sources[0]).toMatchObject({
      url: GATEWAY,
      format: "hls",
    });
  });
});

describe("fetchAndParseM3uImport", () => {
  it("does not fetch the body for /play/ gateway URLs", async () => {
    const fetchBuffered = vi.fn();
    const validateUrl = vi.fn().mockResolvedValue({});

    const parsed = await fetchAndParseM3uImport(GATEWAY, {
      fetchBuffered,
      validateUrl,
      allowedListHost: () => false,
    });

    expect(fetchBuffered).not.toHaveBeenCalled();
    expect(validateUrl).toHaveBeenCalledWith(GATEWAY);
    expect(parsed.channels).toHaveLength(1);
    expect(parsed.channels[0].sources[0].url).toBe(GATEWAY);
    expect(parsed.stats.kind).toBe("hls-media");
  });

  it("does not fetch the body for individual .m3u8 URLs", async () => {
    const stream = "http://40.160.24.55/TSN_5/index.m3u8";
    const fetchBuffered = vi.fn();
    const validateUrl = vi.fn().mockResolvedValue({});

    const parsed = await fetchAndParseM3uImport(stream, {
      fetchBuffered,
      validateUrl,
    });

    expect(fetchBuffered).not.toHaveBeenCalled();
    expect(validateUrl).toHaveBeenCalledWith(stream);
    expect(parsed.channels).toHaveLength(1);
    expect(parsed.channels[0].sources[0].url).toBe(stream);
    expect(parsed.stats.kind).toBe("hls-media");
  });

  it("rejects oversized multi-channel .m3u downloads (lists need a real body)", async () => {
    const listUrl = "https://lists.example.org/channels.m3u";
    const fetchBuffered = vi
      .fn()
      .mockRejectedValue(new Error("Upstream response is too large"));
    const validateUrl = vi.fn().mockResolvedValue({});

    await expect(
      fetchAndParseM3uImport(listUrl, {
        fetchBuffered,
        validateUrl,
      }),
    ).rejects.toThrow(/too large/);
    expect(validateUrl).not.toHaveBeenCalled();
  });

  it("parses a fetched playlist body for multi-channel .m3u lists", async () => {
    const listUrl = "https://raw.githubusercontent.com/org/repo/main/list.m3u";
    const body = Buffer.from(
      [
        "#EXTM3U",
        "#EXTINF:-1,One",
        "https://cdn.example/one.m3u8",
        "#EXTINF:-1,Two",
        "https://cdn.example/two.m3u8",
      ].join("\n"),
    );
    const fetchBuffered = vi.fn().mockResolvedValue({
      status: 200,
      finalUrl: listUrl,
      headers: {},
      body,
    });
    const validateUrl = vi.fn();
    const allowedListHost = vi.fn().mockReturnValue(true);

    const parsed = await fetchAndParseM3uImport(listUrl, {
      fetchBuffered,
      validateUrl,
      allowedListHost,
    });

    expect(validateUrl).not.toHaveBeenCalled();
    expect(parsed.channels).toHaveLength(2);
    expect(parsed.stats.kind).toBe("channel-list");
    // .m3u is still isIndividualPlaylistUrl → no list-host allowlist gate
    expect(fetchBuffered).toHaveBeenCalledWith(
      listUrl,
      expect.objectContaining({
        allowedHost: undefined,
      }),
    );
  });

  it("applies the list-host allowlist for non-playlist URLs", async () => {
    const listUrl = "https://evil.example/export";
    const fetchBuffered = vi
      .fn()
      .mockRejectedValue(new Error("Host is not allowlisted"));
    const validateUrl = vi.fn();
    const allowedListHost = vi.fn().mockReturnValue(false);

    await expect(
      fetchAndParseM3uImport(listUrl, {
        fetchBuffered,
        validateUrl,
        allowedListHost,
      }),
    ).rejects.toThrow(/Host is not allowlisted/);

    expect(fetchBuffered).toHaveBeenCalledWith(
      listUrl,
      expect.objectContaining({
        allowedHost: allowedListHost,
      }),
    );
    expect(validateUrl).not.toHaveBeenCalled();
  });

  it("does not swallow non-size errors when downloading a .m3u list", async () => {
    const listUrl = "https://lists.example.org/channels.m3u";
    const fetchBuffered = vi
      .fn()
      .mockRejectedValue(new Error("Upstream request timed out"));

    await expect(
      fetchAndParseM3uImport(listUrl, {
        fetchBuffered,
        validateUrl: vi.fn(),
      }),
    ).rejects.toThrow(/timed out/);
  });
});

describe("m3uImportPreviewErrorMessage", () => {
  it("does not claim individual streams must return #EXTM3U", () => {
    const message = m3uImportPreviewErrorMessage(
      GATEWAY,
      "Upstream response is too large",
    );
    expect(message).toContain("Upstream response is too large");
    expect(message).not.toMatch(/#EXTM3U/);
    expect(message).toMatch(/Individual stream URLs/);
  });
});

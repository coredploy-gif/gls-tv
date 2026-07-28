import { describe, expect, it } from "vitest";
import {
  isLikelyIptvStreamPath,
  isRawMpegTsGateway,
} from "@/lib/media-path";

describe("media-path", () => {
  it("detects Astra /play/ continuous MPEG-TS gateways", () => {
    expect(isRawMpegTsGateway("http://103.253.18.58:8000/play/a03o")).toBe(
      true,
    );
    expect(isRawMpegTsGateway("http://example.com/play/token123")).toBe(true);
    expect(isRawMpegTsGateway("https://cdn.example/stream.ts")).toBe(true);
  });

  it("does not treat HLS playlists as raw MPEG-TS", () => {
    expect(
      isRawMpegTsGateway(
        "http://88.212.15.19/live/test_arenasport/playlist.m3u8",
      ),
    ).toBe(false);
    expect(
      isRawMpegTsGateway("http://40.160.24.55/TSN_1/index.m3u8"),
    ).toBe(false);
    expect(isRawMpegTsGateway("http://example.com/live/user/pass/1")).toBe(
      false,
    );
  });

  it("still flags /live/ paths as IPTV stream paths", () => {
    expect(isLikelyIptvStreamPath("/live/user/pass/1")).toBe(true);
    expect(isLikelyIptvStreamPath("/play/a03o")).toBe(true);
  });
});

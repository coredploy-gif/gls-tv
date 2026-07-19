import { describe, expect, it } from "vitest";
import {
  isAllowedMediaHost,
  isIndividualPlaylistUrl,
  isLikelyIptvStreamPath,
  isLikelySingleStreamHlsUrl,
  isPublicIpHostname,
} from "./media-hosts";
import { shouldSkipUnboundedMediaBodyDownload } from "./media-path";

describe("isAllowedMediaHost", () => {
  it("allows jmp2 entry and Roku delivery redirect targets", () => {
    expect(isAllowedMediaHost("jmp2.uk")).toBe(true);
    expect(isAllowedMediaHost("aka-live1050.delivery.roku.com")).toBe(true);
    expect(isAllowedMediaHost("aka-live.delivery.roku.com")).toBe(true);
  });

  it("allows African broadcaster CDNs", () => {
    expect(isAllowedMediaHost("atunwadigital.streamguys1.com")).toBe(true);
    expect(isAllowedMediaHost("wazobiafmlagos951-atunwadigital.streamguys1.com")).toBe(
      true,
    );
    expect(isAllowedMediaHost("mainradiostreaming.zbc.co.zw")).toBe(true);
  });

  it("allows France 24 and Alkass official CDNs for HLS proxy", () => {
    expect(isAllowedMediaHost("live.france24.com")).toBe(true);
    expect(isAllowedMediaHost("static.france24.com")).toBe(true);
    expect(isAllowedMediaHost("liveeu-gcp.alkassdigital.net")).toBe(true);
  });

  it("allows public IP literals used by IPTV http stream endpoints", () => {
    expect(isAllowedMediaHost("103.253.18.58")).toBe(true);
    expect(isAllowedMediaHost("40.160.24.55")).toBe(true);
  });

  it("still rejects private IP literals and unrelated hosts", () => {
    expect(isAllowedMediaHost("10.0.0.5")).toBe(false);
    expect(isAllowedMediaHost("127.0.0.1")).toBe(false);
    expect(isAllowedMediaHost("evil.example")).toBe(false);
    expect(isAllowedMediaHost("github.com")).toBe(false);
  });
});

describe("isPublicIpHostname", () => {
  it("allows public IPv4 literals used by direct HLS endpoints", () => {
    expect(isPublicIpHostname("40.160.24.55")).toBe(true);
    expect(isPublicIpHostname("1.1.1.1")).toBe(true);
  });

  it("rejects private and reserved addresses", () => {
    expect(isPublicIpHostname("10.0.0.5")).toBe(false);
    expect(isPublicIpHostname("127.0.0.1")).toBe(false);
    expect(isPublicIpHostname("192.168.1.1")).toBe(false);
    expect(isPublicIpHostname("169.254.169.254")).toBe(false);
  });

  it("rejects non-IP hostnames", () => {
    expect(isPublicIpHostname("jmp2.uk")).toBe(false);
    expect(isPublicIpHostname("example.com")).toBe(false);
  });
});

describe("isLikelyIptvStreamPath", () => {
  it("matches /play/ and related gateway paths", () => {
    expect(isLikelyIptvStreamPath("/play/a03o")).toBe(true);
    expect(isLikelyIptvStreamPath("/live/user/pass/1")).toBe(true);
    expect(isLikelyIptvStreamPath("/stream/abc")).toBe(true);
    expect(isLikelyIptvStreamPath("/get.php")).toBe(true);
  });

  it("rejects unrelated paths", () => {
    expect(isLikelyIptvStreamPath("/clip.mp4")).toBe(false);
    expect(isLikelyIptvStreamPath("/about")).toBe(false);
  });
});

describe("isIndividualPlaylistUrl", () => {
  it("accepts public-IP and arbitrary-hostname .m3u8 / .m3u paths", () => {
    expect(
      isIndividualPlaylistUrl("http://40.160.24.55/TSN_5/index.m3u8"),
    ).toBe(true);
    expect(
      isIndividualPlaylistUrl(
        "https://cdn.random-public.example/live/master.m3u8?token=1",
      ),
    ).toBe(true);
    expect(
      isIndividualPlaylistUrl("https://lists.example.org/channels.m3u"),
    ).toBe(true);
  });

  it("accepts extensionless IPTV http IP:port /play/ URLs", () => {
    expect(
      isIndividualPlaylistUrl("http://103.253.18.58:8000/play/a03o"),
    ).toBe(true);
  });

  it("rejects non-playlist paths", () => {
    expect(isIndividualPlaylistUrl("https://cdn.example/clip.mp4")).toBe(
      false,
    );
    expect(isIndividualPlaylistUrl("not-a-url")).toBe(false);
  });
});

describe("shouldSkipUnboundedMediaBodyDownload", () => {
  it("skips /play/ and .m3u8 but not multi-channel .m3u lists", () => {
    expect(
      shouldSkipUnboundedMediaBodyDownload(
        "http://103.253.18.58:8000/play/a03o",
      ),
    ).toBe(true);
    expect(
      shouldSkipUnboundedMediaBodyDownload(
        "http://40.160.24.55/TSN_5/index.m3u8",
      ),
    ).toBe(true);
    expect(
      shouldSkipUnboundedMediaBodyDownload(
        "https://lists.example.org/channels.m3u",
      ),
    ).toBe(false);
  });
});

describe("isLikelySingleStreamHlsUrl", () => {
  it("detects .m3u8 single-stream entry URLs", () => {
    expect(
      isLikelySingleStreamHlsUrl("http://40.160.24.55/TSN_5/index.m3u8"),
    ).toBe(true);
    expect(
      isLikelySingleStreamHlsUrl(
        "https://jmp2.uk/rok-0597d2a4b388b1497a9bf48812e5d070.m3u8",
      ),
    ).toBe(true);
  });

  it("does not treat multi-channel .m3u lists as single HLS", () => {
    expect(
      isLikelySingleStreamHlsUrl(
        "https://iptv-org.github.io/iptv/countries/za.m3u",
      ),
    ).toBe(false);
  });
});

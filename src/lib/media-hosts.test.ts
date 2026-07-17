import { describe, expect, it } from "vitest";
import {
  isAllowedMediaHost,
  isLikelySingleStreamHlsUrl,
  isPublicIpHostname,
} from "./media-hosts";

describe("isAllowedMediaHost", () => {
  it("allows jmp2 entry and Roku delivery redirect targets", () => {
    expect(isAllowedMediaHost("jmp2.uk")).toBe(true);
    expect(isAllowedMediaHost("aka-live1050.delivery.roku.com")).toBe(true);
    expect(isAllowedMediaHost("aka-live.delivery.roku.com")).toBe(true);
  });

  it("rejects unrelated hosts", () => {
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

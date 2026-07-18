import { describe, expect, it } from "vitest";
import {
  absoluteStreamUrl,
  castFeedbackForResult,
  isMseCastBlocked,
  resolveCastUrl,
  shouldShowCastControl,
  streamSupportsCast,
} from "@/lib/remote-playback";

describe("remote-playback", () => {
  it("streamSupportsCast gates formats", () => {
    expect(streamSupportsCast("hls")).toBe(true);
    expect(streamSupportsCast("mp4")).toBe(true);
    expect(streamSupportsCast("youtube")).toBe(false);
    expect(streamSupportsCast(undefined)).toBe(false);
  });

  it("shouldShowCastControl matches radio discoverability for live + castUrl", () => {
    expect(shouldShowCastControl("hls")).toBe(true);
    expect(shouldShowCastControl("mp4")).toBe(true);
    expect(shouldShowCastControl("youtube")).toBe(false);
    expect(
      shouldShowCastControl(undefined, "https://cdn.example/live.m3u8"),
    ).toBe(true);
    expect(shouldShowCastControl("youtube", null)).toBe(false);
  });

  it("resolveCastUrl prefers public upstream over session proxy", () => {
    expect(
      resolveCastUrl(
        "/api/hls?url=https%3A%2F%2Fcdn.example%2Flive.m3u8",
        "https://cdn.example/live.m3u8",
      ),
    ).toBe("https://cdn.example/live.m3u8");
  });

  it("resolveCastUrl never returns blob URLs", () => {
    expect(resolveCastUrl("blob:https://app/abc", "https://cdn.example/a.m3u8")).toBe(
      "https://cdn.example/a.m3u8",
    );
    expect(resolveCastUrl("blob:https://app/abc", "blob:https://app/xyz")).toBe(
      null,
    );
  });

  it("resolveCastUrl falls back to proxy path when that is all we have", () => {
    expect(resolveCastUrl("/api/hls?url=encoded", "/api/hls?url=encoded")).toBe(
      "/api/hls?url=encoded",
    );
  });

  it("castFeedbackForResult always explains mse-blocked", () => {
    const fb = castFeedbackForResult("mse-blocked", {
      format: "hls",
      castUrl: "https://example.com/live.m3u8",
    });
    expect(fb).not.toBeNull();
    expect(fb!.message.length).toBeGreaterThan(20);
    expect(fb!.copyUrl).toContain("example.com/live.m3u8");
    expect(fb!.message).not.toMatch(/cancel/i);
  });

  it("castFeedbackForResult keeps a message after ok", () => {
    const fb = castFeedbackForResult("ok");
    expect(fb?.message).toMatch(/picker|Cast|AirPlay/i);
  });

  it("castFeedbackForResult stays quiet when user dismisses picker", () => {
    expect(castFeedbackForResult("cancelled")).toBeNull();
    expect(
      castFeedbackForResult("cancelled", {
        format: "hls",
        castUrl: "https://example.com/live.m3u8",
      }),
    ).toBeNull();
  });

  it("castFeedbackForResult distinguishes unavailable vs mse", () => {
    const unavailable = castFeedbackForResult("unavailable", {
      format: "hls",
      castUrl: "https://example.com/live.m3u8",
    });
    expect(unavailable?.message).toMatch(/No Cast device|AirPlay device|Cast menu/i);
    expect(unavailable?.message).not.toMatch(/cancel/i);
    expect(unavailable?.copyUrl).toContain("example.com");

    const mse = castFeedbackForResult("mse-blocked", { format: "hls" });
    expect(mse?.message).toMatch(/HLS|browser|Cast…|AirPlay/i);
  });

  it("absoluteStreamUrl resolves relative paths and rejects blobs", () => {
    expect(absoluteStreamUrl("https://cdn.example/a.m3u8")).toBe(
      "https://cdn.example/a.m3u8",
    );
    expect(absoluteStreamUrl("blob:https://x/y")).toBeNull();
    expect(absoluteStreamUrl("/api/hls?url=x")).toBe("/api/hls?url=x");
  });

  it("isMseCastBlocked treats blob video as blocked for hls", () => {
    const video = {
      src: "blob:https://localhost/abc",
      currentSrc: "blob:https://localhost/abc",
      srcObject: null,
      canPlayType: () => "",
    } as unknown as HTMLVideoElement;
    expect(isMseCastBlocked(video, "hls")).toBe(true);
  });

  it("isMseCastBlocked allows empty check shape for native-capable video", () => {
    const video = {
      src: "https://cdn.example/live.m3u8",
      currentSrc: "https://cdn.example/live.m3u8",
      srcObject: null,
      canPlayType: (type: string) =>
        type.includes("mpegurl") ? "probably" : "",
    } as unknown as HTMLVideoElement;
    // Without Safari UA, native HLS capability alone isn't enough to unblock
    // if we also require isSafariLike — blob-free https src is castable.
    expect(isMseCastBlocked(video, "hls")).toBe(false);
  });
});

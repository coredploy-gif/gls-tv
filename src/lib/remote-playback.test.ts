import { describe, expect, it } from "vitest";
import {
  absoluteStreamUrl,
  castFeedbackForResult,
  streamSupportsCast,
} from "@/lib/remote-playback";

describe("remote-playback", () => {
  it("streamSupportsCast gates formats", () => {
    expect(streamSupportsCast("hls")).toBe(true);
    expect(streamSupportsCast("mp4")).toBe(true);
    expect(streamSupportsCast("youtube")).toBe(false);
    expect(streamSupportsCast(undefined)).toBe(false);
  });

  it("castFeedbackForResult always explains mse-blocked", () => {
    const fb = castFeedbackForResult("mse-blocked", {
      format: "hls",
      castUrl: "https://example.com/live.m3u8",
    });
    expect(fb).not.toBeNull();
    expect(fb!.message.length).toBeGreaterThan(20);
    expect(fb!.copyUrl).toContain("example.com/live.m3u8");
  });

  it("castFeedbackForResult keeps a message after ok", () => {
    const fb = castFeedbackForResult("ok");
    expect(fb?.message).toMatch(/picker|Cast|AirPlay/i);
  });

  it("absoluteStreamUrl resolves relative paths", () => {
    expect(absoluteStreamUrl("https://cdn.example/a.m3u8")).toBe(
      "https://cdn.example/a.m3u8",
    );
  });
});

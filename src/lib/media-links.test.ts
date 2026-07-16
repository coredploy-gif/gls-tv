import { describe, expect, it } from "vitest";
import {
  detectPlayableFormat,
  titleFromMediaUrl,
  validateMediaLinkUrl,
} from "@/lib/media-links";

describe("media-links", () => {
  it("detects jmp2 rok HLS", () => {
    const url =
      "https://jmp2.uk/rok-0597d2a4b388b1497a9bf48812e5d070.m3u8";
    expect(detectPlayableFormat(url)).toBe("hls");
    const v = validateMediaLinkUrl(url, "BBC Food");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("hls");
    expect(v.title).toBe("BBC Food");
  });

  it("detects YouTube and builds embed", () => {
    const v = validateMediaLinkUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(v.ok).toBe(true);
    expect(v.format).toBe("youtube");
    expect(v.embedUrl).toContain("/embed/dQw4w9WgXcQ");
    expect(v.videoId).toBe("dQw4w9WgXcQ");
  });

  it("rejects unsupported formats", () => {
    const v = validateMediaLinkUrl("https://example.com/movie.mkv");
    expect(v.ok).toBe(false);
  });

  it("titles single streams from path when unset", () => {
    expect(
      titleFromMediaUrl(
        "https://jmp2.uk/rok-0597d2a4b388b1497a9bf48812e5d070.m3u8",
        "hls",
      ),
    ).toMatch(/rok/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  detectPlayableFormat,
  extractYouTubeId,
  formatFromContentType,
  isAppMediaPath,
  isEvodHost,
  isTrustedAppMediaUrl,
  mediaLinkPlaySources,
  normalizeEvodUrl,
  normalizeMediaLinkCategory,
  resolveMediaEmbedUrl,
  titleFromMediaUrl,
  USER_MEDIA_DISCLAIMER,
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

  it("builds owned HLS sources with mediaLinkId secure relay", () => {
    const url = "http://40.160.24.55/TSN_1/index.m3u8";
    const sources = mediaLinkPlaySources({
      id: "link-abc",
      url,
      format: "hls",
    });
    expect(sources).toEqual([
      {
        url,
        quality: "Auto",
        format: "hls",
        label: "browser-direct",
      },
      {
        url: "/api/hls?mediaLinkId=link-abc",
        quality: "Auto",
        format: "hls",
        label: "secure-relay",
      },
    ]);
  });

  it("accepts public-IP HTTP HLS for My Links / Staff picks validation", () => {
    const url = "http://40.160.24.55/TSN_5/index.m3u8";
    expect(detectPlayableFormat(url)).toBe("hls");
    const v = validateMediaLinkUrl(url, "TSN 5");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("hls");
    expect(v.title).toBe("TSN 5");
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

  it("parses common YouTube URL forms", () => {
    const id = "dQw4w9WgXcQ";
    const urls = [
      `https://youtu.be/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube.com/watch?feature=share&v=${id}`,
      `https://m.youtube.com/watch?v=${id}`,
    ];
    for (const url of urls) {
      expect(extractYouTubeId(url)).toBe(id);
      expect(detectPlayableFormat(url)).toBe("youtube");
    }
  });

  it("rebuilds embed when stored embed_url is missing", () => {
    expect(
      resolveMediaEmbedUrl({
        format: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embed_url: null,
        video_id: "dQw4w9WgXcQ",
      }),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("normalizes a stored watch URL into /embed/", () => {
    expect(
      resolveMediaEmbedUrl({
        format: "youtube",
        url: "https://youtu.be/dQw4w9WgXcQ",
        embed_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        video_id: null,
      }),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("detects mp4 with query/hash and m4v/mov", () => {
    expect(
      detectPlayableFormat("https://cdn.example.com/clip.mp4?token=abc&x=1"),
    ).toBe("mp4");
    expect(
      detectPlayableFormat("https://cdn.example.com/clip.mp4#t=10"),
    ).toBe("mp4");
    expect(detectPlayableFormat("https://cdn.example.com/a/b.m4v")).toBe(
      "mp4",
    );
    expect(detectPlayableFormat("https://cdn.example.com/a/b.mov")).toBe(
      "mp4",
    );
    expect(detectPlayableFormat("https://cdn.example.com/a/b.webm")).toBe(
      "webm",
    );
  });

  it("detects format query hints without being greedy", () => {
    expect(
      detectPlayableFormat("https://cdn.example.com/asset?format=mp4"),
    ).toBe("mp4");
    expect(
      detectPlayableFormat("https://cdn.example.com/asset?mime=video/webm"),
    ).toBe("webm");
    expect(
      detectPlayableFormat("https://cdn.example.com/asset?type=widget"),
    ).toBeNull();
  });

  it("keeps YouTube ahead of a .mp4 path segment", () => {
    expect(
      detectPlayableFormat(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&foo=bar.mp4",
      ),
    ).toBe("youtube");
  });

  it("detects eVOD / watch.evod.co.za and normalizes launch URL", () => {
    expect(isEvodHost("watch.evod.co.za")).toBe(true);
    expect(isEvodHost("www.evod.co.za")).toBe(true);
    expect(isEvodHost("evod.co.za")).toBe(true);
    expect(isEvodHost("evil-evod.co.za")).toBe(false);

    expect(detectPlayableFormat("https://watch.evod.co.za/")).toBe("evod");
    expect(detectPlayableFormat("https://watch.evod.co.za/live")).toBe("evod");
    expect(normalizeEvodUrl("http://www.evod.co.za/")).toBe(
      "https://watch.evod.co.za/",
    );
    expect(normalizeEvodUrl("https://watch.evod.co.za/foo?x=1")).toBe(
      "https://watch.evod.co.za/foo?x=1",
    );

    const v = validateMediaLinkUrl("https://watch.evod.co.za/", "eExtra");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("evod");
    expect(v.title).toBe("eExtra");
    expect(v.embedUrl).toBe("https://watch.evod.co.za/");
    expect(v.provisional).toBeUndefined();

    expect(
      resolveMediaEmbedUrl({
        format: "evod",
        url: "https://www.evod.co.za/",
        embed_url: null,
      }),
    ).toBe("https://watch.evod.co.za/");
  });

  it("maps Content-Type to formats", () => {
    expect(formatFromContentType("video/mp4")).toBe("mp4");
    expect(formatFromContentType("video/webm; charset=binary")).toBe("webm");
    expect(formatFromContentType("application/vnd.apple.mpegurl")).toBe(
      "hls",
    );
    expect(formatFromContentType("text/html")).toBeNull();
  });

  it("accepts extensionless https as provisional mp4", () => {
    const v = validateMediaLinkUrl("https://cdn.example.com/v/abc123");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("mp4");
    expect(v.provisional).toBe(true);
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

  it("exports a user responsibility disclaimer", () => {
    expect(USER_MEDIA_DISCLAIMER.toLowerCase()).toContain("responsible");
    expect(USER_MEDIA_DISCLAIMER.toLowerCase()).toContain("licensed catalog");
  });

  it("normalizes known folders and keeps custom labels", () => {
    expect(normalizeMediaLinkCategory("movies")).toBe("Movies");
    expect(normalizeMediaLinkCategory("kung fu")).toBe("Kung Fu");
    expect(normalizeMediaLinkCategory("  News  ")).toBe("News");
    expect(normalizeMediaLinkCategory("My Cup Finals")).toBe("My Cup Finals");
    expect(normalizeMediaLinkCategory("")).toBe("Uncategorized");
  });

  it("recognizes safe /media/ paths and rejects traversal", () => {
    expect(isAppMediaPath("/media/sample.mp4")).toBe(true);
    expect(isAppMediaPath("/media/clips/demo.webm")).toBe(true);
    expect(isAppMediaPath("/media")).toBe(false);
    expect(isAppMediaPath("/media/../.env")).toBe(false);
    expect(isAppMediaPath("/other/sample.mp4")).toBe(false);
  });

  it("trusts loopback and request-origin /media/ URLs only", () => {
    expect(
      isTrustedAppMediaUrl("http://127.0.0.1:3010/media/sample.mp4", {
        requestOrigin: "http://127.0.0.1:3010",
      }),
    ).toBe(true);
    expect(
      isTrustedAppMediaUrl("http://localhost:3010/media/sample.mp4"),
    ).toBe(true);
    expect(
      isTrustedAppMediaUrl("https://gls.example/media/sample.mp4", {
        requestOrigin: "https://gls.example",
      }),
    ).toBe(true);
    expect(
      isTrustedAppMediaUrl("http://10.0.0.5/media/sample.mp4"),
    ).toBe(false);
    expect(
      isTrustedAppMediaUrl("http://169.254.169.254/media/sample.mp4"),
    ).toBe(false);
    expect(
      isTrustedAppMediaUrl("http://127.0.0.1:3010/admin/secret"),
    ).toBe(false);
  });
});

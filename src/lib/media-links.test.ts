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
  resolveMediaLinkThumbnail,
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
    // Cleartext must lead with same-origin relay (avoids black screens on https).
    expect(sources).toEqual([
      {
        url: "/api/hls?mediaLinkId=link-abc",
        quality: "Auto",
        format: "hls",
        label: "secure-relay",
      },
      {
        url,
        quality: "Auto",
        format: "hls",
        label: "browser-direct",
      },
    ]);
  });

  it("keeps https browser-direct first when CORS-friendly", () => {
    const url = "https://cdn.example.org/live/index.m3u8";
    const sources = mediaLinkPlaySources({
      id: "link-https",
      url,
      format: "hls",
    });
    expect(sources[0]?.label).toBe("browser-direct");
    expect(sources[1]?.label).toBe("secure-relay");
  });

  it("accepts public-IP HTTP HLS for My Links / Staff picks validation", () => {
    const url = "http://40.160.24.55/TSN_5/index.m3u8";
    expect(detectPlayableFormat(url)).toBe("hls");
    const v = validateMediaLinkUrl(url, "TSN 5");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("hls");
    expect(v.title).toBe("TSN 5");
  });

  it("accepts http IP:port IPTV /play/ gateway URLs as HLS", () => {
    const url = "http://103.253.18.58:8000/play/a03o";
    expect(detectPlayableFormat(url)).toBe("hls");
    const v = validateMediaLinkUrl(url, "Arena");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("hls");
    expect(v.provisional).toBeUndefined();
    expect(v.title).toBe("Arena");
  });

  it("rejects javascript: and other non-http schemes", () => {
    expect(validateMediaLinkUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateMediaLinkUrl("data:text/html,hi").ok).toBe(false);
    expect(validateMediaLinkUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("accepts arbitrary public hostname .m3u8 without catalogue allowlist", () => {
    const url = "https://cdn.random-public.example/live/index.m3u8";
    expect(detectPlayableFormat(url)).toBe("hls");
    const v = validateMediaLinkUrl(url, "Random HLS");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("hls");
  });

  it("accepts .m3u playlist paths as HLS for individual links", () => {
    const url = "https://lists.example.org/pack/channels.m3u";
    expect(detectPlayableFormat(url)).toBe("hls");
    const v = validateMediaLinkUrl(url, "Pack");
    expect(v.ok).toBe(true);
    expect(v.format).toBe("hls");
  });

  it("rejects private and loopback IP literals on the individual path", () => {
    expect(validateMediaLinkUrl("http://10.0.0.5/secret.m3u8").ok).toBe(false);
    expect(validateMediaLinkUrl("http://127.0.0.1/live/index.m3u8").ok).toBe(
      false,
    );
    expect(validateMediaLinkUrl("http://192.168.1.10/a.m3u8").ok).toBe(false);
  });

  it("still allows trusted same-app /media/ on loopback", () => {
    const v = validateMediaLinkUrl(
      "http://127.0.0.1:3010/media/sample.mp4",
    );
    expect(v.ok).toBe(true);
    expect(v.format).toBe("mp4");
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
    ).toBe("Roku stream");
  });

  it("prefers channel folder over index.m3u8 leaf", () => {
    expect(
      titleFromMediaUrl("http://40.160.24.55/TSN_5/index.m3u8", "hls"),
    ).toBe("TSN 5");
    expect(
      validateMediaLinkUrl("http://40.160.24.55/TSN_5/index.m3u8").title,
    ).toBe("TSN 5");
  });

  it("falls back to hostname for root index.m3u8", () => {
    expect(
      titleFromMediaUrl("https://cdn.example.com/index.m3u8", "hls"),
    ).toBe("cdn.example.com");
  });

  it("ignores weak preferred titles like index", () => {
    expect(
      validateMediaLinkUrl("http://40.160.24.55/TSN_1/index.m3u8", "index")
        .title,
    ).toBe("TSN 1");
    expect(
      validateMediaLinkUrl(
        "https://jmp2.uk/rok-0597d2a4b388b1497a9bf48812e5d070.m3u8",
        "playlist",
      ).title,
    ).toBe("Roku stream");
  });

  it("keeps a real preferred title", () => {
    expect(
      validateMediaLinkUrl("http://40.160.24.55/TSN_5/index.m3u8", "TSN 5 Live")
        .title,
    ).toBe("TSN 5 Live");
  });

  it("exports a user responsibility disclaimer", () => {
    expect(USER_MEDIA_DISCLAIMER.toLowerCase()).toContain("responsible");
    expect(USER_MEDIA_DISCLAIMER.toLowerCase()).toContain("licensed catalog");
  });

  it("normalizes known folders and keeps custom labels", () => {
    expect(normalizeMediaLinkCategory("islam")).toBe("Islam");
    expect(normalizeMediaLinkCategory("gospel")).toBe("Gospel");
    expect(normalizeMediaLinkCategory("hindu")).toBe("Hindu");
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

  it("fills sports / live HLS staff pick posters from Unsplash plates", () => {
    const tsn4 = resolveMediaLinkThumbnail({
      title: "TSN 4 _ Sports",
      category: "Sports",
      format: "hls",
      thumbnailUrl: null,
    });
    const tsn5 = resolveMediaLinkThumbnail({
      title: "TSN 5 _ Sports",
      category: "Sports",
      format: "hls",
      thumbnailUrl: null,
    });
    expect(tsn4).toMatch(/images\.unsplash\.com/);
    expect(tsn5).toMatch(/images\.unsplash\.com/);
    expect(tsn4).not.toBe(tsn5);
  });

  it("keeps existing non-logo posters (eVOD) unchanged", () => {
    const evod =
      "https://cdn.example.com/evod/cover-art.jpg";
    expect(
      resolveMediaLinkThumbnail({
        title: "Film on eVOD",
        category: "Movies",
        format: "evod",
        thumbnailUrl: evod,
      }),
    ).toBe(evod);
    expect(
      resolveMediaLinkThumbnail({
        title: "Film on eVOD",
        category: "Movies",
        format: "evod",
        thumbnailUrl: null,
      }),
    ).toBeNull();
  });

  it("seeds HLS validation thumbnails for sports titles", () => {
    const v = validateMediaLinkUrl(
      "http://40.160.24.55/TSN_5/index.m3u8",
      "TSN 5 _ Sports",
    );
    expect(v.ok).toBe(true);
    expect(v.thumbnailUrl).toMatch(/images\.unsplash\.com/);
  });
});

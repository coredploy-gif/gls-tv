export type MediaLinkFormat = "hls" | "youtube" | "vimeo" | "mp4" | "webm";

export type MediaLinkStatus = "active" | "checking" | "dead" | "error";

export type UserMediaLink = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  format: MediaLinkFormat;
  status: MediaLinkStatus;
  thumbnail_url: string | null;
  category: string;
  is_favorite: boolean;
  embed_url: string | null;
  video_id: string | null;
  metadata: Record<string, unknown>;
  last_checked_at: string | null;
  last_watched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminMediaLink = {
  id: string;
  url: string;
  title: string;
  format: MediaLinkFormat;
  category: string;
  thumbnail_url: string | null;
  embed_url: string | null;
  video_id: string | null;
  is_published: boolean;
  notes: string | null;
  created_at: string;
};

/** Shown wherever members add personal playable URLs. */
export const USER_MEDIA_DISCLAIMER =
  "You are responsible for any links you add. Only import media you have the right to watch. User-added links are not part of the GLS licensed catalog.";

/** Default folders for organizing personal My Links (users can also keep custom labels). */
export const MEDIA_LINK_CATEGORIES = [
  "Movies",
  "Sports",
  "News",
  "Live TV",
  "Music",
  "Kids",
  "Food",
  "Series",
  "Other",
  "Uncategorized",
] as const;

export type MediaLinkCategory = (typeof MEDIA_LINK_CATEGORIES)[number];

export function normalizeMediaLinkCategory(raw?: string | null): string {
  const value = (raw || "").trim().slice(0, 60);
  if (!value) return "Uncategorized";
  const match = MEDIA_LINK_CATEGORIES.find(
    (c) => c.toLowerCase() === value.toLowerCase(),
  );
  return match || value;
}

export type MediaLinkValidation = {
  ok: boolean;
  format?: MediaLinkFormat;
  title?: string;
  embedUrl?: string;
  videoId?: string;
  thumbnailUrl?: string;
  error?: string;
};

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
const VIMEO_RE = /(?:vimeo\.com\/)(\d+)/i;

export function extractYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_RE);
  return m?.[1] ?? null;
}

export function extractVimeoId(url: string): string | null {
  const m = url.match(VIMEO_RE);
  return m?.[1] ?? null;
}

/** Only formats we guarantee in the browser / GLS player. */
export function detectPlayableFormat(url: string): MediaLinkFormat | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return null;
  } catch {
    return null;
  }
  if (YOUTUBE_RE.test(url)) return "youtube";
  if (VIMEO_RE.test(url)) return "vimeo";
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/\.mp4(\?|#|$)/i.test(url)) return "mp4";
  if (/\.webm(\?|#|$)/i.test(url)) return "webm";
  return null;
}

export function titleFromMediaUrl(url: string, format: MediaLinkFormat): string {
  if (format === "youtube") {
    const id = extractYouTubeId(url);
    return id ? `YouTube · ${id}` : "YouTube video";
  }
  if (format === "vimeo") {
    const id = extractVimeoId(url);
    return id ? `Vimeo · ${id}` : "Vimeo video";
  }
  try {
    const leaf =
      new URL(url).pathname.split("/").filter(Boolean).pop() || "stream";
    return (
      leaf
        .replace(/\.(m3u8|mp4|webm)$/i, "")
        .replace(/[+_-]+/g, " ")
        .trim()
        .slice(0, 80) || "Imported link"
    );
  } catch {
    return "Imported link";
  }
}

export function embedUrlFor(
  url: string,
  format: MediaLinkFormat,
): string | undefined {
  if (format === "youtube") {
    const id = extractYouTubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : undefined;
  }
  if (format === "vimeo") {
    const id = extractVimeoId(url);
    return id ? `https://player.vimeo.com/video/${id}` : undefined;
  }
  return undefined;
}

export function thumbnailFor(
  format: MediaLinkFormat,
  videoId?: string | null,
): string | undefined {
  if (format === "youtube" && videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  return undefined;
}

export function validateMediaLinkUrl(
  raw: string,
  preferredTitle?: string,
): MediaLinkValidation {
  const url = raw.trim();
  if (!url) {
    return { ok: false, error: "Paste an HTTPS media URL." };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "That doesn’t look like a valid URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Only http(s) links are supported." };
  }

  const format = detectPlayableFormat(url);
  if (!format) {
    return {
      ok: false,
      error:
        "Supported: .m3u8 (HLS), .mp4, .webm, YouTube, or Vimeo. Other types aren’t playable here.",
    };
  }

  const videoId =
    format === "youtube"
      ? extractYouTubeId(url)
      : format === "vimeo"
        ? extractVimeoId(url)
        : null;
  const embedUrl = embedUrlFor(url, format);
  const title = (preferredTitle || "").trim() || titleFromMediaUrl(url, format);

  return {
    ok: true,
    format,
    title: title.slice(0, 200),
    embedUrl,
    videoId: videoId || undefined,
    thumbnailUrl: thumbnailFor(format, videoId),
  };
}

export const MEDIA_FORMAT_META: Record<
  MediaLinkFormat,
  { label: string; hint: string; accent: string }
> = {
  hls: {
    label: "HLS live",
    hint: "jmp2 / Pluto / Roku .m3u8 streams",
    accent: "#5ee29a",
  },
  youtube: {
    label: "YouTube",
    hint: "Public watch or youtu.be links",
    accent: "#ff4444",
  },
  vimeo: {
    label: "Vimeo",
    hint: "Public vimeo.com videos",
    accent: "#1ab7ea",
  },
  mp4: {
    label: "MP4",
    hint: "Direct HTTPS .mp4 file",
    accent: "#e50914",
  },
  webm: {
    label: "WebM",
    hint: "Direct HTTPS .webm file",
    accent: "#c4b5fd",
  },
};

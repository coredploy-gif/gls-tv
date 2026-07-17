import { COPY_FALLBACKS } from "@/lib/copy";

export type MediaLinkFormat =
  | "hls"
  | "youtube"
  | "vimeo"
  | "evod"
  | "mp4"
  | "webm";

/** YouTube / Vimeo — play inside our watch-page iframe. */
export function isMediaIframeFormat(format: MediaLinkFormat): boolean {
  return format === "youtube" || format === "vimeo";
}

/**
 * Official sites that refuse cross-origin framing (e.g. eVOD XFO SAMEORIGIN).
 * Watch UI launches them on the publisher’s origin instead of VideoPlayer.
 */
export function isMediaExternalSiteFormat(format: MediaLinkFormat): boolean {
  return format === "evod";
}

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
export const USER_MEDIA_DISCLAIMER = COPY_FALLBACKS["links.disclaimer"];

/** Default folders for organizing personal My Links (users can also keep custom labels). */
export const MEDIA_LINK_CATEGORIES = [
  "Movies",
  "Kung Fu",
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
  /**
   * URL had no playable extension/hint — client may save; server confirms
   * via Content-Type / media magic bytes on probe.
   */
  provisional?: boolean;
};

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const VIMEO_RE = /(?:vimeo\.com\/)(\d+)/i;

/** Path/query extensions we map into player formats (m4v/mov → native mp4 path). */
const EXT_FORMAT: Record<string, MediaLinkFormat> = {
  m3u8: "hls",
  mp4: "mp4",
  m4v: "mp4",
  mov: "mp4",
  webm: "webm",
};

/** Obvious non-media / unsupported leaves — never treat as provisional direct video. */
const REJECT_LEAF_EXT =
  /\.(html?|php|aspx?|jsp|json|xml|js|mjs|css|jpe?g|png|gif|webp|svg|ico|pdf|zip|txt|md|mkv|avi|wmv|flv|ts|mpg|mpeg)(\?|#|$)/i;

function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube.com") ||
    host.endsWith(".youtube-nocookie.com")
  );
}

/** Official eMedia eVOD OTT (e.tv / eExtra live + catch-up). */
export function isEvodHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  return host === "evod.co.za" || host.endsWith(".evod.co.za");
}

/**
 * Canonical HTTPS eVOD URL for storage / “open on eVOD”.
 * Marketing apex → watch.evod.co.za; path/query on watch.* preserved.
 */
export function normalizeEvodUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/^https?:$/i.test(u.protocol) || !isEvodHost(u.hostname)) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "evod.co.za") {
      return "https://watch.evod.co.za/";
    }
    u.protocol = "https:";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return null;
  }
}

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isYouTubeHost(u.hostname)) return null;

    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0]?.split("?")[0];
      return id && YT_ID_RE.test(id) ? id : null;
    }

    const fromQuery = u.searchParams.get("v");
    if (fromQuery && YT_ID_RE.test(fromQuery)) return fromQuery;

    const parts = u.pathname.split("/").filter(Boolean);
    const kind = (parts[0] || "").toLowerCase();
    if (["embed", "shorts", "live", "v", "e"].includes(kind)) {
      const id = parts[1]?.split("?")[0];
      if (id && YT_ID_RE.test(id)) return id;
    }
  } catch {
    /* fall through */
  }

  // Last-resort path forms (including watch?…&v= out of order already handled above).
  const m = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return m?.[1] ?? null;
}

export function extractVimeoId(url: string): string | null {
  const m = url.match(VIMEO_RE);
  return m?.[1] ?? null;
}

function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Extension on the last path segment (query/hash already stripped by URL.pathname). */
function formatFromPathname(pathname: string): MediaLinkFormat | null {
  const leaf =
    decodePathname(pathname).split("/").filter(Boolean).pop() || "";
  const m = leaf.match(/\.([a-z0-9]+)$/i);
  if (!m) return null;
  return EXT_FORMAT[m[1].toLowerCase()] ?? null;
}

/**
 * Narrow query hints only — e.g. ?format=mp4, ?mime=video/mp4.
 * Avoids treating every `type=` param as media.
 */
function formatFromQueryHints(u: URL): MediaLinkFormat | null {
  const keys = ["format", "ext", "mime", "contentType", "content_type"];
  for (const key of keys) {
    const raw = u.searchParams.get(key);
    if (!raw) continue;
    const v = raw.trim().toLowerCase();
    if (
      v === "m3u8" ||
      v.includes("mpegurl") ||
      v === "application/vnd.apple.mpegurl"
    ) {
      return "hls";
    }
    if (v === "webm" || v === "video/webm") return "webm";
    if (
      v === "mp4" ||
      v === "m4v" ||
      v === "mov" ||
      v.startsWith("video/mp4") ||
      v === "video/quicktime" ||
      v === "video/x-m4v"
    ) {
      return "mp4";
    }
    if (v.startsWith("video/")) return "mp4";
  }
  return null;
}

/** Map a response Content-Type to a playable format (probe / sniff). */
export function formatFromContentType(
  contentType: string | null | undefined,
): MediaLinkFormat | null {
  if (!contentType) return null;
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (!ct) return null;
  if (ct.includes("mpegurl") || ct === "application/vnd.apple.mpegurl") {
    return "hls";
  }
  if (ct === "video/webm") return "webm";
  if (ct.startsWith("video/")) return "mp4";
  return null;
}

/** ftyp… / EBML (WebM) magic in the first bytes of a ranged GET. */
export function formatFromMediaMagic(body: Uint8Array): MediaLinkFormat | null {
  if (body.length >= 8) {
    const box = String.fromCharCode(
      body[4]!,
      body[5]!,
      body[6]!,
      body[7]!,
    );
    if (box === "ftyp") return "mp4";
  }
  // WebM / Matroska EBML header
  if (
    body.length >= 4 &&
    body[0] === 0x1a &&
    body[1] === 0x45 &&
    body[2] === 0xdf &&
    body[3] === 0xa3
  ) {
    return "webm";
  }
  return null;
}

/** Only formats we guarantee in the browser / GLS player. */
export function detectPlayableFormat(url: string): MediaLinkFormat | null {
  let u: URL;
  try {
    u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return null;
  } catch {
    return null;
  }
  // Embed / official OTT hosts always win over generic video extensions in the path.
  if (extractYouTubeId(url)) return "youtube";
  if (VIMEO_RE.test(url)) return "vimeo";
  if (isEvodHost(u.hostname)) return "evod";

  const fromPath = formatFromPathname(u.pathname);
  if (fromPath) return fromPath;

  // Legacy full-string check (covers odd encodings); same ext set.
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/\.webm(\?|#|$)/i.test(url)) return "webm";
  if (/\.(mp4|m4v|mov)(\?|#|$)/i.test(url)) return "mp4";

  return formatFromQueryHints(u);
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
  if (format === "evod") {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "");
      if (path && path !== "") {
        const leaf = path.split("/").filter(Boolean).pop();
        if (leaf && leaf.length > 1) {
          return `eVOD · ${leaf.replace(/[+_-]+/g, " ").slice(0, 60)}`;
        }
      }
    } catch {
      /* fall through */
    }
    return "eVOD · e.tv / eExtra";
  }
  try {
    const leaf =
      new URL(url).pathname.split("/").filter(Boolean).pop() || "stream";
    return (
      leaf
        .replace(/\.(m3u8|mp4|m4v|mov|webm)$/i, "")
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
  if (format === "evod") {
    return normalizeEvodUrl(url) || undefined;
  }
  return undefined;
}

/**
 * Always rebuild YouTube/Vimeo to canonical embed URLs.
 * Never trust a stored watch URL (or odd host) as iframe src — that trips
 * XFO / CSP and shows Chrome's "This content is blocked" interstitial.
 * eVOD returns the official watch URL (external launch — site sends XFO SAMEORIGIN).
 */
export function resolveMediaEmbedUrl(link: {
  format: MediaLinkFormat;
  url: string;
  embed_url?: string | null;
  video_id?: string | null;
}): string | null {
  if (link.format === "youtube") {
    const id =
      (link.video_id && YT_ID_RE.test(link.video_id) && link.video_id) ||
      extractYouTubeId(link.embed_url || "") ||
      extractYouTubeId(link.url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (link.format === "vimeo") {
    const id =
      link.video_id ||
      extractVimeoId(link.embed_url || "") ||
      extractVimeoId(link.url);
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (link.format === "evod") {
    return (
      normalizeEvodUrl(link.embed_url || "") ||
      normalizeEvodUrl(link.url) ||
      null
    );
  }
  const stored = (link.embed_url || "").trim();
  return stored || null;
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

/**
 * True when the URL path is a first-party static file under `/media/…`
 * (no traversal). Host trust is checked separately via {@link isTrustedAppMediaUrl}.
 */
export function isAppMediaPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const segments = decoded.split("/").filter(Boolean);
  if (segments[0] !== "media" || segments.length < 2) return false;
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    return false;
  }
  return true;
}

function hostnameFromOriginOrHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

/** Hostnames treated as this app (request origin, public site URL, loopback). */
export function trustedAppMediaHosts(
  requestOrigin?: string | null,
): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  for (const candidate of [
    requestOrigin,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const host = hostnameFromOriginOrHost(candidate);
    if (host) hosts.add(host);
  }
  return hosts;
}

/**
 * Same-origin (or known app / loopback) URL whose path is under `/media/`.
 * Used to probe via `public/media/…` instead of HTTP-fetching private IPs.
 */
export function isTrustedAppMediaUrl(
  raw: string,
  options?: { requestOrigin?: string | null },
): boolean {
  try {
    const url = new URL(raw.trim());
    if (!/^https?:$/i.test(url.protocol)) return false;
    if (!isAppMediaPath(url.pathname)) return false;
    const hostname = url.hostname
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^\[|\]$/g, "");
    if (!hostname) return false;
    if (hostname.endsWith(".localhost")) return true;
    return trustedAppMediaHosts(options?.requestOrigin).has(hostname);
  } catch {
    return false;
  }
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
    if (REJECT_LEAF_EXT.test(parsed.pathname)) {
      return {
        ok: false,
        error:
          "Supported: .m3u8 (HLS), .mp4 / .m4v / .mov, .webm, YouTube, Vimeo, or eVOD (watch.evod.co.za). Extensionless links are OK if the server returns video/*.",
      };
    }
    // No extension / hint — provisional MP4; server probe must confirm video.
    const title =
      (preferredTitle || "").trim() || titleFromMediaUrl(url, "mp4");
    return {
      ok: true,
      format: "mp4",
      title: title.slice(0, 200),
      provisional: true,
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
  evod: {
    label: "eVOD",
    hint: "Official watch.evod.co.za (e.tv / eExtra) — opens on eVOD",
    accent: "#e85d04",
  },
  mp4: {
    label: "MP4",
    hint: "Direct HTTPS .mp4 / .m4v / .mov (query strings OK; extensionless if Content-Type is video/*)",
    accent: "#e50914",
  },
  webm: {
    label: "WebM",
    hint: "Direct HTTPS .webm file (query strings OK)",
    accent: "#c4b5fd",
  },
};

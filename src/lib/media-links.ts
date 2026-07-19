import type { CatalogItem, MediaSource } from "@/data/types";
import {
  cinematicPosterPlate,
  isCinematicArtUrl,
  isLikelyChannelLogo,
} from "@/lib/artwork";
import { COPY_FALLBACKS } from "@/lib/copy";
import { normalizeReligionSubfolderTag } from "@/lib/religion";

/** Title/category tokens that should prefer soccer/sports Unsplash plates. */
const SPORTS_HINT_RE =
  /\b(sport|sports|tsn|espn|bein|soccer|football|nhl|nba|mlb|mls|tennis|golf|cricket|ufc|mma|racing|f1)\b/i;

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
  "Religion",
  "Islam",
  "Gospel",
  "Hindu",
  "Series",
  "Other",
  "Uncategorized",
] as const;

export type MediaLinkCategory = (typeof MEDIA_LINK_CATEGORIES)[number];

/**
 * Playable sources for My Links / staff picks.
 * HLS mirrors imported playlist channels: try the origin first, then the
 * authenticated same-origin relay keyed by mediaLinkId (skips catalogue host
 * allowlisting after DB ownership checks in /api/hls).
 */
export function mediaLinkPlaySources(link: {
  id: string;
  url: string;
  format: MediaLinkFormat;
}): MediaSource[] {
  const format: "hls" | "mp4" =
    link.format === "mp4" || link.format === "webm" ? "mp4" : "hls";
  if (format !== "hls") {
    return [{ url: link.url, quality: "Auto", format }];
  }
  return [
    {
      url: link.url,
      quality: "Auto",
      format,
      label: "browser-direct",
    },
    {
      url: `/api/hls?mediaLinkId=${encodeURIComponent(link.id)}`,
      quality: "Auto",
      format,
      label: "secure-relay",
    },
  ];
}

/**
 * Staff picks / My Links cards: keep real posters (eVOD, YouTube, curated),
 * but invent varied Unsplash plates for sports / live HLS with empty or logo-only art.
 */
export function resolveMediaLinkThumbnail(input: {
  title: string;
  category?: string | null;
  format?: MediaLinkFormat | null;
  thumbnailUrl?: string | null;
}): string | null {
  const thumb = (input.thumbnailUrl || "").trim() || null;
  if (thumb && isCinematicArtUrl(thumb)) return thumb;
  if (thumb && !isLikelyChannelLogo(thumb)) return thumb;

  const category = (input.category || "").trim();
  const sportsHint = SPORTS_HINT_RE.test(`${category} ${input.title}`);
  const liveHls = input.format === "hls";

  // Do not invent art for eVOD / YouTube / file links — only sports or live HLS.
  if (!sportsHint && !liveHls) return thumb;

  const categories = [category || (liveHls ? "live" : "Other")];
  if (sportsHint) categories.push("sports");

  return cinematicPosterPlate(
    `${input.title}|${category}|${input.format || ""}`,
    categories,
  );
}

export function userMediaLinkToCatalog(link: UserMediaLink): CatalogItem {
  const art = resolveMediaLinkThumbnail({
    title: link.title,
    category: link.category,
    format: link.format,
    thumbnailUrl: link.thumbnail_url,
  });
  const poster =
    art ||
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&h=2400&q=80";
  return {
    id: `media-${link.id}`,
    slug: `media-${link.id}`,
    title: link.title,
    type: link.format === "hls" ? "live" : "movie",
    description: `${link.format.toUpperCase()} · My Links`,
    countries: ["world"],
    categories: ["My Links", link.category, "Playable"],
    languages: ["English"],
    poster,
    backdrop: art
      ? art.replace(/w=\d+&h=\d+/, "w=3840&h=2160")
      : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=3840&h=2160&q=80",
    license: "open_stream",
    isLive: link.format === "hls",
    featured: false,
    sources: mediaLinkPlaySources(link),
  };
}

export function adminMediaLinkToCatalog(link: AdminMediaLink): CatalogItem {
  const art = resolveMediaLinkThumbnail({
    title: link.title,
    category: link.category,
    format: link.format,
    thumbnailUrl: link.thumbnail_url,
  });
  const poster =
    art ||
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&h=2400&q=80";
  return {
    id: `staff-${link.id}`,
    slug: `staff-${link.id}`,
    title: link.title,
    type: link.format === "hls" ? "live" : "movie",
    description: `${link.format.toUpperCase()} · Staff pick`,
    countries: ["world"],
    categories: ["Staff picks", link.category, "Playable"],
    languages: ["English"],
    poster,
    backdrop: art
      ? art.replace(/w=\d+&h=\d+/, "w=3840&h=2160")
      : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=3840&h=2160&q=80",
    license: "open_stream",
    isLive: link.format === "hls",
    featured: false,
    sources: mediaLinkPlaySources(link),
  };
}

export function normalizeMediaLinkCategory(raw?: string | null): string {
  const value = (raw || "").trim().slice(0, 60);
  if (!value) return "Uncategorized";
  const religionTag = normalizeReligionSubfolderTag(value);
  if (religionTag) {
    return religionTag.charAt(0).toUpperCase() + religionTag.slice(1);
  }
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
  m3u: "hls",
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
  if (/\.m3u8?(\?|#|$)/i.test(url)) return "hls";
  if (/\.webm(\?|#|$)/i.test(url)) return "webm";
  if (/\.(mp4|m4v|mov)(\?|#|$)/i.test(url)) return "mp4";

  return formatFromQueryHints(u);
}

/** Strip a known media extension from a path segment. */
function stripMediaExt(segment: string): string {
  return segment.replace(/\.(m3u8?|mp4|m4v|mov|webm)$/i, "");
}

function humanizePathSegment(segment: string): string {
  return stripMediaExt(segment)
    .replace(/[+_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bare playlist leaves / hash filenames that should not become the card title
 * when a better path segment or hostname exists.
 */
export function isWeakMediaLinkTitle(raw?: string | null): boolean {
  const value = (raw || "").trim();
  if (!value) return true;
  const stem = stripMediaExt(value).trim();
  if (!stem) return true;
  const lower = stem.toLowerCase();
  if (
    [
      "index",
      "playlist",
      "master",
      "stream",
      "live",
      "video",
      "media",
      "chunklist",
      "manifest",
      "prog_index",
      "prog index",
      "imported link",
      "imported stream",
    ].includes(lower)
  ) {
    return true;
  }
  // Roku FAST redirect leaves (rok-<hex>)
  if (/^rok-[0-9a-f]{8,}$/i.test(stem)) return true;
  // UUID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      stem,
    )
  ) {
    return true;
  }
  // Long hex / opaque id (no letters outside a-f, or mixed alnum hash ≥16)
  if (/^[0-9a-f]{16,}$/i.test(stem)) return true;
  if (/^[0-9a-z]{20,}$/i.test(stem) && /[0-9]/.test(stem) && /[a-z]/i.test(stem)) {
    return true;
  }
  return false;
}

/**
 * Default display title from a media URL.
 * Prefers a meaningful path segment (e.g. TSN_5 before /index.m3u8), then
 * hostname — never leaves bare "index" / "playlist" / hash leaves.
 */
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
        if (leaf && leaf.length > 1 && !isWeakMediaLinkTitle(leaf)) {
          return `eVOD · ${humanizePathSegment(leaf).slice(0, 60)}`;
        }
      }
    } catch {
      /* fall through */
    }
    return "eVOD · e.tv / eExtra";
  }
  try {
    const u = new URL(url);
    const segments = decodePathname(u.pathname).split("/").filter(Boolean);
    const leafStem = stripMediaExt(segments[segments.length - 1] || "");

    if (/^rok-[0-9a-f]{8,}$/i.test(leafStem)) {
      return "Roku stream";
    }

    // Prefer the last non-weak segment (often the channel folder before index.m3u8).
    for (let i = segments.length - 1; i >= 0; i--) {
      const stem = stripMediaExt(segments[i]!);
      if (!stem || isWeakMediaLinkTitle(stem)) continue;
      const label = humanizePathSegment(stem);
      if (label) return label.slice(0, 80);
    }

    const host = u.hostname.replace(/^www\./i, "").replace(/\.$/, "");
    if (host) return host.slice(0, 80);
    return "Imported link";
  } catch {
    return "Imported link";
  }
}

/** Prefer an explicit title unless it is empty or a weak leaf like "index". */
export function resolveMediaLinkTitle(
  url: string,
  format: MediaLinkFormat,
  preferredTitle?: string | null,
): string {
  const preferred = (preferredTitle || "").trim();
  if (preferred && !isWeakMediaLinkTitle(preferred)) {
    return preferred.slice(0, 200);
  }
  return titleFromMediaUrl(url, format).slice(0, 200);
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
  opts?: { title?: string; category?: string | null },
): string | undefined {
  if (format === "youtube" && videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  if (format === "hls" && opts?.title) {
    return (
      resolveMediaLinkThumbnail({
        title: opts.title,
        category: opts.category,
        format: "hls",
        thumbnailUrl: null,
      }) || undefined
    );
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

/**
 * Browser-safe literal host check (no DNS). Blocks private/reserved IP literals
 * and localhost; DNS rebinding is still handled server-side by validatePublicUrl.
 * Same-app `/media/…` on loopback stays allowed via {@link isTrustedAppMediaUrl}.
 */
export function isBlockedMediaLinkHostname(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p > 255)) {
      return true;
    }
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100))) {
      return true;
    }
    if (a === 203 && b === 0 && parts[2] === 113) return true;
    if (a >= 224) return true;
    return false;
  }
  if (host.includes(":")) {
    if (host === "::" || host === "::1") return true;
    if (
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/i.test(host) ||
      host.startsWith("ff") ||
      host.startsWith("2001:db8:")
    ) {
      return true;
    }
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    return mapped ? isBlockedMediaLinkHostname(mapped[1]!) : false;
  }
  return false;
}

export function validateMediaLinkUrl(
  raw: string,
  preferredTitle?: string,
): MediaLinkValidation {
  const url = raw.trim();
  if (!url) {
    return { ok: false, error: "Paste an http(s) media URL." };
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
  if (
    isBlockedMediaLinkHostname(parsed.hostname) &&
    !isTrustedAppMediaUrl(url)
  ) {
    return {
      ok: false,
      error:
        "Private or local network addresses can’t be saved. Use a public http(s) URL.",
    };
  }

  const format = detectPlayableFormat(url);
  if (!format) {
    if (REJECT_LEAF_EXT.test(parsed.pathname)) {
      return {
        ok: false,
        error:
          "Supported: .m3u / .m3u8 (HLS), .mp4 / .m4v / .mov, .webm, YouTube, Vimeo, or eVOD (watch.evod.co.za). Extensionless links are OK if the server returns video/*.",
      };
    }
    // No extension / hint — provisional MP4; server probe must confirm video.
    return {
      ok: true,
      format: "mp4",
      title: resolveMediaLinkTitle(url, "mp4", preferredTitle),
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

  const title = resolveMediaLinkTitle(url, format, preferredTitle);
  return {
    ok: true,
    format,
    title,
    embedUrl,
    videoId: videoId || undefined,
    thumbnailUrl: thumbnailFor(format, videoId, { title }),
  };
}

export const MEDIA_FORMAT_META: Record<
  MediaLinkFormat,
  { label: string; hint: string; accent: string }
> = {
  hls: {
    label: "HLS live",
    hint: "Any public .m3u / .m3u8 (http IP OK; owned relay skips catalogue allowlist)",
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

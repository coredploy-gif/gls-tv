import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { secureFetchBuffered } from "@/lib/secure-url";
import {
  formatFromContentType,
  formatFromMediaMagic,
  isAppMediaPath,
  isTrustedAppMediaUrl,
  type MediaLinkFormat,
  type MediaLinkStatus,
} from "@/lib/media-links";

export type MediaLinkProbeResult = {
  ok: boolean;
  status: MediaLinkStatus;
  detail?: string;
  /** When provisional / sniff adjusts format (e.g. extensionless → webm). */
  format?: MediaLinkFormat;
};

export type MediaLinkProbeOptions = {
  provisional?: boolean;
  /** Origin of the incoming API request (e.g. `req.nextUrl.origin`). */
  requestOrigin?: string | null;
};

function headerContentType(
  headers: Record<string, string | string[] | undefined>,
): string {
  const raw = headers["content-type"];
  if (Array.isArray(raw)) return raw[0] || "";
  return raw || "";
}

/**
 * Map a trusted `/media/…` URL onto `public/media/…` with path traversal guards.
 * Exported for unit tests.
 */
export function resolveTrustedAppMediaFilePath(
  mediaUrl: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(mediaUrl.trim());
  } catch {
    return null;
  }
  if (!isAppMediaPath(parsed.pathname)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  const publicRoot = path.resolve(process.cwd(), "public");
  const relative = decoded.replace(/^\/+/, "");
  const filePath = path.resolve(publicRoot, relative);
  const rootWithSep = publicRoot.endsWith(path.sep)
    ? publicRoot
    : `${publicRoot}${path.sep}`;
  if (filePath !== publicRoot && !filePath.startsWith(rootWithSep)) {
    return null;
  }
  return filePath;
}

function evaluateDirectMediaBody(
  body: Buffer,
  format: MediaLinkFormat,
  options: {
    provisional: boolean;
    contentType?: string;
    detailPrefix?: string;
  },
): MediaLinkProbeResult {
  const contentType = options.contentType || "";
  const fromCt = formatFromContentType(contentType);
  const fromMagic = formatFromMediaMagic(body);
  const prefix = options.detailPrefix || "Reachable";

  if (format === "hls") {
    const text = body.toString("utf8").slice(0, 512);
    if (!/#EXTM3U/i.test(text)) {
      return {
        ok: false,
        status: "error",
        detail: "URL did not return an HLS playlist (#EXTM3U).",
      };
    }
    return { ok: true, status: "active", detail: prefix, format: "hls" };
  }

  if (options.provisional) {
    const sniffed = fromCt || fromMagic;
    if (
      !sniffed ||
      sniffed === "hls" ||
      sniffed === "youtube" ||
      sniffed === "vimeo"
    ) {
      return {
        ok: false,
        status: "error",
        detail:
          "No playable extension in the URL, and the response was not video/* (or recognizable MP4/WebM). Add .mp4/.webm to the path, or use a link that returns a video Content-Type.",
      };
    }
    return {
      ok: true,
      status: "active",
      detail: `${prefix} · detected ${sniffed} via ${fromCt ? "Content-Type" : "file header"}`,
      format: sniffed,
    };
  }

  const ctLeaf = contentType.split(";")[0].trim().toLowerCase();
  if (
    ctLeaf &&
    /^(text\/html|application\/json|text\/plain|application\/xml|text\/xml)/i.test(
      ctLeaf,
    )
  ) {
    return {
      ok: false,
      status: "error",
      detail: `URL returned ${ctLeaf}, not a video file.`,
    };
  }

  const resolved =
    fromCt === "webm" || fromCt === "mp4"
      ? fromCt
      : fromMagic === "webm" || fromMagic === "mp4"
        ? fromMagic
        : format;

  return {
    ok: true,
    status: "active",
    detail: prefix,
    format: resolved,
  };
}

async function probeTrustedAppMediaFile(
  url: string,
  format: MediaLinkFormat,
  provisional: boolean,
): Promise<MediaLinkProbeResult> {
  const filePath = resolveTrustedAppMediaFilePath(url);
  if (!filePath) {
    return {
      ok: false,
      status: "error",
      detail: "Invalid app media path.",
    };
  }

  try {
    const handle = await fs.open(filePath, "r");
    try {
      const maxBytes = format === "hls" || provisional ? 64_000 : 8_192;
      const buf = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
      const body = buf.subarray(0, bytesRead);
      return evaluateDirectMediaBody(body, format, {
        provisional,
        detailPrefix: "App media file",
      });
    } finally {
      await handle.close();
    }
  } catch {
    return {
      ok: false,
      status: "dead",
      detail:
        "That /media/ file was not found on this server. Place it under public/media/ (e.g. public/media/sample.mp4).",
    };
  }
}

/**
 * Server-only reachability probe (uses Node secure-url / dns).
 * Keep this out of client bundles — MediaLibrary imports media-links.ts only.
 *
 * Trusted same-app `/media/…` URLs are verified via the local `public/` tree
 * so localhost / private origins never go through the SSRF-safe HTTP fetch.
 *
 * @param provisional When true (no URL extension/hint), require video/*
 *   Content-Type or recognizable media magic bytes.
 */
export async function probeMediaLinkReachability(
  url: string,
  format: MediaLinkFormat,
  options?: MediaLinkProbeOptions,
): Promise<MediaLinkProbeResult> {
  if (format === "youtube" || format === "vimeo" || format === "evod") {
    return { ok: true, status: "active", detail: "Embed format verified" };
  }

  const provisional = options?.provisional === true;

  if (
    isTrustedAppMediaUrl(url, { requestOrigin: options?.requestOrigin })
  ) {
    return probeTrustedAppMediaFile(url, format, provisional);
  }

  try {
    const result = await secureFetchBuffered(url, {
      maxBytes: format === "hls" || provisional ? 64_000 : 8_192,
      timeoutMs: 10_000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "GLS-TV/1.0 media-link-probe",
        Accept: "*/*",
        ...(format === "mp4" || format === "webm" || provisional
          ? { Range: "bytes=0-1023" }
          : {}),
      },
    });

    if (result.status >= 400) {
      return {
        ok: false,
        status: "dead",
        detail: `URL returned HTTP ${result.status}`,
      };
    }

    return evaluateDirectMediaBody(result.body, format, {
      provisional,
      contentType: headerContentType(result.headers),
      detailPrefix: "Reachable",
    });
  } catch (cause) {
    return {
      ok: false,
      status: "error",
      detail:
        cause instanceof Error
          ? cause.message
          : "Could not reach that URL from our servers.",
    };
  }
}

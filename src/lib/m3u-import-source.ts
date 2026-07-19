import {
  channelFromSingleHls,
  parseM3uDetailed,
  type M3uParseResult,
} from "@/lib/iptv";
import {
  isIndividualPlaylistUrl,
  shouldSkipUnboundedMediaBodyDownload,
} from "@/lib/media-path";
import type { SecureFetchOptions, SecureFetchResult } from "@/lib/secure-url";

export type M3uImportFetch = (
  url: string,
  options: SecureFetchOptions,
) => Promise<SecureFetchResult>;

export type M3uImportValidateUrl = (
  raw: string,
  allowedHost?: (hostname: string) => boolean,
) => Promise<unknown>;

/** @see {@link shouldSkipUnboundedMediaBodyDownload} */
export function shouldSkipM3uBodyDownload(raw: string) {
  return shouldSkipUnboundedMediaBodyDownload(raw);
}

export function singleStreamM3uPreview(
  url: string,
  options: { maxChannels?: number } = {},
): M3uParseResult {
  const fromParser = parseM3uDetailed("", {
    baseUrl: url,
    maxChannels: options.maxChannels ?? 2000,
    singleStreamUrl: url,
  });
  if (fromParser.channels.length) return fromParser;
  // `.m3u8` (and similar) with empty/non-playlist body — still one Staff-pickable channel.
  return {
    channels: [channelFromSingleHls(url)],
    stats: {
      parsed: 1,
      skipped: 0,
      invalid: 0,
      duplicates: 0,
      truncated: 0,
      kind: "hls-media",
    },
  };
}

/**
 * Resolve an admin M3U / HLS import URL into channels.
 * Individual IPTV gateways skip body download; list hosts still fetch playlists.
 */
export async function fetchAndParseM3uImport(
  url: string,
  options: {
    fetchBuffered: M3uImportFetch;
    validateUrl: M3uImportValidateUrl;
    /** Host allowlist for multi-channel list URLs only. */
    allowedListHost?: (hostname: string) => boolean;
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
    maxChannels?: number;
  },
): Promise<M3uParseResult> {
  const maxChannels = options.maxChannels ?? 2000;
  const individual = isIndividualPlaylistUrl(url);

  if (shouldSkipM3uBodyDownload(url)) {
    // SSRF only — no catalogue list-host allowlist (same as individual .m3u8).
    await options.validateUrl(url);
    return singleStreamM3uPreview(url, { maxChannels });
  }

  const fetchOptions: SecureFetchOptions = {
    maxBytes: options.maxBytes ?? 4 * 1024 * 1024,
    timeoutMs: options.timeoutMs ?? 20_000,
    maxRedirects: options.maxRedirects ?? 5,
    allowedHost: individual ? undefined : options.allowedListHost,
    headers: {
      Accept: "application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain,*/*",
      "User-Agent": "GLS-TV/1.0 (admin-m3u-preview)",
    },
  };

  const fetched = await options.fetchBuffered(url, fetchOptions);
  if (fetched.status < 200 || fetched.status >= 300) {
    throw new Error("Source download failed");
  }
  const text = new TextDecoder().decode(fetched.body);
  return parseM3uDetailed(text, {
    baseUrl: fetched.finalUrl,
    maxChannels,
    singleStreamUrl: url,
  });
}

export function m3uImportPreviewErrorMessage(url: string, detail: string) {
  if (isIndividualPlaylistUrl(url)) {
    return `Could not preview playlist (${detail}). Private/reserved IPs are blocked. Individual stream URLs (/play/…, .m3u8) are accepted without downloading a full playlist body.`;
  }
  return `Source is unavailable or not on the approved list-host allowlist (${detail}).`;
}

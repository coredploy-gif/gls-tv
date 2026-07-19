/**
 * Client-safe IPTV / playlist path helpers (no Node builtins).
 * Host allowlisting stays in media-hosts (uses node:net / secure-url).
 */

/**
 * Extensionless IPTV panel / gateway paths (Xtream-style `/play/TOKEN`, `/live/…`, etc.).
 * Used for format detection and individual-stream allowlist skip — not a host allowlist.
 */
export function isLikelyIptvStreamPath(pathname: string) {
  const path = (pathname || "").toLowerCase().split("?")[0] || "";
  if (
    /^\/(play|live|stream|streaming|hls|casting|movie|series|timeshift)(\/|$)/.test(
      path,
    )
  ) {
    return true;
  }
  // Classic Xtream Codes panel entrypoints
  return /\/(get\.php|player_api\.php)$/.test(path);
}

/**
 * Individual stream or playlist URL: `.m3u` / `.m3u8`, or IPTV gateway paths
 * like `http://IP:port/play/…`. My Links / Staff picks / M3U preview may skip
 * the catalogue host allowlist for these; SSRF still uses validatePublicUrl.
 */
export function isIndividualPlaylistUrl(raw: string) {
  try {
    const path = new URL(raw).pathname.toLowerCase();
    if (path.endsWith(".m3u8") || path.endsWith(".m3u")) return true;
    return isLikelyIptvStreamPath(path);
  } catch {
    return false;
  }
}

/**
 * Individual streams (`.m3u8`, `/play/…` gateways) may return unbounded media
 * (live MPEG-TS) or announce a huge Content-Length — never buffer the body.
 * Multi-channel `.m3u` lists still need a playlist body download.
 */
export function shouldSkipUnboundedMediaBodyDownload(raw: string) {
  try {
    const path = new URL(raw).pathname.toLowerCase();
    if (path.endsWith(".m3u") && !path.endsWith(".m3u8")) return false;
    return isIndividualPlaylistUrl(raw);
  } catch {
    return false;
  }
}

/**
 * Single-stream HLS entry URLs (…/index.m3u8). Multi-channel lists are usually .m3u.
 * @deprecated Prefer {@link isIndividualPlaylistUrl} for allowlist skip decisions.
 */
export function isLikelySingleStreamHlsUrl(raw: string) {
  try {
    return new URL(raw).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

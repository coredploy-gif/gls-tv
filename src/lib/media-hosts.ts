import net from "node:net";
import { isReservedAddress } from "@/lib/secure-url";

const MEDIA_HOST_SUFFIXES = [
  "mangomolo.com",
  "sabcplus.com",
  "bozztv.com",
  "trace.tv",
  "tracetv.com",
  "freevisiontv.co.za",
  "sentech.co.za",
  "telemedia.co.za",
  "afxp.co.za",
  "jmp2.uk",
  "pluto.tv",
  "plutotv.net",
  // Roku FAST stitchers (jmp2 rok-* redirects here)
  "roku.com",
  "xumo.com",
  "wurl.tv",
  "amagi.tv",
  "cloudfront.net",
  "googleusercontent.com",
  "akamaized.net",
  "akamaihd.net",
  // Food / FAST CDN child hosts (Publica → Ottera → Kaltura; Tubi Aegis)
  "getpublica.com",
  "ottera.tv",
  "kaltura.com",
  "tubi.video",
  // Wowza Cloud hosts already present in playable-* packs (TeleArena, racing, etc.)
  "streamlock.net",
];

export function isAllowedMediaHost(hostname: string) {
  const configured = (process.env.GLS_HLS_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...MEDIA_HOST_SUFFIXES, ...configured].some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

/** Literal public IP hostnames (IPv4/IPv6) — private/reserved still blocked. */
export function isPublicIpHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!net.isIP(host)) return false;
  return !isReservedAddress(host);
}

/**
 * Single-stream HLS entry URLs (…/index.m3u8). Multi-channel lists are usually .m3u.
 * Preview of these may skip the catalogue host allowlist; SSRF still uses validatePublicUrl.
 */
export function isLikelySingleStreamHlsUrl(raw: string) {
  try {
    return new URL(raw).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

import net from "node:net";
import { isReservedAddress } from "@/lib/secure-url";

export {
  isIndividualPlaylistUrl,
  isLikelyIptvStreamPath,
  isLikelySingleStreamHlsUrl,
} from "@/lib/media-path";

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
  "streamtheworld.com",
  "streamguys1.com",
  "fastcast4u.com",
  "rtnc.cd",
  "zbc.co.zw",
  "bokradio.co.za",
  "mbc.mw",
  "securenetsystems.net",
  "cloudfront.net",
  "googleusercontent.com",
  "akamaized.net",
  "akamaihd.net",
  // France 24 official live + Alkass Shoof GCP (proxy Referer: shoof.alkass.net)
  "france24.com",
  "alkassdigital.net",
  // Food / FAST CDN child hosts (Publica → Ottera → Kaltura; Tubi Aegis)
  "getpublica.com",
  "ottera.tv",
  "kaltura.com",
  "tubi.video",
  // Wowza Cloud hosts already present in playable-* packs (TeleArena, racing, etc.)
  "streamlock.net",
  // Saudi / Islamic official CDNs (Globecast mirrors already covered by akamaized.net)
  "live.net.sa",
  "streambrothers.com",
  "fasttvcdn.com",
  "kwikmotion.com",
  "simplestreamcdn.com",
  // MENA / Turkey public broadcasters (curated-mena + playable packs)
  "trt.com.tr",
  "alarabiya.net",
  "skynewsarabia.com",
  "edgenextcdn.net",
  "ercdn.net",
  "mncdn.com",
  // South African Islamic radio (official station / iono.fm streams)
  "my-control-panel.com",
  "radioislam.co.za",
  "iono.fm",
];

export function isAllowedMediaHost(hostname: string) {
  // Public IP literals (http://1.2.3.4:8000/play/…) — reserved/private still denied.
  if (isPublicIpHostname(hostname)) return true;
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

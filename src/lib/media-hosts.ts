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

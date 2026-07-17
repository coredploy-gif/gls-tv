export function hlsUpstreamHeaders(target: string, range: string | null) {
  const url = new URL(target);
  const referer = /bozztv\.com/i.test(url.hostname)
    ? "https://mbc.mw/live/"
    : `${url.origin}/`;
  const headers: Record<string, string> = {
    "User-Agent": "GLS-TV/1.0 (media-proxy)",
    Accept: "*/*",
    Referer: referer,
  };
  if (range) headers.Range = range;
  return headers;
}

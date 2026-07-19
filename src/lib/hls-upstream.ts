export function hlsUpstreamHeaders(target: string, range: string | null) {
  const url = new URL(target);
  const referer = /bozztv\.com/i.test(url.hostname)
    ? "https://mbc.mw/live/"
    : /alkassdigital\.net|alkass\.net/i.test(url.hostname)
      ? "https://shoof.alkass.net/"
      : `${url.origin}/`;
  const headers: Record<string, string> = {
    "User-Agent": "GLS-TV/1.0 (media-proxy)",
    Accept: "*/*",
    Referer: referer,
  };
  if (range) headers.Range = range;
  return headers;
}

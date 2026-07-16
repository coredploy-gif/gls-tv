export function hlsUpstreamHeaders(target: string, range: string | null) {
  const url = new URL(target);
  const headers: Record<string, string> = {
    "User-Agent": "GLS-TV/1.0 (media-proxy)",
    Accept: "*/*",
    Referer: `${url.origin}/`,
  };
  if (range) headers.Range = range;
  return headers;
}

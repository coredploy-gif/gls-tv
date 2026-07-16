export function rewriteHlsPlaylist(
  body: string,
  baseUrl: string,
  rewriteUrl: (absoluteUrl: string) => string,
) {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
          try {
            return `URI="${rewriteUrl(new URL(uri, baseUrl).href)}"`;
          } catch {
            return _match;
          }
        });
      }
      try {
        return rewriteUrl(new URL(trimmed, baseUrl).href);
      } catch {
        return line;
      }
    })
    .join("\n");
}

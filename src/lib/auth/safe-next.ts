/**
 * Allow only same-origin relative paths (optionally with query/hash).
 * Blocks open redirects like `//evil.com` or `https://…`.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/profiles",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}

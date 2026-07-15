/**
 * Entries intentionally excluded from GLS-owned catalogs.
 *
 * This policy is only for built-in, curated, seed, and database catalogs.
 * User-owned playlist rows must not use it: those remain owner-scoped and
 * resolve playback through their persisted `user_playlist_channels.id`.
 */
export function isExcludedBuiltinChannel(
  slug: string,
  title?: string | null,
): boolean {
  const normalizedTitle = (title || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[!._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (/^tsn ?[1-5]$/.test(normalizedTitle)) return true;
  if (/^tsn[1-5](?:casd)?$/.test(normalizedSlug)) return true;

  if (/^fox sports(?: [0-9]+)?(?: |$)/.test(normalizedTitle)) return true;
  if (
    normalizedTitle === "fox deportes" ||
    normalizedTitle === "fox soccer plus"
  ) {
    return true;
  }
  if (
    /^(?:foxsports|foxsports[0-9]+|foxsports[0-9]+(?:us|ar)(?:sd|hd)?|foxsports1080pgeoblocked|foxdeportesussd|foxsoccerplusussd)$/.test(
      normalizedSlug,
    )
  ) {
    return true;
  }

  // TeleArena is a distinct public channel and deliberately does not match.
  return (
    /^arena sport(?: [0-9]+)?$/.test(normalizedTitle) ||
    /^arena premium(?: [0-9]+)?$/.test(normalizedTitle) ||
    normalizedTitle === "arena fight" ||
    normalizedTitle === "match arena" ||
    normalizedTitle === "vivacom arena" ||
    /^arenasport[0-9]*(?:[a-z]{2})?(?:sd|hd)?$/.test(normalizedSlug) ||
    /^arenapremium[0-9]*(?:[a-z]{2})?(?:sd|hd)?$/.test(normalizedSlug) ||
    /^arenafight(?:[a-z]{2})?(?:sd|hd)?$/.test(normalizedSlug) ||
    normalizedSlug === "matcharena" ||
    /^vivacomarena(?:[a-z]{2})?(?:sd|hd)?$/.test(normalizedSlug)
  );
}

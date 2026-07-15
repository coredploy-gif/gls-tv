import type { CatalogItem } from "@/data/types";

/** Pay-linear / IPTV sports packs that need deeper buffering (not remapped titles). */
export function isLinearSportsPack(
  item: CatalogItem | { slug: string; title: string; categories?: string[] },
) {
  const hay = `${item.slug} ${item.title} ${(item.categories || []).join(" ")}`;
  return /espn|tsn|fox.?sport|foxsports|bein|sky.?sport|supersport|arena.?sport|arenasport|arena.?fight|nba.?tv|nfl.?network|nhl.?network|mlb.?network|dazn|tnt.?sport|bt.?sport|premier.?sport/i.test(
    hay,
  );
}

export function sportsFamily(
  item: { slug: string; title: string },
): "espn" | "fox" | "tsn" | "bein" | null {
  const hay = `${item.slug} ${item.title}`;
  if (/espn/i.test(hay)) return "espn";
  if (/fox.?sport|foxsports/i.test(hay)) return "fox";
  if (/\btsn\b|tsn[0-9]|tsn-/i.test(hay)) return "tsn";
  if (/bein/i.test(hay)) return "bein";
  return null;
}

/**
 * Numbered pay linear slots (TSN 1–5, Fox Sports 1, ESPN…):
 * never inject open FAST “Ocho / LiveNOW / Xtra” as a substitute feed.
 * Those FASTs are separate channels with their own slugs.
 */
export function isNumberedLinearSlot(item: {
  slug: string;
  title: string;
}): boolean {
  const hay = `${item.slug} ${item.title}`;
  if (/ocho|livenow|xtra|theocho/i.test(hay)) return false;
  return (
    /\btsn\s*[1-5]\b|\btsn[1-5]\b|tsn[1-5]-/i.test(hay) ||
    /fox\s*sports?\s*[12]\b|foxsports[12]/i.test(hay) ||
    /\bespn\s*[123u]?\b|\bespn[-_]?(2|3|u|news|deportes)/i.test(hay) ||
    /\bbein\s*sports?\s*\d/i.test(hay)
  );
}

/**
 * Open FAST HTTPS only allowed on the matching FAST slug —
 * not as a silent remap of TSN 1 / Fox 1 / ESPN.
 */
export const OPEN_FAST_BY_SLUG: Record<
  string,
  { url: string; label: string; priority: number }
> = {
  "tsntheocho-ca-sd": {
    url: "https://d3pnbvng3bx2nj.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-rds8g35qfqrnv/TSN_The_Ocho.m3u8",
    label: "tsn-ocho-https",
    priority: 5,
  },
  "espn8-the-ocho": {
    url: "https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8",
    label: "espn-ocho-https",
    priority: 5,
  },
  "espn8theocho-us-espn8theochohd": {
    url: "https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8",
    label: "espn-ocho-https",
    priority: 5,
  },
  "livenow-from-fox": {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00488-foxdigital-livenowbyfox-lgus/playlist.m3u8",
    label: "fox-livenow",
    priority: 5,
  },
  "beinsportsxtra-us-sd": {
    url: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
    label: "bein-xtra-https",
    priority: 5,
  },
};

/** @deprecated Prefer OPEN_FAST_BY_SLUG — kept empty so nothing remaps numbered packs. */
export const SPORTS_HTTPS_FALLBACKS: Record<
  NonNullable<ReturnType<typeof sportsFamily>>,
  { url: string; label: string; priority: number }[]
> = {
  espn: [],
  fox: [],
  tsn: [],
  bein: [],
};

export function scoreSportMirrorUrl(url: string): number {
  let s = 0;
  if (url.startsWith("https://")) s += 40;
  if (/cloudfront\.net|amagi\.tv|akamai|akamaized/i.test(url)) s += 30;
  if (/\.m3u8(\?|$)/i.test(url)) s += 10;
  if (/streamvidex|qzz\.io/i.test(url)) s -= 25;
  if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(url)) s -= 15;
  if (/^http:\/\//i.test(url)) s -= 10;
  return s;
}

export function familySearchFilter(
  family: NonNullable<ReturnType<typeof sportsFamily>>,
): string {
  switch (family) {
    case "espn":
      return "title.ilike.%ESPN%,slug.ilike.%espn%";
    case "fox":
      return "title.ilike.%Fox Sports%,title.ilike.%FOX Sports%,slug.ilike.%foxsport%,slug.ilike.%fox-sports%";
    case "tsn":
      return "title.ilike.%TSN%,slug.ilike.%tsn%";
    case "bein":
      return "title.ilike.%beIN%,slug.ilike.%bein%";
  }
}

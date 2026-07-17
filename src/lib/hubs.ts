import type { CatalogItem } from "@/data/types";
import { COUNTRIES } from "@/data/catalog";
import { TOP10 } from "@/data/top10";
import {
  getAllChannels,
  getSportsChannels,
  getKidsChannels,
  getFoodChannels,
  getAfricaChannels,
  getAsiaChannels,
  getAsiaSeries,
  getReligionChannels,
} from "@/lib/channels";

export type HubKey =
  | "sports"
  | "kids"
  | "news"
  | "food"
  | "religion"
  | "live"
  | "africa"
  | "asia";

export type HubDef = {
  key: HubKey;
  title: string;
  href: string;
  blurb: string;
  match: (item: CatalogItem) => boolean;
  top10: CatalogItem[];
};

const ALL = getAllChannels();

const AFRICA_CODES = new Set([
  "za",
  "ng",
  "ke",
  "eg",
  "gh",
  "tz",
  "ug",
  "ma",
  "dz",
  "tn",
  "et",
  "sn",
  "ci",
  "cm",
  "rw",
  "zw",
  "bw",
  "na",
  "mz",
  "ao",
  "ly",
  "sd",
  "so",
  "mg",
  "mw",
  "zm",
  "sz",
  "ls",
]);

const ASIA_CODES = new Set([
  "in",
  "kr",
  "cn",
  "jp",
  "tw",
  "hk",
  "th",
  "id",
  "ph",
  "vn",
  "my",
  "sg",
  "bd",
  "pk",
  "lk",
  "np",
]);

export const HUBS: HubDef[] = [
  {
    key: "sports",
    title: "Sports",
    href: "/sports",
    blurb: "Live sports hubs, Match Day picks, and more.",
    match: (i) =>
      i.type === "live" &&
      (i.categories.some((c) =>
        /sport|golf|tennis|racing|outdoor|football/i.test(c),
      ) ||
        /sport|espn|bein|stadium|golf|tennis|nfl|nba|nhl|wwe|wrestling|impact|mma/i.test(
          i.title,
        )),
    top10: [...TOP10.sports],
  },
  {
    key: "kids",
    title: "Kids",
    href: "/kids",
    blurb: "Family-safe channels, cartoons, and kids hubs.",
    match: (i) =>
      i.type === "live" &&
      (i.categories.some((c) =>
        /kid|child|cartoon|animation|family/i.test(c),
      ) ||
        /kid|cartoon|baby|garfield|pbs|nick|disney|anime|happy/i.test(i.title)),
    top10: [...TOP10.kids],
  },
  {
    key: "news",
    title: "News",
    href: "/news",
    blurb: "World and local news channels.",
    match: (i) =>
      i.type === "live" &&
      (i.categories.some((c) => /news/i.test(c)) ||
        /news|reuters|bbc|dw|france 24|cbs news|abc news|jazeera|al jazeera/i.test(
          i.title,
        )),
    top10: [...TOP10.news],
  },
  {
    key: "food",
    title: "Food",
    href: "/food",
    blurb: "Cooking, chefs, and food competitions.",
    match: (i) =>
      i.type === "live" &&
      (i.categories.some((c) => /food|cook|chef|kitchen|lifestyle/i.test(c)) ||
        /food|cook|chef|kitchen|gordon|iron chef|bon app|hungry|recipe/i.test(
          i.title,
        )),
    top10: [...TOP10.food],
  },
  {
    key: "religion",
    title: "Religion",
    href: "/religion",
    blurb: "Islam, Gospel, and Hindu faith channels — browse by folder.",
    match: (i) =>
      i.categories.some((c) =>
        /^religion$|^islam$|^gospel$|^hindu$|^religious$|^christian$/i.test(c),
      ) ||
      /quran|sunnah|makkah|madinah|iqraa|islam channel|hope channel|redemption|trace gospel|gospel ministry|aastha|sanskar/i.test(
        `${i.title} ${i.categories.join(" ")}`,
      ),
    top10: getReligionChannels()
      .filter(
        (c) =>
          c.categories.includes("Curated") || c.categories.includes("Playable"),
      )
      .slice(0, 10),
  },
  {
    key: "africa",
    title: "Africa",
    href: "/africa",
    blurb: "Public African live TV — news, sports, entertainment by country.",
    match: (i) =>
      i.categories.includes("Africa") ||
      i.countries.some((c) => AFRICA_CODES.has(c)),
    top10: getAfricaChannels()
      .filter(
        (c) =>
          c.categories.includes("Curated") ||
          c.categories.includes("Playable"),
      )
      .slice(0, 10),
  },
  {
    key: "asia",
    title: "Asia",
    href: "/asia",
    blurb:
      "India, Korea, China, Japan & more — food, kids, sports, news, and Asian series.",
    match: (i) =>
      i.categories.includes("Asia") ||
      i.countries.some((c) => ASIA_CODES.has(c)),
    top10: [
      ...getAsiaChannels()
        .filter(
          (c) =>
            c.countries.includes("in") &&
            (c.categories.includes("Playable") ||
              c.categories.includes("Curated")),
        )
        .slice(0, 5),
      ...getAsiaSeries().slice(0, 3),
      ...getAsiaChannels()
        .filter((c) => c.categories.includes("Playable"))
        .slice(0, 4),
    ].slice(0, 10),
  },
  {
    key: "live",
    title: "Live TV",
    href: "/live",
    blurb: "All live channels by country.",
    match: (i) => i.type === "live",
    top10: [...TOP10.sports, ...TOP10.news].slice(0, 10),
  },
];

export function getHub(key: HubKey) {
  return HUBS.find((h) => h.key === key)!;
}

export function getHubChannels(key: HubKey): CatalogItem[] {
  if (key === "sports") {
    const hub = getHub(key);
    return mergeBySlug(hub.top10, getSportsChannels(), ALL.filter(hub.match));
  }
  if (key === "kids") {
    const hub = getHub(key);
    return mergeBySlug(hub.top10, getKidsChannels(), ALL.filter(hub.match));
  }
  if (key === "food") {
    const hub = getHub(key);
    return mergeBySlug(hub.top10, getFoodChannels(), ALL.filter(hub.match));
  }
  if (key === "religion") {
    const hub = getHub(key);
    return mergeBySlug(hub.top10, getReligionChannels(), ALL.filter(hub.match));
  }
  if (key === "africa") {
    const hub = getHub(key);
    return mergeBySlug(hub.top10, getAfricaChannels(), ALL.filter(hub.match));
  }
  if (key === "asia") {
    const hub = getHub(key);
    return mergeBySlug(
      hub.top10,
      getAsiaSeries(),
      getAsiaChannels(),
      ALL.filter(hub.match),
    );
  }
  const hub = getHub(key);
  return mergeBySlug(hub.top10, ALL.filter(hub.match));
}

function mergeBySlug(...lists: CatalogItem[][]) {
  const map = new Map<string, CatalogItem>();
  for (const list of lists) {
    for (const item of list) {
      if (!map.has(item.slug)) map.set(item.slug, item);
    }
  }
  return [...map.values()];
}

export function countriesFor(items: CatalogItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const code of item.countries.length ? item.countries : ["world"]) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => {
      const meta = COUNTRIES.find((c) => c.code === code);
      return {
        code,
        count,
        name: meta?.name ?? code.toUpperCase(),
        flag: meta?.flag ?? "🌍",
      };
    });
}

export function filterByCountry(items: CatalogItem[], country: string | null) {
  if (!country || country === "all") return items;
  return items.filter((i) => i.countries.includes(country));
}

export function popularFirst(items: CatalogItem[]) {
  return [...items].sort((a, b) => {
    const score = (i: CatalogItem) =>
      (i.categories.includes("Curated") ? 25 : 0) +
      (i.categories.includes("Playable") ? 20 : 0) +
      (i.categories.includes("Popular") ? 10 : 0) +
      (i.categories.includes("Verified") ? 5 : 0) +
      (i.countries.includes("za") ? 2 : 0) +
      (i.featured ? 3 : 0);
    return score(b) - score(a);
  });
}

export const ROW_LIMIT = 12;

/** Prefer kids/sports/news/food over generic live. */
export function hubKeyForItem(item: CatalogItem): HubKey | null {
  if (item.categories.includes("Asia") || item.countries.some((c) => ASIA_CODES.has(c)))
    return "asia";
  if (
    item.categories.includes("Africa") ||
    item.countries.some((c) => AFRICA_CODES.has(c))
  )
    return "africa";
  for (const key of ["kids", "sports", "news", "food", "religion"] as const) {
    if (getHub(key).match(item)) return key;
  }
  if (item.type === "live") return "live";
  return null;
}

export function getRelatedChannels(
  item: CatalogItem,
  limit = 24,
): CatalogItem[] {
  const key = hubKeyForItem(item);
  const pool = key
    ? getHubChannels(key)
    : ALL.filter((i) => i.type === item.type);
  return popularFirst(pool.filter((i) => i.slug !== item.slug)).slice(0, limit);
}

export function fallbackHubHref(item: CatalogItem): string {
  const key = hubKeyForItem(item);
  return key ? getHub(key).href : "/browse";
}

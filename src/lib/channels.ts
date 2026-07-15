import type { CatalogItem } from "@/data/types";
import { CATALOG } from "@/data/catalog";
import { VERIFIED_LIVE } from "@/data/verified";
import { getAllTop10 } from "@/data/top10";
import sportsJson from "@/data/generated/sports.json";
import usJson from "@/data/generated/us.json";
import playableSportsJson from "@/data/generated/playable-sports.json";
import playableKidsJson from "@/data/generated/playable-kids.json";
import playableFoodJson from "@/data/generated/playable-food.json";
import playableFoodCompJson from "@/data/generated/playable-food-competitions.json";
import playableWrestlingJson from "@/data/generated/playable-wrestling.json";
import playableAfricaJson from "@/data/generated/playable-africa.json";
import playableAsiaJson from "@/data/generated/playable-asia.json";
import playableAsiaSeriesJson from "@/data/generated/playable-asia-series.json";
import playableKoreaSeriesJson from "@/data/generated/playable-korea-series.json";
import africaJson from "@/data/generated/africa.json";
import asiaJson from "@/data/generated/asia.json";
import overridesJson from "@/data/generated/channel-overrides.json";
import { CURATED_AFRICA } from "@/data/curated-africa";
import { CURATED_TSN, USER_SEED_SLUGS } from "@/data/curated-tsn";
import {
  CURATED_PUBLIC_MOVIES,
  CURATED_PUBLIC_SPORTS,
  CURATED_SERIES_SEEDS,
} from "@/data/curated-public-fast";

const sportsChannels = sportsJson as CatalogItem[];
const usChannels = usJson as CatalogItem[];
const playableSports = playableSportsJson as CatalogItem[];
const playableKids = playableKidsJson as CatalogItem[];
const playableFood = playableFoodJson as CatalogItem[];
const playableFoodComp = playableFoodCompJson as CatalogItem[];
const playableWrestling = playableWrestlingJson as CatalogItem[];
const playableAfrica = playableAfricaJson as CatalogItem[];
const playableAsia = playableAsiaJson as CatalogItem[];
const playableAsiaSeries = playableAsiaSeriesJson as CatalogItem[];
const playableKoreaSeries = playableKoreaSeriesJson as CatalogItem[];
const africaChannels = africaJson as CatalogItem[];
const asiaChannels = asiaJson as CatalogItem[];
const overrides = overridesJson as Record<
  string,
  { title?: string; url?: string; note?: string; categories?: string[] }
>;
const top10 = getAllTop10();

function applyOverride(item: CatalogItem): CatalogItem {
  // User seed slots win — never remap TSN 1–5 (etc.) to FAST substitutes.
  if (USER_SEED_SLUGS.has(item.slug)) return item;
  const o = overrides[item.slug];
  if (!o?.url) return item;
  return {
    ...item,
    title: o.title || item.title,
    description: o.note || item.description,
    categories: [
      ...new Set([...(o.categories || item.categories), "Healed", "Playable"]),
    ],
    sources: [
      {
        url: o.url,
        quality: item.sources[0]?.quality || "Auto",
        format: "hls",
      },
    ],
  };
}

function mergeUnique(...lists: CatalogItem[][]) {
  const map = new Map<string, CatalogItem>();
  for (const list of lists) {
    for (const raw of list) {
      const item = applyOverride(raw);
      const bySlug = [...map.values()].find((x) => x.slug === item.slug);
      if (bySlug && map.has(bySlug.id)) {
        const preferNew =
          (item.categories.includes("Verified") ||
            item.categories.includes("Playable") ||
            item.id.startsWith("top-") ||
            item.id.startsWith("playable-") ||
            item.id.startsWith("curated-")) &&
          !bySlug.categories.includes("Verified") &&
          !bySlug.categories.includes("Playable") &&
          !bySlug.id.startsWith("top-");
        if (preferNew) {
          map.delete(bySlug.id);
          map.set(item.id, item);
        }
        continue;
      }
      if (!map.has(item.id)) map.set(item.id, item);
    }
  }
  return [...map.values()];
}

export function getVerifiedChannels() {
  return mergeUnique(
    top10,
    CURATED_AFRICA,
    CURATED_TSN,
    CURATED_PUBLIC_SPORTS,
    CURATED_PUBLIC_MOVIES,
    CURATED_SERIES_SEEDS,
    VERIFIED_LIVE,
    playableSports,
    playableWrestling,
    playableKids,
    playableFood,
    playableAfrica,
    playableAsia,
  );
}

export function getAllChannels(): CatalogItem[] {
  // Prefer strict playable packs. Raw africa/asia dumps are catalog-only (no Playable badge).
  return mergeUnique(
    top10,
    CURATED_AFRICA,
    CURATED_TSN,
    CURATED_PUBLIC_SPORTS,
    CURATED_PUBLIC_MOVIES,
    CURATED_SERIES_SEEDS,
    VERIFIED_LIVE,
    playableSports,
    playableWrestling,
    playableKids,
    playableFood,
    playableFoodComp,
    playableAfrica,
    playableAsia,
    playableAsiaSeries,
    playableKoreaSeries,
    CATALOG,
    sportsChannels,
    usChannels,
    // Unverified region catalogs last — never win over Playable duplicates
    africaChannels,
    asiaChannels,
  );
}

function catalogueMatch(item: CatalogItem, pattern: RegExp) {
  return pattern.test(`${item.title} ${item.categories.join(" ")}`);
}

/** Movie VOD plus 24/7 movie/film FAST channels from every imported catalogue. */
export function getMovieChannels() {
  return getAllChannels()
    .filter(
      (item) =>
        item.type === "movie" ||
        catalogueMatch(item, /\bmovies?\b|\bfilm\b|\bcinema\b/i),
    )
    .sort((a, b) => {
      const score = (item: CatalogItem) =>
        (item.categories.includes("Playable") ? 4 : 0) +
        (item.categories.includes("Verified") ? 2 : 0) +
        (item.categories.includes("Curated") ? 1 : 0);
      return score(b) - score(a) || a.title.localeCompare(b.title);
    });
}

/** Episodic/anthology VOD plus 24/7 drama and series channels from all catalogues. */
export function getSeriesChannels() {
  return getAllChannels()
    .filter(
      (item) =>
        item.type === "series" ||
        catalogueMatch(item, /\bseries\b|\bdrama\b|\banthology\b/i),
    )
    .sort((a, b) => {
      const score = (item: CatalogItem) =>
        (item.categories.includes("Playable") ? 4 : 0) +
        (item.categories.includes("Verified") ? 2 : 0) +
        (item.categories.includes("Curated") ? 1 : 0);
      return score(b) - score(a) || a.title.localeCompare(b.title);
    });
}

export function getChannelBySlug(slug: string): CatalogItem | undefined {
  const found =
    top10.find((c) => c.slug === slug) ||
    CURATED_AFRICA.find((c) => c.slug === slug) ||
    CURATED_TSN.find((c) => c.slug === slug) ||
    CURATED_PUBLIC_SPORTS.find((c) => c.slug === slug) ||
    CURATED_PUBLIC_MOVIES.find((c) => c.slug === slug) ||
    CURATED_SERIES_SEEDS.find((c) => c.slug === slug) ||
    playableWrestling.find((c) => c.slug === slug) ||
    playableSports.find((c) => c.slug === slug) ||
    playableKids.find((c) => c.slug === slug) ||
    playableFood.find((c) => c.slug === slug) ||
    playableFoodComp.find((c) => c.slug === slug) ||
    playableAfrica.find((c) => c.slug === slug) ||
    playableAsia.find((c) => c.slug === slug) ||
    playableAsiaSeries.find((c) => c.slug === slug) ||
    playableKoreaSeries.find((c) => c.slug === slug) ||
    VERIFIED_LIVE.find((c) => c.slug === slug) ||
    CATALOG.find((c) => c.slug === slug) ||
    sportsChannels.find((c) => c.slug === slug) ||
    usChannels.find((c) => c.slug === slug) ||
    africaChannels.find((c) => c.slug === slug) ||
    asiaChannels.find((c) => c.slug === slug);
  return found ? applyOverride(found) : undefined;
}

export function getSportsChannels() {
  return mergeUnique(
    CURATED_TSN,
    CURATED_PUBLIC_SPORTS,
    playableWrestling,
    playableSports,
    top10.filter((c) => c.categories.includes("Sports")),
    VERIFIED_LIVE.filter((c) => c.categories.some((x) => /sport/i.test(x))),
    sportsChannels,
    [...playableAfrica, ...playableAsia].filter((c) =>
      c.categories.some((x) => /sport/i.test(x)),
    ),
  );
}

export function getWrestlingChannels() {
  return mergeUnique(
    playableWrestling,
    getSportsChannels().filter(
      (c) =>
        c.categories.some((x) =>
          /wrestling|mma|boxing|fight|combat|kickbox/i.test(x),
        ) ||
        /wrestling|impact|mma|boxing|fight|glory|lucha|aew|wwe/i.test(c.title),
    ),
  );
}

export function getKidsChannels() {
  return mergeUnique(
    playableKids,
    top10.filter((c) => c.categories.includes("Kids")),
    [...playableAfrica, ...playableAsia, ...usChannels].filter(
      (c) =>
        c.categories.some((x) =>
          /kid|child|cartoon|animation|family/i.test(x),
        ) || /kid|cartoon|baby|anime|happy/i.test(c.title),
    ),
  );
}

export function getFoodChannels() {
  return mergeUnique(
    playableFoodComp,
    playableFood,
    top10.filter((c) => c.categories.includes("Food")),
    [...playableAfrica, ...playableAsia, ...usChannels].filter(
      (c) =>
        c.categories.some((x) => /food|cook|chef|kitchen/i.test(x)) ||
        /food|cook|chef|kitchen/i.test(c.title),
    ),
  );
}

export function getAfricaChannels() {
  return mergeUnique(CURATED_AFRICA, playableAfrica, africaChannels);
}

export function getAsiaChannels() {
  return mergeUnique(
    playableAsia,
    playableAsiaSeries,
    playableKoreaSeries,
    asiaChannels,
  );
}

export function getAsiaSeries() {
  return mergeUnique(playableKoreaSeries, playableAsiaSeries);
}

export function getUsChannels() {
  return mergeUnique(
    top10.filter((c) => c.countries.includes("us")),
    VERIFIED_LIVE.filter((c) => c.countries.includes("us")),
    usChannels,
  );
}

export function getUsByCategory(category: string) {
  const q = category.toLowerCase();
  return getUsChannels().filter((c) =>
    c.categories.some((cat) => cat.toLowerCase() === q),
  );
}

/** Full catalog for search (deduped). */
export function getSearchIndex(): CatalogItem[] {
  return getAllChannels();
}

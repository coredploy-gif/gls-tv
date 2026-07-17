import type { CatalogItem } from "@/data/types";
import {
  CURATED_RELIGION,
  CURATED_RELIGION_GOSPEL,
  CURATED_RELIGION_HINDU,
  CURATED_RELIGION_ISLAM,
} from "@/data/curated-religion";

export type ReligionFolderKey = "islam" | "gospel" | "hindu";

export type ReligionFolderDef = {
  key: ReligionFolderKey;
  title: string;
  blurb: string;
  emoji: string;
  href: string;
  comingSoon?: boolean;
};

export const RELIGION_FOLDERS: ReligionFolderDef[] = [
  {
    key: "islam",
    title: "Islam",
    blurb: "Makkah, Madinah, Quran, Sunnah, and Islamic teaching channels.",
    emoji: "☪️",
    href: "/religion/islam",
  },
  {
    key: "gospel",
    title: "Gospel",
    blurb: "Christian faith, ministry, and gospel music channels.",
    emoji: "✝️",
    href: "/religion/gospel",
  },
  {
    key: "hindu",
    title: "Hindu",
    blurb: "Hindu devotional and spiritual programming — more channels coming soon.",
    emoji: "🕉️",
    href: "/religion/hindu",
    comingSoon: true,
  },
];

const FOLDER_BY_KEY = Object.fromEntries(
  RELIGION_FOLDERS.map((folder) => [folder.key, folder]),
) as Record<ReligionFolderKey, ReligionFolderDef>;

const GOSPEL_SLUGS = new Set([
  "hope-channel-africa",
  "redemption-tv",
  "trace-gospel",
  "tracegospel-fr-southernafrica",
  "tracegospel-fr-sd",
  "tracegospel-fr-nigeriaandeastafrica",
]);

const ISLAM_BROWSE_PRIORITY = [
  "al-quran-al-kareem-tv",
  "al-sunnah-al-nabawiyah-tv",
  "makkah-tv",
  "iqraa-quran",
  "iqraa-africa-europe",
  "iqraa-arabic",
  "holy-quran-radio-saudi",
  "islam-channel-urdu",
  "radio-islam-sa",
  "channel-islam-international",
];

const GOSPEL_BROWSE_PRIORITY = [
  "hope-channel-africa",
  "redemption-tv",
  "trace-gospel",
  "tracegospel-fr-southernafrica",
];

/** Staff picks / My Links folder labels (also matched case-insensitively). */
export const RELIGION_SUBFOLDER_TAGS = ["Islam", "Gospel", "Hindu"] as const;

export function getReligionFolder(key: string): ReligionFolderDef | undefined {
  return FOLDER_BY_KEY[key as ReligionFolderKey];
}

export function isReligionFolderKey(key: string): key is ReligionFolderKey {
  return key in FOLDER_BY_KEY;
}

export function parseReligionFolderParam(
  folder: string,
): ReligionFolderKey | null {
  return isReligionFolderKey(folder) ? folder : null;
}

export function isIslamChannel(item: CatalogItem): boolean {
  if (item.categories.some((c) => /^islam$/i.test(c))) return true;
  if (
    /quran|sunnah|makkah|madinah|iqraa|islam channel|islam radio|radio islam|muslim/i.test(
      `${item.title} ${item.slug} ${item.categories.join(" ")}`,
    )
  ) {
    return true;
  }
  return CURATED_RELIGION_ISLAM.some((c) => c.slug === item.slug);
}

export function isGospelChannel(item: CatalogItem): boolean {
  if (item.categories.some((c) => /^gospel$|^christian$/i.test(c))) return true;
  if (GOSPEL_SLUGS.has(item.slug)) return true;
  if (/tracegospel-/i.test(item.slug)) return true;
  if (
    /hope channel|redemption|trace gospel|gospel ministry|christian/i.test(
      `${item.title} ${item.slug}`,
    )
  ) {
    return true;
  }
  return CURATED_RELIGION_GOSPEL.some((c) => c.slug === item.slug);
}

export function isHinduChannel(item: CatalogItem): boolean {
  if (item.categories.some((c) => /^hindu$/i.test(c))) return true;
  if (/aastha|sanskar|bhakti tv|hindu/i.test(item.title)) return true;
  return CURATED_RELIGION_HINDU.some((c) => c.slug === item.slug);
}

export function getReligionFolderForItem(
  item: CatalogItem,
): ReligionFolderKey | null {
  if (isIslamChannel(item)) return "islam";
  if (isGospelChannel(item)) return "gospel";
  if (isHinduChannel(item)) return "hindu";
  if (item.categories.some((c) => /^religion$|^religious$/i.test(c))) {
    return "gospel";
  }
  return null;
}

function mergeBySlug(...lists: CatalogItem[][]): CatalogItem[] {
  const map = new Map<string, CatalogItem>();
  for (const list of lists) {
    for (const item of list) {
      if (!map.has(item.slug)) map.set(item.slug, item);
    }
  }
  return [...map.values()];
}

function orderByPriority(
  items: CatalogItem[],
  priority: string[],
): CatalogItem[] {
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  const ordered = priority
    .map((slug) => bySlug.get(slug))
    .filter((item): item is CatalogItem => Boolean(item));
  const rest = items
    .filter((item) => !priority.includes(item.slug))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...ordered, ...rest];
}

export function buildReligionPool(catalogMatches: CatalogItem[]): CatalogItem[] {
  return mergeBySlug(
    CURATED_RELIGION,
    CURATED_RELIGION_GOSPEL,
    CURATED_RELIGION_HINDU,
    catalogMatches,
  ).sort((a, b) => a.title.localeCompare(b.title));
}

export function getReligionChannelsForFolder(
  pool: CatalogItem[],
  folder: ReligionFolderKey,
): CatalogItem[] {
  return pool
    .filter((item) => getReligionFolderForItem(item) === folder)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getReligionBrowseItems(pool: CatalogItem[]): CatalogItem[] {
  const islam = orderByPriority(
    getReligionChannelsForFolder(pool, "islam"),
    ISLAM_BROWSE_PRIORITY,
  ).slice(0, 5);
  const gospel = orderByPriority(
    getReligionChannelsForFolder(pool, "gospel"),
    GOSPEL_BROWSE_PRIORITY,
  ).slice(0, 3);
  return mergeBySlug(islam, gospel);
}

export function getReligionChannelBySlug(
  pool: CatalogItem[],
  slug: string,
): CatalogItem | undefined {
  return pool.find((item) => item.slug === slug);
}

export function normalizeReligionSubfolderTag(
  raw?: string | null,
): ReligionFolderKey | null {
  const value = (raw || "").trim().toLowerCase();
  if (value === "islam") return "islam";
  if (value === "gospel") return "gospel";
  if (value === "hindu") return "hindu";
  return null;
}

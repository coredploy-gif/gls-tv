import type { CatalogItem } from "@/data/types";
import { CURATED_RELIGION } from "@/data/curated-religion";

/** All curated religion channels (Islamic + existing catalog religion entries merge at hub level). */
export function getReligionChannels(): CatalogItem[] {
  return [...CURATED_RELIGION].sort((a, b) => a.title.localeCompare(b.title));
}

/** Priority order for home browse row — Makkah & Madinah first, then teaching. */
const BROWSE_PRIORITY = [
  "al-quran-al-kareem-tv",
  "al-sunnah-al-nabawiyah-tv",
  "makkah-tv",
  "iqraa-quran",
  "iqraa-africa-europe",
  "iqraa-arabic",
  "holy-quran-radio-saudi",
  "islam-channel-urdu",
];

export function getReligionBrowseItems(): CatalogItem[] {
  const bySlug = new Map(CURATED_RELIGION.map((item) => [item.slug, item]));
  const ordered = BROWSE_PRIORITY.map((slug) => bySlug.get(slug)).filter(
    (item): item is CatalogItem => Boolean(item),
  );
  const rest = CURATED_RELIGION.filter(
    (item) => !BROWSE_PRIORITY.includes(item.slug),
  ).sort((a, b) => a.title.localeCompare(b.title));
  return [...ordered, ...rest];
}

export function getReligionChannelBySlug(
  slug: string,
): CatalogItem | undefined {
  return CURATED_RELIGION.find((item) => item.slug === slug);
}

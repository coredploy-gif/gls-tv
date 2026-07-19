import type { CatalogItem } from "@/data/types";
import { curatedArtForSlug } from "@/data/channel-art";
import {
  isCinematicArtUrl,
  isLikelyChannelLogo,
} from "@/lib/artwork";
import playable from "@/data/generated/top10-playable.json";
import playableKidsJson from "@/data/generated/playable-kids.json";

type Raw = {
  title: string;
  url: string;
  slug: string;
  id?: string;
  poster?: string;
  countries?: string[];
  categories?: string[];
  segs?: number;
};

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&h=2400&q=92";
const FALLBACK_BACKDROP =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=3840&h=2160&q=92";

function toItem(
  raw: Raw,
  bucket: "Sports" | "News" | "Kids" | "Food",
): CatalogItem {
  const cats = new Set<string>([
    bucket,
    "Playable",
    "Verified",
    "Popular",
    ...(raw.categories ?? []),
  ]);
  if (raw.countries?.includes("gb")) cats.add("UK");

  const curated = curatedArtForSlug(raw.slug);
  const rawPoster = raw.poster;
  const keepLogo =
    rawPoster &&
    !isCinematicArtUrl(rawPoster) &&
    isLikelyChannelLogo(rawPoster)
      ? rawPoster
      : undefined;

  return {
    id: raw.id ?? `playable-${raw.slug}`,
    slug: raw.slug,
    title: raw.title.replace(/\s*\(.*?\)\s*$/, "").trim() || raw.title,
    type: "live",
    description: `${bucket} · browser-playable (CORS + segments verified)`,
    countries: raw.countries?.length ? raw.countries : ["world"],
    categories: [...cats],
    languages: ["English"],
    poster: curated?.poster || rawPoster || FALLBACK_POSTER,
    backdrop: curated?.backdrop || rawPoster || FALLBACK_BACKDROP,
    logoTitle: keepLogo,
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: raw.url,
        quality: "Auto",
        format: "hls",
      },
    ],
  };
}

/**
 * Fixed English kids Top 10 — US/UK FAST cartoons always, independent of
 * probe diversity (which mixed FR/IT/ES/IN/DE into the generated slice).
 */
const ENGLISH_KIDS_TOP10_SLUGS = [
  "happykids-us-sd",
  "mrbeanliveaction-uk-english",
  "toongoggles-us-sd",
  "ninjakidztv-us-sd",
  "legochannel-us-sd",
  "teletubbies-uk-sd",
  "yugioh-us-sd",
  "filmriseanime-us-sd",
  "moonbugkids-uk-sd",
  "babysharktv-us-sd",
] as const;

const BABY_SHARK_RAW: Raw = {
  title: "Baby Shark TV",
  slug: "babysharktv-us-sd",
  url: "https://newidco-babysharktv-1-us.roku.wurl.tv/playlist.m3u8",
  id: "iptv-babysharktv-us-sd",
  countries: ["us"],
  categories: ["Kids", "Animation"],
  poster: "https://i.imgur.com/SbBKr8L.png",
};

function buildEnglishKidsTop10(): CatalogItem[] {
  const bySlug = new Map<string, CatalogItem>();

  for (const item of playableKidsJson as CatalogItem[]) {
    if (item.slug) bySlug.set(item.slug, item);
  }
  for (const r of playable.kids as Raw[]) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, toItem(r, "Kids"));
  }
  if (!bySlug.has(BABY_SHARK_RAW.slug)) {
    bySlug.set(BABY_SHARK_RAW.slug, toItem(BABY_SHARK_RAW, "Kids"));
  }

  const out: CatalogItem[] = [];
  for (const slug of ENGLISH_KIDS_TOP10_SLUGS) {
    const hit = bySlug.get(slug);
    if (!hit) continue;
    const cats = new Set([
      ...hit.categories,
      "Kids",
      "Playable",
      "Verified",
      "Popular",
      "EnglishKids",
    ]);
    const curated = curatedArtForSlug(slug);
    out.push({
      ...hit,
      languages: ["English"],
      categories: [...cats],
      poster: curated?.poster || hit.poster,
      backdrop: curated?.backdrop || hit.backdrop,
      featured: true,
    });
  }
  return out.slice(0, 10);
}

export const TOP10 = {
  sports: (playable.sports as Raw[]).map((r) => toItem(r, "Sports")),
  news: [
    toItem(
      {
        title: "Al Jazeera English",
        slug: "al-jazeera-english",
        url: "https://cdn-7.pishow.tv/live/429/master.m3u8",
        id: "playable-al-jazeera-english",
        countries: ["qa", "world"],
        categories: ["News"],
        poster:
          "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1600&h=2400&q=92",
      },
      "News",
    ),
    ...(playable.news as Raw[])
      .map((r) => toItem(r, "News"))
      .filter((i) => i.slug !== "al-jazeera-english"),
  ].slice(0, 10),
  /** Always English US/UK cartoon FAST — not the mixed intl probe slice. */
  kids: buildEnglishKidsTop10(),
  food: (playable.food as Raw[]).map((r) => toItem(r, "Food")),
};

export const TOP10_CATEGORIES = [
  { key: "sports" as const, title: "Top 10 Sports · Playable" },
  { key: "news" as const, title: "Top 10 News · Playable" },
  { key: "kids" as const, title: "Top 10 Kids · English" },
  { key: "food" as const, title: "Top 10 Food · Playable" },
];

export function getEnglishKidsTop10(): CatalogItem[] {
  return [...TOP10.kids];
}

export function getAllTop10(): CatalogItem[] {
  const map = new Map<string, CatalogItem>();
  for (const list of Object.values(TOP10)) {
    for (const item of list) {
      if (!map.has(item.slug)) map.set(item.slug, item);
    }
  }
  return [...map.values()];
}

export function getUkTop(): CatalogItem[] {
  return getAllTop10()
    .filter((c) => c.categories.includes("UK") || c.countries.includes("gb"))
    .slice(0, 10);
}

export function getPopularFirst(): CatalogItem[] {
  return getAllTop10().filter((c) => c.categories.includes("Popular"));
}

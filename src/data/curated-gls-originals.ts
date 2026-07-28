import type { CatalogItem } from "./types";

/**
 * GLS TV Originals — your own adult animation + kids cartoons.
 *
 * How to publish a title:
 * 1. Host each episode/film as MP4 or VOD HLS on a CDN (Cloudflare R2, Bunny, S3, etc.)
 *    or temporarily under `public/media/` for small samples.
 * 2. Replace `url` below with that HTTPS link (keep `isLive: false` for pause/rewind).
 * 3. Set poster/backdrop images (CDN or Unsplash/archive).
 * 4. Deploy — titles appear on /series under “GLS TV Originals”.
 *
 * Kids titles also get Kids/Family categories so they show on /kids.
 * Adult animation stays off kids categories.
 */

type MediaFormat = "mp4" | "hls" | "dash";

function originalSeries(input: {
  slug: string;
  title: string;
  description: string;
  year: number;
  categories: string[];
  poster: string;
  backdrop?: string;
  url: string;
  format?: MediaFormat;
  quality?: string;
  seasons?: number;
  episodes?: number;
  runtime?: string;
  rating?: string;
  audience: "adult" | "kids";
  featured?: boolean;
}): CatalogItem {
  const format = input.format ?? "mp4";
  const audienceTags =
    input.audience === "kids"
      ? ["Kids", "Family", "Cartoon"]
      : ["Animation", "AdultAnimation"];
  return {
    id: `gls-original-${input.slug}`,
    slug: input.slug,
    title: input.title,
    type: "series",
    description: input.description,
    year: input.year,
    runtime: input.runtime,
    countries: ["world", "za"],
    categories: [
      "Series",
      "OnDemand",
      "VOD",
      "Playable",
      "Curated",
      "GLS Original",
      "Originals",
      ...audienceTags,
      ...input.categories,
    ],
    languages: ["English"],
    poster: input.poster,
    backdrop: input.backdrop || input.poster,
    rating: input.rating,
    license: "rights_managed",
    isLive: false,
    seasons: input.seasons ?? 1,
    episodes: input.episodes ?? 1,
    featured: input.featured ?? true,
    sources: [
      {
        url: input.url,
        quality: input.quality ?? "HD",
        format,
        priority: 20,
        label: "gls-original",
      },
    ],
  };
}

const poster = (id: string, w = 1600, h = 2400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=90`;

/**
 * Replace sample URLs with your real CDN episode links when ready.
 * Sample MP4s keep the shelf playable until your masters are uploaded.
 */
export const GLS_TV_ORIGINALS: CatalogItem[] = [
  originalSeries({
    slug: "gls-original-series-pilot",
    title: "GLS TV Original Series",
    description:
      "Flagship GLS TV Original adult animation series. Replace this sample stream with your episode master (MP4 or VOD HLS) when ready.",
    year: 2026,
    categories: ["Drama"],
    poster: poster("photo-1618005182384-a83a8bd57fbe"),
    backdrop: poster("photo-1536440136628-849c177e76a1", 3840, 2160),
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    quality: "1080p",
    runtime: "pilot",
    rating: "16+",
    audience: "adult",
    seasons: 1,
    episodes: 1,
    featured: true,
  }),
  originalSeries({
    slug: "gls-kids-cartoon-club",
    title: "GLS Kids Cartoon Club",
    description:
      "GLS TV Original kids cartoons. Swap the sample URL for your cartoon episode files — they surface on Series and Kids hubs.",
    year: 2026,
    categories: ["Adventure", "Short"],
    poster: poster("photo-1516627145497-ae6968895b74"),
    backdrop: poster("photo-1502086229820-4c1f8fcf709b", 3840, 2160),
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    quality: "1080p",
    runtime: "episode",
    rating: "G",
    audience: "kids",
    seasons: 1,
    episodes: 1,
    featured: true,
  }),
];

export function getGlsOriginals(): CatalogItem[] {
  return GLS_TV_ORIGINALS;
}

export function getGlsOriginalsByAudience(
  audience: "adult" | "kids",
): CatalogItem[] {
  return GLS_TV_ORIGINALS.filter((item) =>
    audience === "kids"
      ? item.categories.some((c) => /^kids$/i.test(c))
      : item.categories.some((c) => /^adultanimation$/i.test(c)),
  );
}

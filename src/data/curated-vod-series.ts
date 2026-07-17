import type { CatalogItem } from "./types";

/**
 * On-demand series shelves (pause / rewind).
 * Public-domain, Creative Commons, or always-on sample VOD only — not live FAST.
 */
function vodSeries(input: {
  slug: string;
  title: string;
  description: string;
  year: number;
  categories: string[];
  poster: string;
  backdrop?: string;
  license: CatalogItem["license"];
  url: string;
  quality?: string;
  format?: MediaFormat;
  seasons?: number;
  episodes?: number;
  runtime?: string;
  countries?: string[];
  rating?: string;
  featured?: boolean;
  languages?: string[];
}): CatalogItem {
  const format = input.format ?? "mp4";
  return {
    id: `vod-series-${input.slug}`,
    slug: input.slug,
    title: input.title,
    type: "series",
    description: input.description,
    year: input.year,
    runtime: input.runtime,
    countries: input.countries ?? ["us", "world"],
    categories: [
      "Series",
      "OnDemand",
      "VOD",
      "Playable",
      "Curated",
      ...input.categories,
    ],
    languages: input.languages ?? ["English"],
    poster: input.poster,
    backdrop: input.backdrop || input.poster,
    rating: input.rating,
    license: input.license,
    isLive: false,
    seasons: input.seasons ?? 1,
    episodes: input.episodes ?? 1,
    featured: input.featured,
    sources: [
      {
        url: input.url,
        quality: input.quality ?? "SD",
        format,
        priority: 10,
        label: "vod-series",
      },
    ],
  };
}

type MediaFormat = "mp4" | "hls" | "dash";

const unsplash = (id: string, w = 1600, h = 2400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=90`;

const iaPoster = (id: string) => `https://archive.org/services/img/${id}`;

/** Seeded on-demand series for /series — genre rows + browse. */
export const CURATED_VOD_SERIES: CatalogItem[] = [
  // —— Drama ——
  vodSeries({
    slug: "charade-mystery-hour",
    title: "Charade Mystery Hour",
    description:
      "Public-domain Hitchcockian romance-thriller (1963) presented as a drama showcase. On demand — pause & rewind.",
    year: 1963,
    categories: ["Drama", "Mystery", "Romance", "Classic"],
    poster: iaPoster("Charade1963"),
    backdrop: unsplash("photo-1489599849927-2ee91cede3ba", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/Charade1963/Charade.mp4",
    quality: "SD",
    runtime: "1h 53m",
    rating: "NR",
    episodes: 1,
    featured: true,
  }),
  vodSeries({
    slug: "voyage-space-drama",
    title: "Voyage Space Drama",
    description:
      "Public-domain space adventure — episodic chapters for on-demand watching. Pause & rewind.",
    year: 1968,
    categories: ["Drama", "Sci-Fi", "Adventure"],
    poster: iaPoster("VoyageToThePlanetOfPrehistoricWomen"),
    backdrop: unsplash("photo-1451187580459-43490279c0fa", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/VoyageToThePlanetOfPrehistoricWomen/Voyage_to_the_Planet_of_Prehistoric_Women.mp4",
    quality: "SD",
    runtime: "1h 18m",
    rating: "G",
    episodes: 3,
  }),

  // —— Comedy ——
  vodSeries({
    slug: "his-girl-friday-comedy",
    title: "His Girl Friday Comedy Club",
    description:
      "Screwball newspaper comedy classic — rapid-fire dialogue and romantic chaos. On demand.",
    year: 1940,
    categories: ["Comedy", "Romance", "Classic"],
    poster: iaPoster("HisGirlFriday"),
    backdrop: unsplash("photo-1440404653325-ab6272b47367", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/HisGirlFriday/His_Girl_Friday.mp4",
    quality: "SD",
    runtime: "1h 32m",
    rating: "G",
    episodes: 1,
    featured: true,
  }),
  vodSeries({
    slug: "keaton-silent-comedy",
    title: "Keaton Silent Comedy",
    description:
      "Buster Keaton’s The General — train chases and silent-era laughs. Public domain. On demand.",
    year: 1926,
    categories: ["Comedy", "Silent", "Classic", "Adventure"],
    poster: iaPoster("TheGeneral"),
    backdrop: unsplash("photo-1517604931442-7e0c8ed2963c", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/TheGeneral/The_General_512kb.mp4",
    quality: "480p",
    runtime: "1h 18m",
    rating: "G",
    languages: ["Silent"],
    episodes: 1,
  }),

  // —— Sci-Fi ——
  vodSeries({
    slug: "plan9-sci-fi-shelf",
    title: "Plan 9 Sci-Fi Shelf",
    description:
      "Ed Wood’s cult classic Plan 9 from Outer Space — flying saucers and graveyard intrigue. On demand.",
    year: 1959,
    categories: ["Sci-Fi", "Horror", "Cult", "Classic"],
    poster: iaPoster("Plan_9_from_Outer_Space_1959"),
    backdrop: unsplash("photo-1451187580459-43490279c0fa", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/Plan_9_from_Outer_Space_1959/Plan_9_from_Outer_Space_1959.mp4",
    quality: "SD",
    runtime: "1h 19m",
    rating: "NR",
    episodes: 1,
  }),
  vodSeries({
    slug: "blender-tears-of-steel",
    title: "Tears of Steel · Open Sci-Fi",
    description:
      "Blender Foundation open movie — robots, memory, and a near-future Amsterdam. Creative Commons. On demand.",
    year: 2012,
    categories: ["Sci-Fi", "Action", "Animation", "Short"],
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Tears_of_Steel_poster.jpg/440px-Tears_of_Steel_poster.jpg",
    backdrop: unsplash("photo-1485846234645-a62644f84728", 3840, 2160),
    license: "creative_commons",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    quality: "1080p",
    runtime: "12m",
    rating: "PG-13",
    countries: ["world"],
    episodes: 1,
    featured: true,
  }),

  // —— Horror ——
  vodSeries({
    slug: "living-dead-horror-hour",
    title: "Living Dead Horror Hour",
    description:
      "Night of the Living Dead — the landmark public-domain zombie classic. On demand — pause & rewind.",
    year: 1968,
    categories: ["Horror", "Classic", "Thriller"],
    poster: iaPoster("night_of_the_living_dead"),
    backdrop: unsplash("photo-1509248961158-e54f6934749c", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4",
    quality: "480p",
    runtime: "1h 36m",
    rating: "PG-13",
    episodes: 1,
    featured: true,
  }),
  vodSeries({
    slug: "dementia13-thriller-night",
    title: "Dementia 13 Thriller Night",
    description:
      "Early Coppola gothic thriller — family secrets and an axe-wielding menace. Public domain. On demand.",
    year: 1963,
    categories: ["Horror", "Thriller", "Classic"],
    poster: iaPoster("Dementia_13"),
    backdrop: unsplash("photo-1535016120720-40c646be5580", 3840, 2160),
    license: "public_domain",
    url: "https://archive.org/download/Dementia_13/Dementia_13.mp4",
    quality: "SD",
    runtime: "1h 15m",
    rating: "NR",
    episodes: 1,
  }),

  // —— Animation ——
  vodSeries({
    slug: "blender-open-animation",
    title: "Blender Open Animation",
    description:
      "Big Buck Bunny — open-movie animation showcase. Creative Commons. On demand.",
    year: 2008,
    categories: ["Animation", "Kids", "Comedy", "Short"],
    poster:
      "https://peach.blender.org/wp-content/uploads/poster_bunny_small.jpg",
    backdrop: unsplash("photo-1535016120720-40c646be5580", 3840, 2160),
    license: "creative_commons",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    quality: "1080p",
    runtime: "10m",
    rating: "G",
    countries: ["world"],
    languages: ["None"],
    episodes: 1,
    featured: true,
  }),
  vodSeries({
    slug: "sintel-fantasy-series",
    title: "Sintel Fantasy Series",
    description:
      "A lonely young woman searches for a baby dragon she raised. Blender Foundation open movie. On demand.",
    year: 2010,
    categories: ["Animation", "Fantasy", "Adventure", "Short"],
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Sintel_poster.jpg/440px-Sintel_poster.jpg",
    backdrop: unsplash("photo-1574267432553-4b4628081c31", 3840, 2160),
    license: "creative_commons",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    quality: "1080p",
    runtime: "15m",
    rating: "G",
    countries: ["world"],
    episodes: 1,
  }),
  vodSeries({
    slug: "elephants-dream-anthology",
    title: "Elephants Dream Anthology",
    description:
      "The world’s first open movie — surreal journey through a mechanical world. On demand.",
    year: 2006,
    categories: ["Animation", "Sci-Fi", "Short"],
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream_s5_both.jpg/440px-Elephants_Dream_s5_both.jpg",
    backdrop: unsplash("photo-1536440136628-849c177e76a1", 3840, 2160),
    license: "creative_commons",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    quality: "1080p",
    runtime: "11m",
    rating: "G",
    countries: ["world"],
    episodes: 1,
  }),

  // —— Kids ——
  vodSeries({
    slug: "kids-sample-shorts",
    title: "Kids Sample Shorts",
    description:
      "Bright, short sample films for family-friendly on-demand browsing. Pause & rewind anytime.",
    year: 2015,
    categories: ["Kids", "Short", "Animation"],
    poster: unsplash("photo-1503454537195-1dcabb73ffb9"),
    backdrop: unsplash("photo-1478144592103-25e218a1bf9d", 3840, 2160),
    license: "creative_commons",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    quality: "1080p",
    runtime: "15s",
    rating: "G",
    countries: ["world"],
    episodes: 3,
  }),
  vodSeries({
    slug: "family-fun-reel",
    title: "Family Fun Reel",
    description:
      "Quick family-friendly sample reel — great for testing pause, scrub, and TV remote play. On demand.",
    year: 2015,
    categories: ["Kids", "Family", "Short", "Adventure"],
    poster: unsplash("photo-1516627145497-ae6968895b74"),
    backdrop: unsplash("photo-1502086229820-4c1f8fcf709b", 3840, 2160),
    license: "creative_commons",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    quality: "1080p",
    runtime: "15s",
    rating: "G",
    countries: ["world"],
    episodes: 2,
  }),
];

export const VOD_SERIES_GENRES = [
  "Drama",
  "Comedy",
  "Sci-Fi",
  "Horror",
  "Animation",
  "Kids",
  "Classic",
  "Adventure",
] as const;

export function getVodSeriesByGenre(genre: string): CatalogItem[] {
  return CURATED_VOD_SERIES.filter((item) =>
    item.categories.some((c) => c.toLowerCase() === genre.toLowerCase()),
  );
}

export function getAllVodSeries(): CatalogItem[] {
  return CURATED_VOD_SERIES;
}

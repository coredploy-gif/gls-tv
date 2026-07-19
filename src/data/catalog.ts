import type { CatalogItem, CountryMeta } from "./types";
import { CURATED_VOD_SERIES } from "./curated-vod-series";

export const COUNTRIES: CountryMeta[] = [
  { code: "za", name: "South Africa", flag: "🇿🇦" },
  { code: "ng", name: "Nigeria", flag: "🇳🇬" },
  { code: "ke", name: "Kenya", flag: "🇰🇪" },
  { code: "eg", name: "Egypt", flag: "🇪🇬" },
  { code: "gh", name: "Ghana", flag: "🇬🇭" },
  { code: "mw", name: "Malawi", flag: "🇲🇼" },
  { code: "zm", name: "Zambia", flag: "🇿🇲" },
  { code: "sz", name: "Eswatini", flag: "🇸🇿" },
  { code: "ls", name: "Lesotho", flag: "🇱🇸" },
  { code: "mz", name: "Mozambique", flag: "🇲🇿" },
  { code: "zw", name: "Zimbabwe", flag: "🇿🇼" },
  { code: "bw", name: "Botswana", flag: "🇧🇼" },
  { code: "ao", name: "Angola", flag: "🇦🇴" },
  { code: "et", name: "Ethiopia", flag: "🇪🇹" },
  { code: "so", name: "Somalia", flag: "🇸🇴" },
  { code: "ma", name: "Morocco", flag: "🇲🇦" },
  { code: "tz", name: "Tanzania", flag: "🇹🇿" },
  { code: "ug", name: "Uganda", flag: "🇺🇬" },
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "kr", name: "South Korea", flag: "🇰🇷" },
  { code: "cn", name: "China", flag: "🇨🇳" },
  { code: "jp", name: "Japan", flag: "🇯🇵" },
  { code: "tw", name: "Taiwan", flag: "🇹🇼" },
  { code: "hk", name: "Hong Kong", flag: "🇭🇰" },
  { code: "th", name: "Thailand", flag: "🇹🇭" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
  { code: "ph", name: "Philippines", flag: "🇵🇭" },
  { code: "vn", name: "Vietnam", flag: "🇻🇳" },
  { code: "my", name: "Malaysia", flag: "🇲🇾" },
  { code: "sg", name: "Singapore", flag: "🇸🇬" },
  { code: "bd", name: "Bangladesh", flag: "🇧🇩" },
  { code: "pk", name: "Pakistan", flag: "🇵🇰" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "br", name: "Brazil", flag: "🇧🇷" },
  { code: "sa", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "ae", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "tr", name: "Turkey", flag: "🇹🇷" },
  { code: "world", name: "Worldwide", flag: "🌍" },
];

export const LIVE_CATEGORIES = [
  "News",
  "Entertainment",
  "Sport",
  "Kids",
  "Music",
  "Documentary",
  "Religion",
  "Lifestyle",
] as const;

/** Public / open streams + public-domain VOD only. Deduped by id. */
export const CATALOG: CatalogItem[] = [
  // —— Featured / hero ——
  {
    id: "movie-night-of-the-living-dead",
    slug: "night-of-the-living-dead",
    title: "Night of the Living Dead",
    type: "movie",
    description:
      "A group of people hide from bloodthirsty zombies in a farmhouse. Landmark public-domain horror classic.",
    year: 1968,
    runtime: "1h 36m",
    countries: ["us"],
    categories: ["Horror", "Classic"],
    languages: ["English"],
    poster:
      "https://archive.org/services/img/night_of_the_living_dead",
    backdrop:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2400&q=80",
    rating: "PG-13",
    license: "public_domain",
    sources: [
      {
        url: "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4",
        quality: "480p",
        format: "mp4",
      },
    ],
    featured: true,
  },
  {
    id: "movie-his-girl-friday",
    slug: "his-girl-friday",
    title: "His Girl Friday",
    type: "movie",
    description:
      "A newspaper editor will do anything to keep his ace reporter — and ex-wife — from leaving for another job.",
    year: 1940,
    runtime: "1h 32m",
    countries: ["us"],
    categories: ["Comedy", "Romance", "Classic"],
    languages: ["English"],
    poster: "https://archive.org/services/img/HisGirlFriday",
    backdrop:
      "https://images.unsplash.com/photo-1440404653325-ab6272b47367?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "public_domain",
    sources: [
      {
        url: "https://archive.org/download/HisGirlFriday/His_Girl_Friday.mp4",
        quality: "SD",
        format: "mp4",
      },
    ],
    featured: true,
  },
  {
    id: "movie-charade",
    slug: "charade",
    title: "Charade",
    type: "movie",
    description:
      "Romance and suspense collide in Paris as a widow is hunted for fortune she never knew existed.",
    year: 1963,
    runtime: "1h 53m",
    countries: ["us", "fr"],
    categories: ["Thriller", "Romance", "Classic"],
    languages: ["English"],
    poster: "https://archive.org/services/img/Charade1963",
    backdrop:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=2400&q=80",
    rating: "NR",
    license: "public_domain",
    sources: [
      {
        url: "https://archive.org/download/Charade1963/Charade.mp4",
        quality: "SD",
        format: "mp4",
      },
    ],
  },
  {
    id: "movie-the-general",
    slug: "the-general",
    title: "The General",
    type: "movie",
    description:
      "Buster Keaton’s silent masterpiece of trains, chase, and comic timing.",
    year: 1926,
    runtime: "1h 18m",
    countries: ["us"],
    categories: ["Comedy", "Silent", "Classic"],
    languages: ["Silent"],
    poster: "https://archive.org/services/img/TheGeneral",
    backdrop:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "public_domain",
    sources: [
      {
        url: "https://archive.org/download/TheGeneral/The_General_512kb.mp4",
        quality: "480p",
        format: "mp4",
      },
    ],
  },
  {
    id: "movie-plan-9",
    slug: "plan-9-from-outer-space",
    title: "Plan 9 from Outer Space",
    type: "movie",
    description:
      "Aliens resurrect the dead to stop humanity’s atomic weapons. Cult sci-fi legend.",
    year: 1959,
    runtime: "1h 19m",
    countries: ["us"],
    categories: ["Sci-Fi", "Cult", "Classic"],
    languages: ["English"],
    poster: "https://archive.org/services/img/Plan_9_from_Outer_Space_1959",
    backdrop:
      "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=2400&q=80",
    rating: "NR",
    license: "public_domain",
    sources: [
      {
        url: "https://archive.org/download/Plan_9_from_Outer_Space_1959/Plan_9_from_Outer_Space_1959.mp4",
        quality: "SD",
        format: "mp4",
      },
    ],
  },
  {
    id: "movie-dementia-13",
    slug: "dementia-13",
    title: "Dementia 13",
    type: "movie",
    description:
      "Francis Ford Coppola’s early gothic horror of inheritance, axe murders, and family secrets.",
    year: 1963,
    runtime: "1h 15m",
    countries: ["us"],
    categories: ["Horror", "Thriller"],
    languages: ["English"],
    poster: "https://archive.org/services/img/Dementia_13",
    backdrop:
      "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=2400&q=80",
    rating: "NR",
    license: "public_domain",
    sources: [
      {
        url: "https://archive.org/download/Dementia_13/Dementia_13.mp4",
        quality: "SD",
        format: "mp4",
      },
    ],
  },
  {
    id: "movie-big-buck-bunny",
    slug: "big-buck-bunny",
    title: "Big Buck Bunny",
    type: "movie",
    description:
      "Open movie project short — a giant rabbit’s day of sweet revenge. Creative Commons.",
    year: 2008,
    runtime: "10m",
    countries: ["world"],
    categories: ["Animation", "Kids", "Short"],
    languages: ["None"],
    poster:
      "https://peach.blender.org/wp-content/uploads/poster_bunny_small.jpg",
    backdrop:
      "https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "creative_commons",
    sources: [
      {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        quality: "1080p",
        format: "mp4",
      },
    ],
    featured: true,
  },
  {
    id: "movie-elephants-dream",
    slug: "elephants-dream",
    title: "Elephants Dream",
    type: "movie",
    description:
      "The world’s first open movie — surreal journey through a mechanical world.",
    year: 2006,
    runtime: "11m",
    countries: ["world"],
    categories: ["Animation", "Sci-Fi", "Short"],
    languages: ["English"],
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream_s5_both.jpg/440px-Elephants_Dream_s5_both.jpg",
    backdrop:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "creative_commons",
    sources: [
      {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        quality: "1080p",
        format: "mp4",
      },
    ],
  },
  {
    id: "movie-sintel",
    slug: "sintel",
    title: "Sintel",
    type: "movie",
    description:
      "A lonely young woman searches for a baby dragon she raised. Blender Foundation open movie.",
    year: 2010,
    runtime: "15m",
    countries: ["world"],
    categories: ["Animation", "Fantasy", "Short"],
    languages: ["English"],
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Sintel_poster.jpg/440px-Sintel_poster.jpg",
    backdrop:
      "https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=2400&q=80",
    rating: "PG",
    license: "creative_commons",
    sources: [
      {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        quality: "1080p",
        format: "mp4",
      },
    ],
  },
  {
    id: "movie-tears-of-steel",
    slug: "tears-of-steel",
    title: "Tears of Steel",
    type: "movie",
    description:
      "Robots vs humans in a dystopian Amsterdam. Open movie with live-action VFX.",
    year: 2012,
    runtime: "12m",
    countries: ["world"],
    categories: ["Sci-Fi", "Action", "Short"],
    languages: ["English"],
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Tears_of_Steel_poster.jpg/440px-Tears_of_Steel_poster.jpg",
    backdrop:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=2400&q=80",
    rating: "PG-13",
    license: "creative_commons",
    sources: [
      {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        quality: "1080p",
        format: "mp4",
      },
    ],
  },

  // —— Series (public / open) ——
  {
    id: "series-voyager-archive",
    slug: "voyage-to-the-planet",
    title: "Voyage to the Planet of Prehistoric Women",
    type: "series",
    description:
      "Public-domain space adventure presented as episodic chapters. On demand (pause / rewind).",
    year: 1968,
    countries: ["us"],
    categories: ["Sci-Fi", "Adventure", "OnDemand"],
    languages: ["English"],
    poster: "https://archive.org/services/img/VoyageToThePlanetOfPrehistoricWomen",
    backdrop:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "public_domain",
    isLive: false,
    seasons: 1,
    episodes: 3,
    sources: [
      {
        url: "https://archive.org/download/VoyageToThePlanetOfPrehistoricWomen/Voyage_to_the_Planet_of_Prehistoric_Women.mp4",
        quality: "SD",
        format: "mp4",
      },
    ],
  },
  {
    id: "series-open-shorts",
    slug: "open-movie-anthology",
    title: "Open Movie Anthology",
    type: "series",
    description:
      "A curated shelf of Creative Commons open movies — animation, fantasy, and sci-fi. On demand (pause / rewind).",
    year: 2012,
    countries: ["world"],
    categories: ["Animation", "Anthology", "OnDemand"],
    languages: ["English"],
    poster:
      "https://peach.blender.org/wp-content/uploads/poster_bunny_small.jpg",
    backdrop:
      "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "creative_commons",
    isLive: false,
    seasons: 1,
    episodes: 4,
    sources: [
      {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        quality: "1080p",
        format: "mp4",
      },
    ],
    featured: true,
  },
  {
    id: "series-silent-classics",
    slug: "silent-classics",
    title: "Silent Classics",
    type: "series",
    description:
      "Restored public-domain silent cinema — comedy, chase, and early Hollywood craft. On demand (pause / rewind).",
    year: 1926,
    countries: ["us"],
    categories: ["Classic", "Silent", "Comedy", "OnDemand"],
    languages: ["Silent"],
    poster: "https://archive.org/services/img/TheGeneral",
    backdrop:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2400&q=80",
    rating: "G",
    license: "public_domain",
    isLive: false,
    seasons: 1,
    episodes: 2,
    sources: [
      {
        url: "https://archive.org/download/TheGeneral/The_General_512kb.mp4",
        quality: "480p",
        format: "mp4",
      },
    ],
  },

  // —— On-demand VOD series pack (pause / rewind) ——
  ...CURATED_VOD_SERIES,

  // —— Live TV (public open streams) ——
  {
    id: "live-nasa-public",
    slug: "nasa-tv-public",
    title: "NASA TV Public",
    type: "live",
    description: "Official NASA public education channel — launches, ISS, and science.",
    countries: ["us", "world"],
    categories: ["Documentary", "News"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-Public/master.m3u8",
        quality: "1080p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-hope-africa",
    slug: "hope-channel-africa",
    title: "Hope Channel Africa",
    type: "live",
    description: "Faith and lifestyle programming for African audiences.",
    countries: ["za"],
    categories: ["Religion", "Gospel", "Lifestyle"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=80",
    license: "fta_public",
    isLive: true,
    sources: [
      {
        url: "https://jstre.am/live/jsl:i1onRBELcGV.m3u8",
        quality: "1080p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-ln24",
    slug: "ln24-sa",
    title: "LN24 SA",
    type: "live",
    description: "South African news and current affairs stream.",
    countries: ["za"],
    categories: ["News"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1504711332673-fb914d329d74?auto=format&fit=crop&w=2400&q=80",
    license: "fta_public",
    isLive: true,
    sources: [
      {
        url: "https://cdnstack.internetmultimediaonline.org/ln24/ln24.stream/playlist.m3u8",
        quality: "1080p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-boktv",
    slug: "bok-tv",
    title: "BOK TV",
    type: "live",
    description: "South African entertainment and lifestyle channel.",
    countries: ["za"],
    categories: ["Entertainment", "Lifestyle"],
    languages: ["Afrikaans", "English"],
    poster:
      "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=2400&q=80",
    license: "fta_public",
    isLive: true,
    sources: [
      {
        url: "https://livestream2.bokradio.co.za/hls/Bok5c.m3u8",
        quality: "720p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-redemption",
    slug: "redemption-tv",
    title: "Redemption TV Ministry",
    type: "live",
    description: "Gospel and ministry programming.",
    countries: ["za"],
    categories: ["Religion", "Gospel"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1438232993691-bcf2a1a83b99?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=2400&q=80",
    license: "fta_public",
    isLive: true,
    sources: [
      {
        url: "https://live.nixsat.com/play/rtm/index.m3u8",
        quality: "720p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-dw-english",
    slug: "dw-english",
    title: "DW English",
    type: "live",
    description: "Deutsche Welle English — global news and documentaries.",
    countries: ["de", "world"],
    categories: ["News", "Documentary"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8",
        quality: "1080p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-france24-en",
    slug: "france-24-english",
    title: "France 24 English",
    type: "live",
    description: "International news from Paris, in English.",
    countries: ["fr", "world"],
    categories: ["News"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1504711332673-fb914d329d74?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8",
        quality: "1080p",
        format: "hls",
      },
      {
        url: "https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_5000.m3u8",
        quality: "1080p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-al-jazeera-english",
    slug: "al-jazeera-english",
    title: "Al Jazeera English",
    type: "live",
    description:
      "Al Jazeera English — live world news from Doha (public web stream).",
    countries: ["qa", "world"],
    categories: ["News", "Popular", "Playable", "Verified"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: "https://cdn-7.pishow.tv/live/429/master.m3u8",
        quality: "1080p",
        format: "hls",
      },
    ],
  },
  {
    id: "live-cgtn",
    slug: "cgtn",
    title: "CGTN",
    type: "live",
    description: "China Global Television Network — world news and culture.",
    countries: ["world"],
    categories: ["News"],
    languages: ["English"],
    poster:
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=600&q=80",
    backdrop:
      "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://live.cgtn.com/1000e/prog_index.m3u8",
        quality: "720p",
        format: "hls",
      },
    ],
  },
];

export function getById(id: string) {
  return CATALOG.find((item) => item.id === id);
}

export function getBySlug(slug: string) {
  return CATALOG.find((item) => item.slug === slug);
}

export function getByType(type: CatalogItem["type"]) {
  return CATALOG.filter((item) => item.type === type);
}

export function getFeatured() {
  return CATALOG.filter((item) => item.featured);
}

export function getLiveByCountry(country: string) {
  return CATALOG.filter(
    (item) => item.type === "live" && item.countries.includes(country),
  );
}

export function getLiveCategoriesForCountry(country: string) {
  const cats = new Set<string>();
  getLiveByCountry(country).forEach((ch) =>
    ch.categories.forEach((c) => cats.add(c)),
  );
  return Array.from(cats).sort();
}

export function getLiveByCountryAndCategory(country: string, category: string) {
  return getLiveByCountry(country).filter((ch) =>
    ch.categories.some((c) => c.toLowerCase() === category.toLowerCase()),
  );
}

export function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

export function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOG.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.categories.some((c) => c.toLowerCase().includes(q)),
  );
}

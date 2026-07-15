import type { CatalogItem } from "./types";

const sportArt =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1600&h=2400&q=90";
const movieArt =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&h=2400&q=90";
const seriesArt =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1600&h=2400&q=90";

function sport(
  slug: string,
  title: string,
  url: string,
  countries: string[],
  quality: string,
): CatalogItem {
  return {
    id: `public-sport-${slug}`,
    slug,
    title,
    type: "live",
    description: "Public sports FAST channel · verified HLS manifest.",
    countries,
    categories: ["Sports", "Public", "FAST", "Playable", "Verified", "Curated"],
    languages: ["en"],
    poster: sportArt,
    backdrop: sportArt.replace("w=1600&h=2400", "w=3840&h=2160"),
    license: "fta_public",
    isLive: true,
    sources: [{ url, quality, format: "hls", priority: 10, label: "public-fast" }],
  };
}

function movie(
  slug: string,
  title: string,
  url: string,
  countries: string[],
): CatalogItem {
  return {
    id: `public-movie-${slug}`,
    slug,
    title,
    type: "movie",
    description: "Free-to-watch movie FAST channel · verified HLS manifest.",
    countries,
    categories: ["Movies", "Public", "FAST", "Playable", "Verified", "Curated"],
    languages: ["en"],
    poster: movieArt,
    backdrop: movieArt.replace("w=1600&h=2400", "w=3840&h=2160"),
    license: "fta_public",
    isLive: true,
    sources: [{ url, quality: "HD", format: "hls", priority: 10, label: "public-fast" }],
  };
}

/**
 * These are catalogue entries for active, user-managed Supabase seeds.
 * Their URLs are intentionally loaded at watch time by `withLiveSources`,
 * so the latest configured source remains the one GLS plays.
 */
function seriesSeed(
  slug: string,
  title: string,
  categories: string[],
): CatalogItem {
  return {
    id: `seeded-series-${slug}`,
    slug,
    title,
    type: "series",
    description: "24/7 series channel · source managed in GLS Eadmin.",
    countries: ["us", "world"],
    categories: ["Series", "Playable", "Curated", ...categories],
    languages: ["en"],
    poster: seriesArt,
    backdrop: seriesArt.replace("w=1600&h=2400", "w=3840&h=2160"),
    license: "open_stream",
    isLive: true,
    seasons: 1,
    sources: [],
  };
}

/** Public HTTPS feeds manually checked before inclusion (2026-07-14). */
export const CURATED_PUBLIC_SPORTS: CatalogItem[] = [
  sport("30a-golf-kingdom", "30A Golf Kingdom", "https://30a-tv.com/feeds/vidaa/golf.m3u8", ["us", "world"], "720p"),
  sport("acc-digital-network", "ACC Digital Network", "https://raycom-accdn-firetv.amagi.tv/playlist.m3u8", ["us", "world"], "1080p"),
  sport("alkass-one", "Alkass One", "https://liveeu-gcp.alkassdigital.net/alkass1-p/main.m3u8", ["world"], "1080p"),
  sport("alkass-two", "Alkass Two", "https://liveeu-gcp.alkassdigital.net/alkass2-p/main.m3u8", ["world"], "1080p"),
  sport("alkass-four", "Alkass Four", "https://liveeu-gcp.alkassdigital.net/alkass4-p/main.m3u8", ["world"], "1080p"),
  sport("cricket-gold", "Cricket Gold", "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", ["world"], "1080p"),
  sport("dd-sports", "DD Sports", "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8", ["in", "world"], "1080p"),
  sport("red-bull-tv", "Red Bull TV", "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8", ["world"], "1080p"),
  sport("tennis-channel-fast", "Tennis Channel", "https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg01444-tennischannelth-tennischannelnl-samsungnl/playlist.m3u8", ["world"], "1080p"),
];

export const CURATED_PUBLIC_MOVIES: CatalogItem[] = [
  movie("24-hour-free-movies", "24 Hour Free Movies", "https://d1b5mlajbmvkjv.cloudfront.net/v1/master/9d062541f2ff39b5c0f48b743c6411d25f62fc25/UDU-DistroTV/145.m3u8?ads.vf=7FhdsxqVxOi", ["us", "world"]),
  movie("30a-classic-movies", "30A TV Classic Movies", "https://30a-tv.com/feeds/pzaz/30atvmovies.m3u8", ["us", "world"]),
  movie("dust-alien-nation", "Alien Nation by DUST", "https://dqi7ayt2o24fn.cloudfront.net/playlist.m3u8", ["us", "world"]),
  movie("aflam-movies", "Aflam", "https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8", ["world"]),
];

export const CURATED_SERIES_SEEDS: CatalogItem[] = [
  seriesSeed("the-l-word", "The L Word", ["Drama"]),
  seriesSeed("startrek-us-us", "Star Trek", ["Sci-Fi"]),
  seriesSeed("startrekthenextgeneration-us-sd", "Star Trek: The Next Generation", ["Sci-Fi"]),
  seriesSeed("startrekvoyager-us-sd", "Star Trek: Voyager", ["Sci-Fi"]),
  seriesSeed("startrekdeepspacenine-us-sd", "Star Trek: Deep Space Nine", ["Sci-Fi"]),
  seriesSeed("the-walking-dead", "The Walking Dead Universe", ["Drama"]),
];

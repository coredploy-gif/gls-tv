import type { CatalogItem } from "./types";

/** Varied 4K-feel soccer plates — hashed per slug so sports tiles aren’t clones. */
const SOCCER_ART_IDS = [
  "photo-1574629810360-7efbbe195018", // stadium night
  "photo-1431324155629-1a6deb1dec8d", // crowd / stadium
  "photo-1522778119026-d647f0596c20", // ball on grass
  "photo-1579952363873-27f3bade9f55", // strike
  "photo-1517466787929-bc90951d0974", // match action
  "photo-1508098682721-e5dbc6094189", // stadium bowl
  "photo-1560272564-c83b66b1ad12", // pitch action
  "photo-1459865264687-595d652de67e", // aerial pitch
  "photo-1575361204480-aadea25e6d68", // green pitch
  "photo-1489944440615-453fc2b6a9a9", // youth soccer
  "photo-1606925797300-0b35e9d3864f", // ball close-up
  "photo-1624526267942-ab0ff8a3e972", // night floodlights
];

/** Kids / cartoon 4K-feel Unsplash plates (toys, play, color — not brand IP). */
const CARTOON_ART_IDS = [
  "photo-1566576912321-d58ddd7a6088", // building blocks
  "photo-1515488042361-ee00e0ddd4e4", // toys colorful
  "photo-1587654780291-39c9404d749b", // LEGO-like bricks
  "photo-1596464716127-f2a82984de30", // stuffed animals
  "photo-1503454537195-1dcabb73ffb9", // kids play
  "photo-1471286174890-9c112ffca5b4", // crayons
  "photo-1516627145497-ae6968895b74", // balloons / kids party
  "photo-1606092195730-5d7b9af1efc5", // puzzle toys
];

function hashSlug(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function soccerPoster(slug: string) {
  const id = SOCCER_ART_IDS[hashSlug(slug) % SOCCER_ART_IDS.length]!;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&h=2400&q=92`;
}

function soccerBackdrop(slug: string) {
  return soccerPoster(slug).replace("w=1600&h=2400", "w=3840&h=2160");
}

function cartoonPoster(slug: string) {
  const id = CARTOON_ART_IDS[hashSlug(slug) % CARTOON_ART_IDS.length]!;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&h=2400&q=92`;
}

function cartoonBackdrop(slug: string) {
  return cartoonPoster(slug).replace("w=1600&h=2400", "w=3840&h=2160");
}

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
    poster: soccerPoster(slug),
    backdrop: soccerBackdrop(slug),
    license: "fta_public",
    isLive: true,
    sources: [{ url, quality, format: "hls", priority: 10, label: "public-fast" }],
  };
}

function kidsCartoon(
  slug: string,
  title: string,
  url: string,
  countries: string[],
  extraCats: string[] = [],
): CatalogItem {
  return {
    id: `public-kids-${slug}`,
    slug,
    title,
    type: "live",
    description:
      "English kids / cartoon FAST · open Amagi/Wurl/CloudFront · 4K Unsplash art.",
    countries,
    categories: [
      "Kids",
      "Animation",
      "Public",
      "FAST",
      "Playable",
      "Verified",
      "Curated",
      "Popular",
      "EnglishKids",
      ...extraCats,
    ],
    languages: ["English"],
    poster: cartoonPoster(slug),
    backdrop: cartoonBackdrop(slug),
    license: "fta_public",
    isLive: true,
    featured: true,
    sources: [
      { url, quality: "HD", format: "hls", priority: 10, label: "public-kids-fast" },
    ],
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
 * 24/7 linear “series channels” (FAST-style), not Netflix-style episode VOD.
 * Playback is live HLS (`isLive: true`) → pause/scrub is limited (behind live).
 * URLs load at watch time via `withLiveSources` / Eadmin `stream_seeds`.
 * For on-demand pause/rewind, use catalog items with `isLive: false` + VOD MP4/HLS
 * (see Public anthologies on /series and docs/SERIES-LIVE-VS-VOD.md).
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
    description:
      "24/7 live series channel (FAST) · not on-demand episodes. Source managed in GLS Eadmin.",
    countries: ["us", "world"],
    categories: [
      "Series",
      "LiveSeries",
      "24/7",
      "Playable",
      "Curated",
      ...categories,
    ],
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

/**
 * English popular cartoon FAST — same pattern as sports soccer seeding:
 * legitimate Amagi/Wurl/CloudFront HLS + Unsplash 4K art. No pirate streams.
 * (No “Polar” brand exists in-repo; this is English popular cartoons.)
 */
export const CURATED_PUBLIC_KIDS: CatalogItem[] = [
  kidsCartoon(
    "babysharktv-us-sd",
    "Baby Shark TV",
    "https://newidco-babysharktv-1-us.roku.wurl.tv/playlist.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "brattv-us-sd",
    "Brat TV",
    "https://streams2.sofast.tv/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/04072b68-dc6a-4d5e-98af-f356ba8d5063/playlist.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "happykids-us-sd",
    "HappyKids",
    "https://dil9xdvretp0f.cloudfront.net/index.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "toongoggles-us-sd",
    "ToonGoggles",
    "https://amg01329-otterainc-toongoggles-samsungau-ad-4c.amagi.tv/playlist/amg01329-otterainc-toongoggles-samsungau/playlist.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "ninjakidztv-us-sd",
    "Ninja Kidz",
    "https://d3868b4ny0rgdf.cloudfront.net/playlist.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "legochannel-us-sd",
    "The LEGO Channel",
    "https://dltiqboxjw21d.cloudfront.net/index.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "teletubbies-uk-sd",
    "Teletubbies",
    "https://dv8lsrd8fecw9.cloudfront.net/master.m3u8",
    ["uk", "world"],
  ),
  kidsCartoon(
    "yugioh-us-sd",
    "Yu-Gi-Oh!",
    "https://amg01796-amg01796c19-rakuten-gb-7486.playouts.now.amagi.tv/playlist/amg01796-fastmediafast-yugioh2en-rakutengb/playlist.m3u8",
    ["us", "world"],
    ["Animation"],
  ),
  kidsCartoon(
    "filmriseanime-us-sd",
    "FilmRise Anime",
    "https://dvu7aia8rjlfm.cloudfront.net/master.m3u8",
    ["us", "world"],
    ["Animation"],
  ),
  kidsCartoon(
    "moonbugkids-uk-sd",
    "Moonbug Kids",
    "https://moonbug-rokuus.amagi.tv/playlist.m3u8",
    ["uk", "world"],
  ),
  kidsCartoon(
    "kartoonchannel-us-sd",
    "Kartoon Channel",
    "https://lightning-fnf-samsungaus.amagi.tv/playlist.m3u8",
    ["us", "world"],
  ),
  kidsCartoon(
    "mrbeanliveaction-uk-english",
    "Mr Bean Live Action",
    "https://amg00627-amg00627c40-rakuten-uk-5725.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanpopupcc-rakutenuk/playlist.m3u8",
    ["uk", "world"],
    ["Comedy"],
  ),
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

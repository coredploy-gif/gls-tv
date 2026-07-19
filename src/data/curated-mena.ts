import type { CatalogItem } from "@/data/types";

const NEWS_POSTER =
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=600&h=900&q=80";
const NEWS_BACKDROP =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=3840&h=2160&q=80";
const CULTURE_POSTER =
  "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=600&h=900&q=80";
const CULTURE_BACKDROP =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=3840&h=2160&q=80";

/** Official TRT medya.trt.com.tr public HTTPS masters (probed 2026-07-19). */
const TRT_WORLD =
  "https://tv-trtworld.medya.trt.com.tr/master_1080.m3u8";
const TRT_HABER =
  "https://tv-trthaber.medya.trt.com.tr/master_1080.m3u8";
const TRT_ARABI =
  "https://tv-trtarabi.medya.trt.com.tr/master_1080.m3u8";
const TRT_MUZIK =
  "https://tv-trtmuzik.medya.trt.com.tr/master.m3u8";
const TRT_TURK =
  "https://tv-trtturk.medya.trt.com.tr/master.m3u8";
const TRT_AVAZ =
  "https://tv-trtavaz.medya.trt.com.tr/master.m3u8";

/** Saudi Broadcasting Authority · Globecast Roku/FAST (same CDN family as Quran/Sunnah). */
const AL_EKHBARIYA =
  "https://cdn-globecast.akamaized.net/live/eds/al_ekhbariya/hls_roku/index.m3u8";

/** Al Arabiya Media (Dubai) official publish CDN. */
const AL_ARABIYA =
  "https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8";
const AL_HADATH =
  "https://live.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8";
const AL_ARABIYA_BIZ =
  "https://live.alarabiya.net/alarabiapublish/aswaaq.smil/playlist.m3u8";

/** Sky News Arabia · Abu Dhabi public HLS. */
const SKY_NEWS_ARABIA = "https://stream.skynewsarabia.com/hls/sna.m3u8";

function menaLive(
  id: string,
  slug: string,
  title: string,
  description: string,
  countries: string[],
  categories: string[],
  url: string,
  languages: string[],
  art: { poster: string; backdrop: string },
  featured = false,
): CatalogItem {
  return {
    id,
    slug,
    title,
    type: "live",
    description,
    countries,
    categories: [
      ...categories,
      "Curated",
      "Playable",
      "Verified",
      "Public",
    ],
    languages,
    poster: art.poster,
    backdrop: art.backdrop,
    license: "fta_public",
    isLive: true,
    featured,
    sources: [
      {
        url,
        quality: "HD",
        format: "hls",
        priority: 10,
        label: "official-public",
      },
    ],
  };
}

/**
 * Hand-probed public / official FAST streams for Saudi Arabia, UAE, and Turkey.
 * Only rights-safe public broadcaster CDNs — no pirate pay-TV dumps.
 * Probed HTTP 200 + #EXTM3U on 2026-07-19.
 *
 * Gaps (intentionally omitted): geo-blocked TRT 1/2/Spor/Çocuk, Dubai Media
 * Mangomolo hosts (DNS dead from this probe), encrypted KSA Sports.
 * Saudi religion channels live in curated-religion.ts (countries: sa).
 * MBC 5 already in playable-africa.json (countries: ae).
 */
export const CURATED_MENA: CatalogItem[] = [
  // —— Saudi Arabia ——
  menaLive(
    "curated-al-ekhbariya-sa",
    "al-ekhbariya",
    "Al Ekhbariya",
    "Saudi Broadcasting Authority · national news channel (official Globecast FAST).",
    ["sa", "world"],
    ["News"],
    AL_EKHBARIYA,
    ["Arabic"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
    true,
  ),

  // —— United Arab Emirates ——
  menaLive(
    "curated-al-arabiya-ae",
    "al-arabiya",
    "Al Arabiya",
    "Al Arabiya · pan-Arab news from Dubai (official Al Arabiya publish CDN).",
    ["ae", "world"],
    ["News"],
    AL_ARABIYA,
    ["Arabic"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
    true,
  ),
  menaLive(
    "curated-al-hadath-ae",
    "al-hadath",
    "Al Hadath",
    "Al Arabiya Al Hadath · rolling news and current affairs (official publish CDN).",
    ["ae", "world"],
    ["News"],
    AL_HADATH,
    ["Arabic"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
  ),
  menaLive(
    "curated-al-arabiya-business-ae",
    "al-arabiya-business",
    "Al Arabiya Business",
    "Al Arabiya Business · markets and economy (official Aswaaq publish stream).",
    ["ae", "world"],
    ["News", "Business"],
    AL_ARABIYA_BIZ,
    ["Arabic"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
  ),
  menaLive(
    "curated-sky-news-arabia-ae",
    "sky-news-arabia",
    "Sky News Arabia",
    "Sky News Arabia · Abu Dhabi 24-hour Arabic news (official public HLS).",
    ["ae", "world"],
    ["News"],
    SKY_NEWS_ARABIA,
    ["Arabic"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
    true,
  ),

  // —— Turkey ——
  menaLive(
    "curated-trt-world-tr",
    "trt-world",
    "TRT World",
    "Turkish Radio and Television · English international news (official medya.trt.com.tr).",
    ["tr", "world"],
    ["News"],
    TRT_WORLD,
    ["English"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
    true,
  ),
  menaLive(
    "curated-trt-haber-tr",
    "trt-haber",
    "TRT Haber",
    "TRT · Turkish-language national news (official medya.trt.com.tr).",
    ["tr", "world"],
    ["News"],
    TRT_HABER,
    ["Turkish"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
    true,
  ),
  menaLive(
    "curated-trt-arabi-tr",
    "trt-arabi",
    "TRT Arabi",
    "TRT · Arabic-language international news (official medya.trt.com.tr).",
    ["tr", "world"],
    ["News"],
    TRT_ARABI,
    ["Arabic"],
    { poster: NEWS_POSTER, backdrop: NEWS_BACKDROP },
  ),
  menaLive(
    "curated-trt-muzik-tr",
    "trt-muzik",
    "TRT Müzik",
    "TRT · Turkish music channel (official medya.trt.com.tr).",
    ["tr", "world"],
    ["Music"],
    TRT_MUZIK,
    ["Turkish"],
    { poster: CULTURE_POSTER, backdrop: CULTURE_BACKDROP },
  ),
  menaLive(
    "curated-trt-turk-tr",
    "trt-turk",
    "TRT Türk",
    "TRT · culture and diaspora programming (official medya.trt.com.tr).",
    ["tr", "world"],
    ["Entertainment", "Culture"],
    TRT_TURK,
    ["Turkish"],
    { poster: CULTURE_POSTER, backdrop: CULTURE_BACKDROP },
  ),
  menaLive(
    "curated-trt-avaz-tr",
    "trt-avaz",
    "TRT Avaz",
    "TRT · Turkic-world culture and news (official medya.trt.com.tr).",
    ["tr", "world"],
    ["Entertainment", "Culture"],
    TRT_AVAZ,
    ["Turkish"],
    { poster: CULTURE_POSTER, backdrop: CULTURE_BACKDROP },
  ),
];

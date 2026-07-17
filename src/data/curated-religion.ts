import type { CatalogItem } from "@/data/types";

const MAKKAH_POSTER =
  "https://images.unsplash.com/photo-1591604129939-f1efa4a5a7f2?auto=format&fit=crop&w=600&h=900&q=80";
const MAKKAH_BACKDROP =
  "https://images.unsplash.com/photo-1591604129939-f1efa4a5a7f2?auto=format&fit=crop&w=3840&h=2160&q=80";
const MADINAH_POSTER =
  "https://images.unsplash.com/photo-1564769625905-50d9c0d2e8a8?auto=format&fit=crop&w=600&h=900&q=80";
const MADINAH_BACKDROP =
  "https://images.unsplash.com/photo-1564769625905-50d9c0d2e8a8?auto=format&fit=crop&w=3840&h=2160&q=80";
const QURAN_POSTER =
  "https://images.unsplash.com/photo-1609599006353-1c8e0e8e8e8e?auto=format&fit=crop&w=600&h=900&q=80";
const QURAN_BACKDROP =
  "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=3840&h=2160&q=80";
const TEACHING_POSTER =
  "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&h=900&q=80";
const TEACHING_BACKDROP =
  "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=3840&h=2160&q=80";

/** Globecast CDN — official Saudi Broadcasting Authority feeds (Roku/FAST distribution). */
const QURAN_GLOBECAST =
  "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8";
const SUNNAH_GLOBECAST =
  "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8";
/** Saudi Ministry of Media legacy RTMP/HLS mirrors (cleartext HTTP — relay via /api/hls). */
const QURAN_NET_SA = "http://m.live.net.sa:1935/live/quran/playlist.m3u8";
const SUNNAH_NET_SA = "http://m.live.net.sa:1935/live/sunnah/playlist.m3u8";

/**
 * Verified Islamic channels (HTTP 200 probed 2026-07-18).
 * Official Saudi Makkah/Madinah, Iqraa teaching, and Holy Quran Radio only.
 * SA Radio Islam additions from parallel agents should use categories: Religion, Islam.
 */
export const CURATED_RELIGION_ISLAM: CatalogItem[] = [
  {
    id: "curated-quran-kareem-makkah",
    slug: "al-quran-al-kareem-tv",
    title: "Al Quran Al Kareem TV",
    type: "live",
    description:
      "Saudi Broadcasting Authority · live from Masjid al-Haram, Makkah — five daily prayers, Taraweeh, and Quran recitation 24/7.",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Makkah", "Curated", "Playable", "Verified"],
    languages: ["Arabic"],
    poster: MAKKAH_POSTER,
    backdrop: MAKKAH_BACKDROP,
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: QURAN_GLOBECAST,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "globecast-official",
      },
      {
        url: QURAN_NET_SA,
        quality: "720p",
        format: "hls",
        priority: 20,
        label: "sbc-net-sa-mirror",
      },
    ],
  },
  {
    id: "curated-sunnah-madinah",
    slug: "al-sunnah-al-nabawiyah-tv",
    title: "Al Sunnah Al Nabawiyah TV",
    type: "live",
    description:
      "Saudi Broadcasting Authority · live from Masjid an-Nabawi, Madinah — prayers, Friday khutbah, Taraweeh, and Sunnah teaching.",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Madinah", "Curated", "Playable", "Verified"],
    languages: ["Arabic"],
    poster: MADINAH_POSTER,
    backdrop: MADINAH_BACKDROP,
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: SUNNAH_GLOBECAST,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "globecast-official",
      },
      {
        url: SUNNAH_NET_SA,
        quality: "720p",
        format: "hls",
        priority: 20,
        label: "sbc-net-sa-mirror",
      },
    ],
  },
  {
    id: "curated-makkah-tv",
    slug: "makkah-tv",
    title: "Makkah TV",
    type: "live",
    description:
      "Makkah TV · live coverage from the holy sites and Makkah programming (official StreamBrothers CDN).",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Makkah", "Curated", "Playable", "Verified"],
    languages: ["Arabic"],
    poster: MAKKAH_POSTER,
    backdrop: MAKKAH_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://media2.streambrothers.com:1936/8122/8122/playlist.m3u8",
        quality: "576p",
        format: "hls",
        label: "streambrothers-official",
      },
    ],
  },
  {
    id: "curated-iqraa-quran",
    slug: "iqraa-quran",
    title: "Iqraa Quran",
    type: "live",
    description:
      "Iqraa · Quran recitation, tafsir, and Islamic teaching (official FastTV CDN).",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Quran", "Curated", "Playable", "Verified"],
    languages: ["Arabic"],
    poster: QURAN_POSTER,
    backdrop: QURAN_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv2/playlist.m3u8",
        quality: "1080p",
        format: "hls",
        label: "iqraa-official",
      },
    ],
  },
  {
    id: "curated-iqraa-africa-europe",
    slug: "iqraa-africa-europe",
    title: "Iqraa Africa & Europe",
    type: "live",
    description:
      "Iqraa · Islamic education and family programming for Africa and Europe (official FastTV CDN).",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Curated", "Playable", "Verified"],
    languages: ["Arabic", "English", "French"],
    poster: TEACHING_POSTER,
    backdrop: TEACHING_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv1/playlist.m3u8",
        quality: "1080p",
        format: "hls",
        label: "iqraa-official",
      },
    ],
  },
  {
    id: "curated-iqraa-arabic",
    slug: "iqraa-arabic",
    title: "Iqraa Arabic",
    type: "live",
    description:
      "Iqraa · Arabic-language Islamic lectures, Quran, and family content (official FastTV CDN).",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Curated", "Playable", "Verified"],
    languages: ["Arabic"],
    poster: TEACHING_POSTER,
    backdrop: TEACHING_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv3/playlist.m3u8",
        quality: "1080p",
        format: "hls",
        label: "iqraa-official",
      },
    ],
  },
  {
    id: "curated-holy-quran-radio",
    slug: "holy-quran-radio-saudi",
    title: "Holy Quran Radio",
    type: "live",
    description:
      "Saudi Broadcasting Authority · 24/7 Quran recitation radio (official Kwikmotion CDN).",
    countries: ["sa", "world"],
    categories: ["Religion", "Islam", "Radio", "Quran", "Curated", "Playable", "Verified"],
    languages: ["Arabic"],
    poster: QURAN_POSTER,
    backdrop: QURAN_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://live.kwikmotion.com/sbrksaquranradiolive/srpksaquranradio/playlist.m3u8",
        quality: "Auto",
        format: "hls",
        label: "sbc-kwikmotion-official",
      },
    ],
  },
  {
    id: "curated-islam-channel-urdu",
    slug: "islam-channel-urdu",
    title: "Islam Channel Urdu",
    type: "live",
    description:
      "Islam Channel · Urdu-language Islamic teaching and community programming (official Simplestream CDN).",
    countries: ["gb", "world"],
    categories: ["Religion", "Islam", "Curated", "Playable", "Verified"],
    languages: ["Urdu", "English"],
    poster: TEACHING_POSTER,
    backdrop: TEACHING_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: "https://live-islamtv-urdu.simplestreamcdn.com/live13/islamtv_urdu/bitrate1.isml/live.m3u8",
        quality: "576p",
        format: "hls",
        label: "islamchannel-official",
      },
    ],
  },
];

/** Gospel / Christian channels — also discovered via catalog + Africa curated heals. */
export const CURATED_RELIGION_GOSPEL: CatalogItem[] = [];

/** Hindu devotional — empty until verified official public HLS streams are added. */
export const CURATED_RELIGION_HINDU: CatalogItem[] = [];

export const CURATED_RELIGION: CatalogItem[] = [
  ...CURATED_RELIGION_ISLAM,
  ...CURATED_RELIGION_GOSPEL,
  ...CURATED_RELIGION_HINDU,
];

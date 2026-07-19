import type { CatalogItem } from "@/data/types";

/** Official HLS from mbc.mw/live/tv1.html (BozzTV CDN — 404 as of 2026-07-18 probe). */
const MBC_TV_1 =
  "https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8";
/** Official HLS from mbc.mw/live/tv2.html (BozzTV CDN — 404 as of 2026-07-18 probe). */
const MBC_TV_2 =
  "https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8";

const MBC_POSTER =
  "https://mbc.mw/storage/2017/11/cropped-MBC-Logo.jpg?v=1645026253";
const MBC_BACKDROP =
  "https://images.unsplash.com/photo-1522868514708-6a4f9f31edb1?auto=format&fit=crop&w=3840&h=2160&q=80";

/**
 * MBC linear TV — official mbc.mw/live BozzTV HLS.
 * Shown on browse even when the CDN is flaky; descriptions warn playback may fail.
 */
export const CURATED_MALAWI_TV: CatalogItem[] = [
  {
    id: "curated-mbc-tv-1",
    slug: "mbc-tv-1",
    title: "MBC TV",
    type: "live",
    description:
      "Malawi Broadcasting Corporation · national television (English & Chichewa). Official mbc.mw/live stream — may be offline when MBC’s CDN is down.",
    countries: ["mw"],
    categories: [
      "News",
      "General",
      "Africa",
      "Curated",
      "Playable",
      "Public",
      "MBC",
      "Malawi TV",
    ],
    languages: ["English", "Chichewa"],
    poster: MBC_POSTER,
    backdrop: MBC_BACKDROP,
    license: "fta_public",
    isLive: true,
    featured: true,
    sources: [
      {
        url: MBC_TV_1,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "mbc-official-bozztv",
      },
    ],
  },
  {
    id: "curated-mbc-tv-2",
    slug: "mbc-tv-2",
    title: "MBC TV 2",
    type: "live",
    description:
      "MBC 2 On the Go · sports, entertainment & youth programming. Official mbc.mw/live stream — may be offline when MBC’s CDN is down.",
    countries: ["mw"],
    categories: [
      "Entertainment",
      "Sports",
      "Africa",
      "Curated",
      "Playable",
      "Public",
      "MBC",
      "Malawi TV",
    ],
    languages: ["English", "Chichewa"],
    poster: MBC_POSTER,
    backdrop: MBC_BACKDROP,
    license: "fta_public",
    isLive: true,
    featured: false,
    sources: [
      {
        url: MBC_TV_2,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "mbc-official-bozztv",
      },
    ],
  },
];

/** Alias kept for older imports / restore scripts. */
export const MALAWI_TV_OFFLINE_SEEDS = CURATED_MALAWI_TV;

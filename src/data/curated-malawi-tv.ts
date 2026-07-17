import type { CatalogItem } from "@/data/types";

/** Official HLS from mbc.mw/live/tv1.html (probed 2026-07). */
const MBC_TV_1 =
  "https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8";
/** Official HLS from mbc.mw/live/tv2.html (probed 2026-07). */
const MBC_TV_2 =
  "https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8";

const MBC_POSTER =
  "https://mbc.mw/storage/2017/11/cropped-MBC-Logo.jpg?v=1645026253";
const MBC_BACKDROP =
  "https://images.unsplash.com/photo-1522868514708-6a4f9f31edb1?auto=format&fit=crop&w=3840&h=2160&q=80";

/**
 * Official MBC linear TV — URLs published on mbc.mw/live (BozzTV CDN).
 * CDN may be intermittent; GLS uses /api/hls with MBC Referer when needed.
 */
export const CURATED_MALAWI_TV: CatalogItem[] = [
  {
    id: "curated-mbc-tv-1",
    slug: "mbc-tv-1",
    title: "MBC TV",
    type: "live",
    description:
      "Malawi Broadcasting Corporation · national television (English & Chichewa). Official mbc.mw/live stream.",
    countries: ["mw"],
    categories: [
      "News",
      "General",
      "Africa",
      "Curated",
      "Playable",
      "Public",
      "MBC",
    ],
    languages: ["English", "Chichewa"],
    poster: MBC_POSTER,
    backdrop: MBC_BACKDROP,
    license: "fta_public",
    isLive: true,
    featured: false,
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
      "MBC 2 On the Go · sports, entertainment & youth programming. Official mbc.mw/live/tv2.html stream.",
    countries: ["mw"],
    categories: [
      "Entertainment",
      "Sports",
      "Africa",
      "Curated",
      "Playable",
      "Public",
      "MBC",
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

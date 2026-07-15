import type { CatalogItem } from "@/data/types";
import { getAllTop10, TOP10 } from "@/data/top10";

/** Browser-playable live set = Top 10 grids (CORS + segment verified). */
export const VERIFIED_LIVE: CatalogItem[] = [
  ...getAllTop10(),
  {
    id: "verified-demo-sintel",
    slug: "demo-sintel",
    title: "Demo · Sintel",
    type: "movie",
    description:
      "Always-on Creative Commons file — proves the player if live is blocked.",
    countries: ["world"],
    categories: ["Demo", "Playable", "Verified"],
    languages: ["English"],
    year: 2010,
    runtime: "15m",
    poster:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Sintel_poster.jpg/440px-Sintel_poster.jpg",
    backdrop:
      "https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=2400&q=80",
    license: "creative_commons",
    isLive: false,
    featured: true,
    sources: [
      {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        quality: "1080p",
        format: "mp4",
      },
    ],
  },
];

export function getVerifiedLive() {
  return VERIFIED_LIVE.filter((c) => c.isLive);
}

export { TOP10 };

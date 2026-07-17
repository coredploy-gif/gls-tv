import type { CatalogItem } from "@/data/types";

export const RADIO_POSTER =
  "https://images.unsplash.com/photo-1478737276239-08dbd63de3fb?auto=format&fit=crop&w=600&h=900&q=80";
export const RADIO_BACKDROP =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=3840&h=2160&q=80";

export function radioStation(
  id: string,
  slug: string,
  title: string,
  description: string,
  url: string,
  countries: string[],
  format: "hls" | "mp4" = "mp4",
  tags: string[] = [],
): CatalogItem {
  return {
    id,
    slug,
    title,
    type: "live",
    description,
    countries,
    categories: ["Radio", "Music", "Curated", "Playable", ...tags],
    languages: countries.includes("mw") ? ["English", "Chichewa"] : ["English"],
    poster: RADIO_POSTER,
    backdrop: RADIO_BACKDROP,
    license: "open_stream",
    isLive: true,
    featured: false,
    sources: [{ url, quality: "Auto", format, label: "official-stream" }],
  };
}

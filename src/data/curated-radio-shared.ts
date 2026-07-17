import type { CatalogItem } from "@/data/types";

export const RADIO_POSTER =
  "https://images.unsplash.com/photo-1478737276239-08dbd63de3fb?auto=format&fit=crop&w=600&h=900&q=80";
export const RADIO_BACKDROP =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=3840&h=2160&q=80";

const DEFAULT_LANGUAGES: Record<string, string[]> = {
  mw: ["English", "Chichewa"],
  za: ["English", "Afrikaans"],
  ke: ["English", "Swahili"],
  ng: ["English", "Pidgin"],
  gh: ["English", "Twi"],
  zw: ["English", "Shona", "Ndebele"],
  tz: ["Swahili", "English"],
};

export function radioStation(
  id: string,
  slug: string,
  title: string,
  description: string,
  url: string,
  countries: string[],
  format: "hls" | "mp4" = "mp4",
  tags: string[] = [],
  languages?: string[],
): CatalogItem {
  const countryLang =
    countries.map((code) => DEFAULT_LANGUAGES[code]).find(Boolean) ?? ["English"];
  return {
    id,
    slug,
    title,
    type: "live",
    description,
    countries,
    categories: ["Radio", "Music", "Curated", "Playable", ...tags],
    languages: languages ?? countryLang,
    poster: RADIO_POSTER,
    backdrop: RADIO_BACKDROP,
    license: "open_stream",
    isLive: true,
    featured: false,
    sources: [{ url, quality: "Auto", format, label: "official-stream" }],
  };
}

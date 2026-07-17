import type { CatalogItem } from "@/data/types";
import { CURATED_RADIO_MW } from "@/data/curated-radio-mw";
import { CURATED_RADIO_ZA } from "@/data/curated-radio-za";

export const CURATED_RADIO: CatalogItem[] = [...CURATED_RADIO_ZA, ...CURATED_RADIO_MW];

export function getRadioStations(): CatalogItem[] {
  return [...CURATED_RADIO].sort((a, b) => a.title.localeCompare(b.title));
}

export function getRadioStationsByCountry(country: "za" | "mw"): CatalogItem[] {
  return CURATED_RADIO.filter((station) => station.countries.includes(country)).sort(
    (a, b) => a.title.localeCompare(b.title),
  );
}

export function getMalawiBrowseItems(): CatalogItem[] {
  return getRadioStationsByCountry("mw");
}

export function getRadioStationBySlug(
  slug: string,
): CatalogItem | undefined {
  return CURATED_RADIO.find((station) => station.slug === slug);
}

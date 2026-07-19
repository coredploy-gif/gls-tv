import type { CatalogItem, CountryMeta } from "@/data/types";
import {
  AFRICA_RADIO_BROWSE_FLAGSHIPS,
  CURATED_RADIO_AFRICA,
} from "@/data/curated-radio-africa";
import { CURATED_MALAWI_TV } from "@/data/curated-malawi-tv";
import { CURATED_RADIO_MW } from "@/data/curated-radio-mw";
import { CURATED_RADIO_ZA } from "@/data/curated-radio-za";

export const RADIO_COUNTRY_META: Record<string, CountryMeta> = {
  mw: { code: "mw", name: "Malawi", flag: "🇲🇼" },
  za: { code: "za", name: "South Africa", flag: "🇿🇦" },
  ke: { code: "ke", name: "Kenya", flag: "🇰🇪" },
  ng: { code: "ng", name: "Nigeria", flag: "🇳🇬" },
  gh: { code: "gh", name: "Ghana", flag: "🇬🇭" },
  zw: { code: "zw", name: "Zimbabwe", flag: "🇿🇼" },
  tz: { code: "tz", name: "Tanzania", flag: "🇹🇿" },
};

/** Display order for /radio country rows (SA + Malawi first, then expanded Africa). */
export const RADIO_COUNTRY_ORDER = ["mw", "za", "ke", "ng", "gh", "zw", "tz"] as const;

export type RadioCountryCode = (typeof RADIO_COUNTRY_ORDER)[number];

export const CURATED_RADIO: CatalogItem[] = [
  ...CURATED_RADIO_ZA,
  ...CURATED_RADIO_MW,
  ...CURATED_RADIO_AFRICA,
];

export function getRadioStations(): CatalogItem[] {
  return [...CURATED_RADIO].sort((a, b) => a.title.localeCompare(b.title));
}

export function getRadioStationsByCountry(country: RadioCountryCode): CatalogItem[] {
  return CURATED_RADIO.filter((station) => station.countries.includes(country)).sort(
    (a, b) => a.title.localeCompare(b.title),
  );
}

export function getRadioCountryGroups(): { country: CountryMeta; stations: CatalogItem[] }[] {
  return RADIO_COUNTRY_ORDER.map((code) => ({
    country: RADIO_COUNTRY_META[code],
    stations: getRadioStationsByCountry(code),
  })).filter((group) => group.stations.length > 0);
}

/** Malawi TV first (visible even if CDN flaky), then radio. */
export function getMalawiBrowseItems(): CatalogItem[] {
  return [...CURATED_MALAWI_TV, ...getRadioStationsByCountry("mw")];
}

/** One flagship per country for home browse (avoids duplicating the full /radio grid). */
export function getAfricaRadioBrowseItems(): CatalogItem[] {
  const byId = new Map(CURATED_RADIO_AFRICA.map((station) => [station.id, station]));
  return (["ke", "ng", "gh", "zw", "tz"] as const)
    .map((code) => byId.get(AFRICA_RADIO_BROWSE_FLAGSHIPS[code] ?? ""))
    .filter((station): station is CatalogItem => Boolean(station));
}

export function getRadioStationBySlug(
  slug: string,
): CatalogItem | undefined {
  return CURATED_RADIO.find((station) => station.slug === slug);
}

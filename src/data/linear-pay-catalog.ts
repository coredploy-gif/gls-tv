import type { CatalogItem } from "@/data/types";

const ARENA_MARKETS = ["rs", "hr", "ba", "me", "mk", "si"];
const CATEGORIES = ["Sports", "LinearSports", "LinearPay", "Rights", "Catalog"];

function rightsManagedChannel(
  slug: string,
  title: string,
  countries: string[],
  categories = CATEGORIES,
): CatalogItem {
  return {
    id: `rights-${slug}`,
    slug,
    title,
    type: "live",
    description: `${title} is a linear pay-TV channel. GLS includes the catalog card for discovery and onboarding, but does not include a broadcaster subscription.`,
    countries,
    categories,
    languages: [],
    poster: "",
    backdrop: "",
    license: "rights_managed",
    isLive: true,
    sources: [],
  };
}

/**
 * Stable discovery cards for rights-managed channels.
 *
 * These deliberately contain no stream URLs. Playback remains with each
 * broadcaster or licensed regional provider and may require login/DRM.
 */
export const LINEAR_PAY_CATALOG: CatalogItem[] = [
  ...Array.from({ length: 10 }, (_, index) =>
    rightsManagedChannel(
      `arena-sport-${index + 1}`,
      `Arena Sport ${index + 1}`,
      ARENA_MARKETS,
    ),
  ),
  ...Array.from({ length: 5 }, (_, index) =>
    rightsManagedChannel(
      `arena-premium-${index + 1}`,
      `Arena Premium ${index + 1}`,
      ARENA_MARKETS,
    ),
  ),
  rightsManagedChannel("arena-fight", "Arena Fight", ARENA_MARKETS, [
    ...CATEGORIES,
    "Fight",
    "Combat",
  ]),
  rightsManagedChannel("match-arena", "Match! Arena", ["ru"]),
  rightsManagedChannel("vivacom-arena", "Vivacom Arena", ["bg"], [
    "Movies",
    "LinearPay",
    "Rights",
    "Catalog",
  ]),
];

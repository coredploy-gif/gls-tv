/**
 * Linear pay-TV channels (Arena Sport family, etc.) shown for discovery/onboarding
 * with an official-provider warning — not open HLS mirrors.
 */

export function isLinearPayCategory(categories: string[] | null | undefined) {
  return Boolean(
    categories?.some((c) =>
      /^(LinearPay|Rights)$/i.test(c) || c === "Unavailable",
    ),
  );
}

export function officialLinearPayDestination(
  slug: string,
  title?: string | null,
): { label: string; href: string; note: string } {
  const hay = `${slug} ${title || ""}`.toLowerCase();
  if (/match.?arena|матч.?арена|matcharena/.test(hay)) {
    return {
      label: "MATCH! official",
      href: "https://matchtv.ru/",
      note: "Match Arena is linear pay-TV. Use the official MATCH! service in your territory.",
    };
  }
  if (/vivacom/.test(hay)) {
    return {
      label: "Vivacom Arena",
      href: "https://www.vivacom.bg/",
      note: "Vivacom Arena is a linear pay channel. Subscribe via Vivacom for licensed viewing.",
    };
  }
  if (/arena\s*fight|arenafight/.test(hay)) {
    return {
      label: "Arena Sport official",
      href: "https://www.arenasport.com/",
      note: "Arena Fight is linear pay-TV. Open Arena Sport / your local cable-satellite package for licensed access.",
    };
  }
  // Default Balkan Arena Sport / Premium — plus SA onboarding path to DStv SuperSport
  return {
    label: "Arena Sport official",
    href: "https://www.arenasport.com/",
    note: "This is a linear pay-TV sports channel. GLS shows it for discovery and onboarding — watch via Arena Sport or your licensed provider (for example SuperSport on DStv in South Africa).",
  };
}

export const DSTV_SUPERSPORT = {
  label: "SuperSport · DStv",
  href: "https://www.dstv.com/en-za/",
} as const;

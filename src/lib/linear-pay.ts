/**
 * Linear pay-TV channels (Arena Sport family, etc.) shown for discovery/onboarding
 * with an official-provider warning — not open HLS mirrors.
 */

export function isLinearPayCategory(categories: string[] | null | undefined) {
  return Boolean(
    categories?.some((c) => /^(LinearPay|Rights)$/i.test(c)),
  );
}

export function officialLinearPayDestination(
  slug: string,
  title?: string | null,
  countries: string[] = [],
): { label: string; href: string; note: string } {
  const hay = `${slug} ${title || ""}`.toLowerCase();
  if (/match.?arena|матч.?арена|matcharena/.test(hay)) {
    return {
      label: "Open official Match! Arena",
      href: "https://matchtv.ru/video/channel/arena",
      note: "Match! Arena is rights-managed linear TV. GLS does not include a MATCH! subscription; availability, login, and playback are controlled by the official service.",
    };
  }
  if (/vivacom/.test(hay)) {
    return {
      label: "Open official Vivacom Arena",
      href: "https://www.vivacom.bg/eon-tv/arena",
      note: "Vivacom Arena is rights-managed linear TV. GLS does not include a Vivacom/EON subscription; use Vivacom for licensed access.",
    };
  }
  if (/arena[\s_-]*fight|arenafight/.test(hay)) {
    return {
      label: "Open official Arena Fight",
      href: "https://www.arenafighttv.com/",
      note: "Arena Fight is rights-managed linear TV. GLS does not include an Arena Cloud or broadcaster subscription.",
    };
  }

  const isCroatia = /(?:^|[-_])hr(?:$|[-_])|croatia|hrvats/i.test(hay);
  const isBosnia = /(?:^|[-_])ba(?:$|[-_])|bosnia|bih/i.test(hay);
  const onlyCountry = countries.length === 1 ? countries[0]?.toLowerCase() : "";
  const href =
    isCroatia || onlyCountry === "hr"
      ? "https://tvarenasport.hr/"
      : isBosnia || onlyCountry === "ba"
        ? "https://tvarenasport.ba/"
        : "https://www.tvarenasport.com/";

  return {
    label: "Open official Arena Sport",
    href,
    note: "This is rights-managed linear pay TV. GLS lists the channel for discovery and onboarding but does not include an Arena Sport, Arena Cloud, cable, or satellite subscription.",
  };
}

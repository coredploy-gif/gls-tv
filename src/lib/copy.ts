/**
 * App copy helpers — pure fallbacks + resolvers.
 * Server DB loading lives in `@/lib/copy-server` (do not import that from client).
 * Client: `useAppCopy` fetches `/api/copy` and resolves via `t()`.
 */

export const COPY_FALLBACKS = {
  "links.disclaimer":
    "You are responsible for any links you add. Only import media you have the right to watch. User-added links are not part of the GLS licensed catalog.",
  "auth.error.invalid_credentials":
    "Email or password is incorrect. Use Show to check your password, then try again.",
  "auth.error.breached_password":
    "That password appears in a known data breach. Choose a different, stronger password.",
  "auth.error.signups_paused": "Signups are temporarily paused.",
  "auth.error.oauth_unavailable":
    "That sign-in option isn’t available yet. Use email, or try again later.",
  "auth.error.oauth_failed":
    "Couldn’t continue with that account. Try again, or use email instead.",
  "auth.info.verify_email":
    "Check your email for a verification link, then sign in. You’ll pick who’s watching next. One free 14-day trial per device.",
  "player.geo_restricted":
    "This channel may be subject to regional or rights restrictions. Try one of the available news alternatives below.",
  "player.trace_urban_fallback":
    "Switching to Trace Urban — regional feed unavailable",
  "player.sister_fallback":
    "Switching to a working sister feed — primary stream unavailable",
  "faq.hero.eyebrow": "Help centre",
  "faq.hero.lead":
    "Straight answers about membership, playback, regions, and why GLS doesn’t ship a VPN. Local-first streaming — not geo-bypass.",
  "faq.aside.region_title": "Region reminder",
  "faq.aside.region_body":
    "If a stream is blocked on your network, GLS will not provide a VPN to get around it. Try another title, or the official service for that content in your country.",
} as const;

export type CopyKey = keyof typeof COPY_FALLBACKS;

export type AppCopyRow = {
  key: string;
  value: string;
  updated_at?: string;
  updated_by?: string | null;
};

/** Resolve a copy key with optional DB/API overrides. Never returns blank for known keys. */
export function t(
  key: CopyKey | string,
  overrides?: Record<string, string> | null,
): string {
  const fromOverride = overrides?.[key]?.trim();
  if (fromOverride) return fromOverride;
  const fallback = COPY_FALLBACKS[key as CopyKey];
  if (fallback) return fallback;
  return key;
}

/** All known keys with fallbacks merged under optional overrides. */
export function allCopyEntries(
  overrides?: Record<string, string> | null,
): AppCopyRow[] {
  const keys = new Set<string>([
    ...Object.keys(COPY_FALLBACKS),
    ...Object.keys(overrides || {}),
  ]);
  return [...keys]
    .sort()
    .map((key) => ({
      key,
      value: t(key, overrides),
    }));
}

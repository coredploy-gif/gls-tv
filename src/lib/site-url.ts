/**
 * Canonical public origin for auth emails, payments, and absolute links.
 * Prefer NEXT_PUBLIC_SITE_URL in every deployed environment.
 */
export function siteUrl(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;

  const fromArg = fallbackOrigin?.replace(/\/$/, "").trim();
  if (fromArg) return fromArg;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "").trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }

  // Matches `npm run dev` (127.0.0.1:3010) — not used when SITE_URL is set.
  return "http://127.0.0.1:3010";
}

export function authCallbackUrl(fallbackOrigin?: string): string {
  return `${siteUrl(fallbackOrigin)}/auth/callback`;
}

/**
 * Exception ungrant → grace until 1st of next month → Red Bull TV only.
 */

export const RED_BULL_TV_SLUG = "red-bull-tv";

const RED_BULL_SLUG_RE = /red[-_]?bull/i;

export function isRedBullOnlySlug(slugOrId: string | null | undefined) {
  const raw = (slugOrId || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === RED_BULL_TV_SLUG || raw === `curated-${RED_BULL_TV_SLUG}`) {
    return true;
  }
  return RED_BULL_SLUG_RE.test(raw);
}

export function isRedBullOnlyTitle(title: string | null | undefined) {
  return RED_BULL_SLUG_RE.test(title || "");
}

/** First day of the next calendar month (UTC midnight). */
export function firstOfComingMonth(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

export function formatGraceDeadline(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const EXCEPTION_GRACE_NUDGE_DAYS = 5;

export function exceptionGraceStartCopy(endsAt: Date) {
  const when = formatGraceDeadline(endsAt);
  return {
    title: "Please choose a plan",
    body: `Your complimentary access has ended. Please choose a plan and make payment by the 1st of the coming month (${when}). Your grace period runs until then — after that only Red Bull TV stays available until you pay.`,
  };
}

export function exceptionGraceNudgeCopy(endsAt: Date) {
  const when = formatGraceDeadline(endsAt);
  return {
    title: "Reminder: choose a plan",
    body: `Please choose a plan and make payment by ${when}. Your grace period has ended for complimentary access — pay by the 1st or you’ll only be able to watch Red Bull TV.`,
  };
}

export function exceptionGraceEndedCopy() {
  return {
    title: "Grace period over",
    body: "Your grace period has ended and membership access is cancelled. You can still watch Red Bull TV. Choose a plan anytime to unlock the full catalogue.",
  };
}

/** Paths a Red Bull–only member may open (plus /watch/red-bull-tv*). */
export const RED_BULL_ONLY_ALLOWED_PREFIXES = [
  "/pricing",
  "/account",
  "/billing",
  "/receipts",
  "/notifications",
  "/support",
  "/profiles",
  "/auth",
] as const;

export function pathAllowedForRedBullOnly(path: string) {
  if (
    RED_BULL_ONLY_ALLOWED_PREFIXES.some(
      (p) => path === p || path.startsWith(`${p}/`),
    )
  ) {
    return true;
  }
  if (path === `/watch/${RED_BULL_TV_SLUG}` || path.startsWith(`/watch/${RED_BULL_TV_SLUG}?`)) {
    return true;
  }
  if (path.startsWith("/watch/")) {
    const slug = path.slice("/watch/".length).split(/[/?#]/)[0] || "";
    return isRedBullOnlySlug(slug);
  }
  return false;
}

export function redBullOnlyHomeHref() {
  return `/watch/${RED_BULL_TV_SLUG}?access=restricted`;
}

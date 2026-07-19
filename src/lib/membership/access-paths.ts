/**
 * Shared path gates for auth / viewer / entitlement (proxy + client).
 * Keep these lists in sync with `src/proxy.ts` behavior.
 */

export const PROTECTED_PREFIXES = [
  "/browse",
  "/watch",
  "/kids",
  "/profiles",
  "/playlists",
  "/library",
  "/search",
  "/sports",
  "/news",
  "/movies",
  "/series",
  "/live",
  "/food",
  "/religion",
  "/asia",
  "/africa",
  "/games",
  "/radio",
  "/mylist",
  "/my-list",
  "/account",
  "/billing",
  "/receipts",
  "/notifications",
  "/support",
  "/admin",
  "/eadmin",
] as const;

/** Auth required but no viewer-profile gate (admin / account surfaces). */
export const SKIP_VIEWER_GATE = [
  "/admin",
  "/eadmin",
  "/profiles",
  "/auth",
  "/billing",
  "/receipts",
  "/pricing",
  "/account",
  "/notifications",
  "/support",
] as const;

export const ENTITLEMENT_PREFIXES = [
  "/browse",
  "/watch",
  "/kids",
  "/playlists",
  "/library",
  "/search",
  "/sports",
  "/news",
  "/movies",
  "/series",
  "/live",
  "/food",
  "/religion",
  "/asia",
  "/africa",
  "/games",
  "/radio",
  "/mylist",
  "/my-list",
] as const;

function matchesPrefix(path: string, prefixes: readonly string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function pathNeedsAuth(path: string) {
  return matchesPrefix(path, PROTECTED_PREFIXES);
}

export function pathSkipsViewerGate(path: string) {
  return matchesPrefix(path, SKIP_VIEWER_GATE);
}

export function pathNeedsEntitlement(path: string) {
  return matchesPrefix(path, ENTITLEMENT_PREFIXES);
}

export function pathNeedsViewer(path: string) {
  return pathNeedsAuth(path) && !pathSkipsViewerGate(path);
}

/** Build /profiles?next=… (and optional reason) without nesting next loops. */
export function profilesGateHref(
  nextPath: string,
  opts?: { reason?: string },
) {
  const params = new URLSearchParams();
  if (opts?.reason) params.set("reason", opts.reason);
  const clean = nextPath.split("?")[0] || "";
  if (
    clean &&
    clean !== "/profiles" &&
    !clean.startsWith("/profiles/") &&
    pathNeedsViewer(clean)
  ) {
    params.set("next", nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
  }
  const q = params.toString();
  return q ? `/profiles?${q}` : "/profiles";
}

/** After picking a viewer, prefer a safe next destination. */
export function redirectAfterViewerPick(
  next: string | null | undefined,
  isKids: boolean,
) {
  const fallback = isKids ? "/kids" : "/browse";
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  const pathOnly = next.split("?")[0] || "";
  if (pathOnly === "/profiles" || pathOnly.startsWith("/profiles/")) {
    return fallback;
  }
  if (pathOnly === "/auth" || pathOnly.startsWith("/auth/")) {
    return fallback;
  }
  return next;
}

/** Best-effort TV / leanback / large living-room screen detection. */
export function isTvLikeDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (
    /Android\s*TV|SMART-TV|SmartTV|AFT[A-Z]|AppleTV|BRAVIA|CrKey|GoogleTV|TV Stick|Fire TV|MiBOX|HbbTV|Web0S|Tizen/i.test(
      ua,
    )
  ) {
    return true;
  }
  // Large landscape viewport without fine pointer (common on TV browsers).
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const noHover =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none)").matches;
  const wide =
    Math.min(window.screen?.width || 0, window.innerWidth || 0) >= 960 &&
    Math.min(window.screen?.height || 0, window.innerHeight || 0) >= 540;
  return Boolean(coarse && noHover && wide);
}

export function isLargeScreen(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(min-width: 1280px)").matches ||
    Math.min(window.innerWidth, window.screen?.width || 0) >= 1280
  );
}

/**
 * Client-only TV detection. Server snapshot is always false so phone/desktop
 * never hydrate into a QR-primary auth UI.
 */
export function subscribeTvLikeDevice(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const mqCoarse = window.matchMedia("(pointer: coarse)");
  const mqHover = window.matchMedia("(hover: none)");
  mqCoarse.addEventListener("change", onStoreChange);
  mqHover.addEventListener("change", onStoreChange);
  window.addEventListener("resize", onStoreChange);
  return () => {
    mqCoarse.removeEventListener("change", onStoreChange);
    mqHover.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

export function readTvOverrideFromSearch(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );
    return params.get("tv") === "1";
  } catch {
    return false;
  }
}

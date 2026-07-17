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

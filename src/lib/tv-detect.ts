/** Best-effort TV / leanback / large living-room screen detection. */

const TV_NAV_STORAGE_KEY = "gls-tv-nav";

export function readStoredTvNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(TV_NAV_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist leanback / box-focus navigation for this browser session. */
export function enableTvNavigation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TV_NAV_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
  const root = document.documentElement;
  root.dataset.tv = "1";
  root.setAttribute("data-tv", "1");
  root.classList.add("gls-tv-nav");
}

export function disableTvNavigation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TV_NAV_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  delete root.dataset.tv;
  root.removeAttribute("data-tv");
  root.classList.remove("gls-tv-nav");
}

export function isTvLikeDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (readStoredTvNavigation()) return true;
  if (readTvOverrideFromSearch(window.location.search)) return true;

  const ua = navigator.userAgent || "";
  if (
    /Android\s*TV|SMART-TV|SmartTV|AFT[A-Z]|AppleTV|BRAVIA|CrKey|GoogleTV|TV Stick|Fire TV|MiBOX|HbbTV|Web0S|Tizen|Google.?TV|Chromecast|GLSTV-AndroidTV/i.test(
      ua,
    )
  ) {
    return true;
  }

  // Many Android TV Chrome builds look like a normal Android tablet/phone UA
  // but expose no touch (or only a remote “mouse”) on a large landscape screen.
  const android = /Android/i.test(ua);
  const wide =
    Math.min(window.screen?.width || 0, window.innerWidth || 0) >= 960 &&
    Math.min(window.screen?.height || 0, window.innerHeight || 0) >= 540;
  const landscape = window.innerWidth >= window.innerHeight;
  const noTouch =
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints === 0;

  if (android && wide && landscape && (noTouch || /TV|AFT|BRAVIA|MiBOX/i.test(ua))) {
    return true;
  }

  // Large landscape viewport without fine pointer (common on TV browsers).
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const noHover =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none)").matches;
  if (coarse && noHover && wide) return true;

  // Android + large landscape with no touch → treat as TV (Chrome often
  // reports pointer:fine on sticks).
  if (android && wide && landscape && noTouch && window.innerWidth >= 1100) {
    return true;
  }

  return false;
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
  window.addEventListener("storage", onStoreChange);
  return () => {
    mqCoarse.removeEventListener("change", onStoreChange);
    mqHover.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
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

/** Android KEYCODE_DPAD_* plus standard Arrow keys / Enter / Select. */
export function isDirectionalNavKey(event: KeyboardEvent): boolean {
  const key = event.key;
  if (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight"
  ) {
    return true;
  }
  // Some Android TV builds only expose keyCode / which.
  const code = event.keyCode || (event as KeyboardEvent & { which?: number }).which || 0;
  // 19=UP 20=DOWN 21=LEFT 22=RIGHT
  return code === 19 || code === 20 || code === 21 || code === 22;
}

export function directionalNavKey(
  event: KeyboardEvent,
): "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | null {
  const key = event.key;
  if (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight"
  ) {
    return key;
  }
  const code = event.keyCode || (event as KeyboardEvent & { which?: number }).which || 0;
  if (code === 19) return "ArrowUp";
  if (code === 20) return "ArrowDown";
  if (code === 21) return "ArrowLeft";
  if (code === 22) return "ArrowRight";
  return null;
}

export function isActivateKey(event: KeyboardEvent): boolean {
  const key = event.key;
  if (key === "Enter" || key === " " || key === "Select" || key === "MediaPlayPause") {
    return true;
  }
  const code = event.keyCode || 0;
  // 23 = DPAD_CENTER, 66 = ENTER
  return code === 23 || code === 66;
}

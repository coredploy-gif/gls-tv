"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  directionalNavKey,
  enableTvNavigation,
  isActivateKey,
  isBackNavKey,
  isDirectionalNavKey,
  isTvLikeDevice,
  readTvOverrideFromSearch,
  subscribeTvLikeDevice,
} from "@/lib/tv-detect";

const SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-tv-focus]';
const FOCUS_MEMORY_PREFIX = "gls-tv-focus:";

function isFocusable(el: Element | null): el is HTMLElement {
  return Boolean(el && (el as HTMLElement).matches?.(SELECTOR));
}

function isTvModeActive(): boolean {
  if (typeof window === "undefined") return false;
  if (readTvOverrideFromSearch(window.location.search)) return true;
  return isTvLikeDevice();
}

function syncTvDocumentMode(active: boolean) {
  if (active) enableTvNavigation();
  else {
    // Keep session preference if user already entered TV nav via D-pad.
    if (!isTvModeActive()) {
      document.documentElement.removeAttribute("data-tv");
      document.documentElement.classList.remove("gls-tv-nav");
      delete document.documentElement.dataset.tv;
    }
  }
}

function focusTarget(el: HTMLElement) {
  if (el === document.activeElement) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({
    block: "nearest",
    inline: "center",
    behavior: "auto",
  });
}

function focusIdentity(el: HTMLElement): string | null {
  const explicit = el.dataset.tvFocusKey;
  if (explicit) return `key:${explicit}`;
  if (el instanceof HTMLAnchorElement) {
    const href = el.getAttribute("href");
    if (href) return `href:${href}`;
  }
  const label = el.getAttribute("aria-label") || el.getAttribute("title");
  if (label) return `label:${el.tagName}:${label}`;
  return null;
}

function restoreFocus(pathname: string): boolean {
  let identity: string | null = null;
  try {
    identity = window.sessionStorage.getItem(`${FOCUS_MEMORY_PREFIX}${pathname}`);
  } catch {
    /* private mode */
  }
  if (!identity) return false;
  const target = [...document.querySelectorAll<HTMLElement>(SELECTOR)].find(
    (element) => focusIdentity(element) === identity,
  );
  if (!target) return false;
  focusTarget(target);
  return true;
}

function firstBrowseTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(
      ".gls-tile, [data-tv-focus], .gls-nav-link, .gls-player-center, .gls-cta",
    ) || document.querySelector<HTMLElement>(SELECTOR)
  );
}

function closestFocusable(from: Element | null): HTMLElement | null {
  if (!from) return null;
  const hit = (from as HTMLElement).closest?.(SELECTOR);
  return hit instanceof HTMLElement ? hit : null;
}

/**
 * Spatial D-pad navigation + pointer→focus for Android TV browsers that
 * draw a mouse cursor instead of sending Arrow keys (Netflix-style boxes).
 */
export function RemoteNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    const applyTvMode = () => {
      if (isTvModeActive()) enableTvNavigation();
    };
    applyTvMode();
    const unsubscribe = subscribeTvLikeDevice(applyTvMode);

    const initialFocusTimer = window.setTimeout(() => {
      if (!isTvModeActive()) return;
      if (!restoreFocus(pathname) && !isFocusable(document.activeElement)) {
        const first = firstBrowseTarget();
        if (first) focusTarget(first);
      }
    }, 0);

    let lastPointerFocusAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const dir = directionalNavKey(event);

      // First D-pad press on a desktop-like UA → lock into TV box navigation.
      if (dir || isDirectionalNavKey(event)) {
        enableTvNavigation();
      }

      const inField = (document.activeElement as HTMLElement | null)?.matches?.(
        "input, textarea, select, [contenteditable=true]",
      );
      const isBack = isBackNavKey(event) && !(event.key === "Backspace" && inField);
      if (isBack && isTvModeActive()) {
        const playerBack = new CustomEvent("gls-tv-back", { cancelable: true });
        window.dispatchEvent(playerBack);
        if (playerBack.defaultPrevented) {
          event.preventDefault();
          return;
        }
        const dialog = document.querySelector<HTMLElement>(
          '[role="dialog"][aria-modal="true"], [data-tv-back-root]',
        );
        if (dialog) {
          const closer = dialog.querySelector<HTMLElement>(
            '[data-tv-back-close], [aria-label="Close"], [aria-label="close"]',
          );
          if (closer) {
            event.preventDefault();
            closer.click();
            return;
          }
        }
        if (window.history.length > 1) {
          event.preventDefault();
          window.history.back();
        }
        return;
      }

      // DPAD_CENTER / Enter on focused control
      if (isActivateKey(event) && isTvModeActive()) {
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          isFocusable(active) &&
          !active.matches("input, textarea, select, [contenteditable=true]")
        ) {
          // Links/buttons activate natively on Enter; ensure Space / Select work.
          if (event.key === " " || event.key === "Select" || event.keyCode === 23) {
            event.preventDefault();
            active.click();
          }
        }
        return;
      }

      if (!dir) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.matches("input, textarea, select, [contenteditable=true]")) {
        return;
      }

      if (!isFocusable(active) || active === document.body) {
        const first = firstBrowseTarget();
        if (first) {
          event.preventDefault();
          focusTarget(first);
        }
        return;
      }

      const origin = active.getBoundingClientRect();
      const ox = origin.left + origin.width / 2;
      const oy = origin.top + origin.height / 2;
      const row = active.closest<HTMLElement>(".gls-row-scroll");
      const candidateRoot =
        row && (dir === "ArrowLeft" || dir === "ArrowRight") ? row : document;
      const candidates = [...candidateRoot.querySelectorAll<HTMLElement>(SELECTOR)]
        .filter((element) => {
          if (element === active) return false;
          if (
            element.offsetParent === null &&
            getComputedStyle(element).position !== "fixed"
          ) {
            return false;
          }
          const style = getComputedStyle(element);
          if (style.visibility === "hidden" || style.display === "none") {
            return false;
          }
          const tab = element.getAttribute("tabindex");
          if (tab === "-1") return false;
          if (element.closest('[inert], [aria-hidden="true"]')) return false;
          return true;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) {
            return { element, forward: false, score: Infinity };
          }
          const dx = rect.left + rect.width / 2 - ox;
          const dy = rect.top + rect.height / 2 - oy;
          const forward =
            (dir === "ArrowRight" && dx > 8) ||
            (dir === "ArrowLeft" && dx < -8) ||
            (dir === "ArrowDown" && dy > 8) ||
            (dir === "ArrowUp" && dy < -8);
          const primary =
            dir === "ArrowLeft" || dir === "ArrowRight"
              ? Math.abs(dx)
              : Math.abs(dy);
          const secondary =
            dir === "ArrowLeft" || dir === "ArrowRight"
              ? Math.abs(dy)
              : Math.abs(dx);
          // Prefer same-row tiles in horizontal rows (Netflix carousels).
          const rowBias =
            dir === "ArrowLeft" || dir === "ArrowRight"
              ? secondary * 3.2
              : secondary * 1.6;
          return { element, forward, score: primary + rowBias };
        })
        .filter((candidate) => candidate.forward)
        .sort((a, b) => a.score - b.score);

      if (candidates[0]) {
        event.preventDefault();
        event.stopPropagation();
        focusTarget(candidates[0].element);
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTvModeActive()) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || !isFocusable(target)) return;
      const identity = focusIdentity(target);
      if (!identity) return;
      try {
        window.sessionStorage.setItem(`${FOCUS_MEMORY_PREFIX}${pathname}`, identity);
      } catch {
        /* private mode */
      }
    };

    /**
     * Android TV Chrome often moves a mouse pointer. Treat the tile under
     * the pointer as the focused box so navigation feels Netflix-like even
     * when the OS still draws a cursor.
     */
    const onPointerMove = (event: PointerEvent) => {
      if (!isTvModeActive()) return;
      // Ignore fine trackpad spam on desktop when ?tv=1 is used for testing —
      // still OK; we want box focus.
      const now = performance.now();
      if (now - lastPointerFocusAt < 48) return;
      lastPointerFocusAt = now;

      const under = document.elementFromPoint(event.clientX, event.clientY);
      const target = closestFocusable(under);
      if (!target) return;
      if (target.matches("input, textarea, select, [contenteditable=true]")) {
        return;
      }
      if (target === document.activeElement) return;
      target.focus({ preventScroll: true });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isTvModeActive()) return;
      const target = closestFocusable(event.target as Element | null);
      if (target) target.focus({ preventScroll: true });
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointermove", onPointerMove, {
      passive: true,
      capture: true,
    });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);

    return () => {
      window.clearTimeout(initialFocusTimer);
      unsubscribe();
      syncTvDocumentMode(false);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [pathname]);
  return null;
}

"use client";

import { useEffect } from "react";
import {
  isTvLikeDevice,
  readTvOverrideFromSearch,
  subscribeTvLikeDevice,
} from "@/lib/tv-detect";

const SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isFocusable(el: Element | null): el is HTMLElement {
  return Boolean(el && (el as HTMLElement).matches?.(SELECTOR));
}

function isTvModeActive(): boolean {
  if (typeof window === "undefined") return false;
  if (readTvOverrideFromSearch(window.location.search)) return true;
  return isTvLikeDevice();
}

function syncTvDocumentMode(active: boolean) {
  const root = document.documentElement;
  if (active) {
    root.dataset.tv = "1";
    root.setAttribute("data-tv", "1");
  } else {
    delete root.dataset.tv;
    root.removeAttribute("data-tv");
  }
}

/** Spatial D-pad / arrow-key navigation for TV remotes and keyboards. */
export function RemoteNavigation() {
  useEffect(() => {
    const applyTvMode = () => syncTvDocumentMode(isTvModeActive());
    applyTvMode();
    const unsubscribe = subscribeTvLikeDevice(applyTvMode);

    // Land focus on a browse target so the first D-pad press isn't "lost".
    if (isTvModeActive() && !isFocusable(document.activeElement)) {
      const first =
        document.querySelector<HTMLElement>(
          ".gls-tile, .gls-nav-link, .gls-player-center, .gls-cta",
        ) || document.querySelector<HTMLElement>(SELECTOR);
      first?.focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Android TV / browser Back → leave overlays or go back in history.
      const isBack =
        event.key === "Escape" ||
        event.key === "BrowserBack" ||
        event.key === "GoBack" ||
        (event.key === "Backspace" &&
          !(document.activeElement as HTMLElement | null)?.matches?.(
            "input, textarea, select, [contenteditable=true]",
          ));
      if (isBack && isTvModeActive()) {
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

      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (active?.matches("input, textarea, select, [contenteditable=true]")) {
        return;
      }

      // First arrow press with no focus: land on a primary browse target
      if (!isFocusable(active) || active === document.body) {
        const first =
          document.querySelector<HTMLElement>(
            ".gls-tile, .gls-nav-link, .gls-player-center, .gls-cta",
          ) || document.querySelector<HTMLElement>(SELECTOR);
        if (first) {
          event.preventDefault();
          first.focus({ preventScroll: false });
        }
        return;
      }

      const origin = active.getBoundingClientRect();
      const ox = origin.left + origin.width / 2;
      const oy = origin.top + origin.height / 2;
      const candidates = [...document.querySelectorAll<HTMLElement>(SELECTOR)]
        .filter((element) => {
          if (element === active) return false;
          if (
            element.offsetParent === null &&
            getComputedStyle(element).position !== "fixed"
          ) {
            return false;
          }
          const style = getComputedStyle(element);
          if (style.visibility === "hidden" || style.display === "none") return false;
          const tab = element.getAttribute("tabindex");
          if (tab === "-1") return false;
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
            (event.key === "ArrowRight" && dx > 8) ||
            (event.key === "ArrowLeft" && dx < -8) ||
            (event.key === "ArrowDown" && dy > 8) ||
            (event.key === "ArrowUp" && dy < -8);
          const primary =
            event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? Math.abs(dx)
              : Math.abs(dy);
          const secondary =
            event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? Math.abs(dy)
              : Math.abs(dx);
          return { element, forward, score: primary + secondary * 2.2 };
        })
        .filter((candidate) => candidate.forward)
        .sort((a, b) => a.score - b.score);
      if (candidates[0]) {
        event.preventDefault();
        candidates[0].element.focus({ preventScroll: false });
        candidates[0].element.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      unsubscribe();
      syncTvDocumentMode(false);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";

const SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isFocusable(el: Element | null): el is HTMLElement {
  return Boolean(el && (el as HTMLElement).matches?.(SELECTOR));
}

/** Spatial D-pad / arrow-key navigation for TV remotes and keyboards. */
export function RemoteNavigation() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
          document.querySelector<HTMLElement>(".gls-tile, .gls-nav-link, .gls-player-center, .gls-cta") ||
          document.querySelector<HTMLElement>(SELECTOR);
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
          if (element.offsetParent === null && getComputedStyle(element).position !== "fixed") {
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
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}

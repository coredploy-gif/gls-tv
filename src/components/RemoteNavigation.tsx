"use client";

import { useEffect } from "react";

const SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function RemoteNavigation() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !active.matches(SELECTOR)) return;
      if (active.matches("input, textarea, select")) return;
      const origin = active.getBoundingClientRect();
      const ox = origin.left + origin.width / 2;
      const oy = origin.top + origin.height / 2;
      const candidates = [...document.querySelectorAll<HTMLElement>(SELECTOR)]
        .filter((element) => element !== active && element.offsetParent !== null)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - ox;
          const dy = rect.top + rect.height / 2 - oy;
          const forward =
            (event.key === "ArrowRight" && dx > 4) ||
            (event.key === "ArrowLeft" && dx < -4) ||
            (event.key === "ArrowDown" && dy > 4) ||
            (event.key === "ArrowUp" && dy < -4);
          const primary = event.key === "ArrowLeft" || event.key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
          const secondary = event.key === "ArrowLeft" || event.key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
          return { element, forward, score: primary + secondary * 2.5 };
        })
        .filter((candidate) => candidate.forward)
        .sort((a, b) => a.score - b.score);
      if (candidates[0]) {
        event.preventDefault();
        candidates[0].element.focus({ preventScroll: false });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}

"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  isTvLikeDevice,
  readTvOverrideFromSearch,
  subscribeTvLikeDevice,
} from "@/lib/tv-detect";

/** True on TV-like clients after hydration; always false during SSR. */
export function useIsTvLikeDevice(force = false): boolean {
  const getSnapshot = useCallback(() => {
    if (force) return true;
    if (
      typeof window !== "undefined" &&
      readTvOverrideFromSearch(window.location.search)
    ) {
      return true;
    }
    return isTvLikeDevice();
  }, [force]);

  return useSyncExternalStore(subscribeTvLikeDevice, getSnapshot, () => false);
}

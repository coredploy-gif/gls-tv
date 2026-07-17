"use client";

import { useCallback, useEffect, useState } from "react";
import { t, type CopyKey } from "@/lib/copy";

/** Loads DB overrides once; falls back to code defaults via `t()`. */
export function useAppCopy() {
  const [map, setMap] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/copy", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.copy) setMap(json.copy);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return useCallback(
    (key: CopyKey | string) => t(key, map),
    [map],
  );
}

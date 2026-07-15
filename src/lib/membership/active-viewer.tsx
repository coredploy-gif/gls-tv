"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ACTIVE_VIEWER_COOKIE } from "@/lib/membership/plans";

export type ActiveViewer = {
  id: string;
  name: string;
  avatar_id?: string;
  avatar_url?: string | null;
  is_kids?: boolean;
};

type Ctx = {
  viewer: ActiveViewer | null;
  viewers: ActiveViewer[];
  ready: boolean;
  refresh: () => Promise<void>;
  switchToProfiles: () => void;
};

const ActiveViewerContext = createContext<Ctx | null>(null);

export function ActiveViewerProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<ActiveViewer | null>(null);
  const [viewers, setViewers] = useState<ActiveViewer[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/membership/active-viewer", {
        cache: "no-store",
      });
      const json = await res.json();
      setViewer(json.viewer || null);
      setViewers(json.viewers || []);
    } catch {
      setViewer(null);
      setViewers([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const switchToProfiles = useCallback(() => {
    document.cookie = `${ACTIVE_VIEWER_COOKIE}=; path=/; max-age=0; samesite=lax`;
    window.location.assign("/profiles");
  }, []);

  const value = useMemo(
    () => ({ viewer, viewers, ready, refresh, switchToProfiles }),
    [viewer, viewers, ready, refresh, switchToProfiles],
  );

  return (
    <ActiveViewerContext.Provider value={value}>
      {children}
    </ActiveViewerContext.Provider>
  );
}

export function useActiveViewer() {
  const ctx = useContext(ActiveViewerContext);
  if (!ctx) {
    return {
      viewer: null as ActiveViewer | null,
      viewers: [] as ActiveViewer[],
      ready: true,
      refresh: async () => undefined,
      switchToProfiles: () => {
        if (typeof window !== "undefined") window.location.assign("/profiles");
      },
    };
  }
  return ctx;
}

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
import { useActiveViewer } from "@/lib/membership/active-viewer";
import { ACTIVE_VIEWER_COOKIE } from "@/lib/membership/plans";

export type ContinueEntry = {
  slug: string;
  title: string;
  poster: string;
  backdrop: string;
  progress?: number;
  updatedAt: number;
};

type LibraryState = {
  continueWatching: ContinueEntry[];
  myList: string[];
  favorites: string[];
};

type LibraryContextValue = LibraryState & {
  ready: boolean;
  viewerKey: string;
  addContinue: (entry: Omit<ContinueEntry, "updatedAt">) => void;
  removeContinue: (slug: string) => void;
  toggleMyList: (slug: string) => void;
  toggleFavorite: (slug: string) => void;
  inMyList: (slug: string) => boolean;
  inFavorites: (slug: string) => boolean;
};

const empty: LibraryState = {
  continueWatching: [],
  myList: [],
  favorites: [],
};

function readCookieViewerId() {
  if (typeof document === "undefined") return "anon";
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_VIEWER_COOKIE}=([^;]*)`),
  );
  return m ? decodeURIComponent(m[1]) : "anon";
}

function storageKey(viewerId: string) {
  return `gls-tv-library-v2:${viewerId}`;
}

function loadFor(viewerId: string): LibraryState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(storageKey(viewerId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    return {
      continueWatching: parsed.continueWatching ?? [],
      myList: parsed.myList ?? [],
      favorites: parsed.favorites ?? [],
    };
  } catch {
    return empty;
  }
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { viewer, ready: viewerReady } = useActiveViewer();
  const viewerKey = viewer?.id || (viewerReady ? readCookieViewerId() : "boot");

  const [state, setState] = useState<LibraryState>(empty);
  const [ready, setReady] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Reload library whenever active viewer changes
  useEffect(() => {
    if (!viewerReady && viewerKey === "boot") return;
    const key = viewer?.id || readCookieViewerId();
    queueMicrotask(() => {
      setState(loadFor(key));
      setLoadedKey(key);
      setReady(true);
    });
  }, [viewer?.id, viewerReady, viewerKey]);

  useEffect(() => {
    if (!ready || !loadedKey) return;
    localStorage.setItem(storageKey(loadedKey), JSON.stringify(state));
  }, [state, ready, loadedKey]);

  const addContinue = useCallback((entry: Omit<ContinueEntry, "updatedAt">) => {
    setState((prev) => {
      const next = prev.continueWatching.filter((c) => c.slug !== entry.slug);
      next.unshift({ ...entry, updatedAt: Date.now() });
      return { ...prev, continueWatching: next.slice(0, 40) };
    });
  }, []);

  const removeContinue = useCallback((slug: string) => {
    setState((prev) => ({
      ...prev,
      continueWatching: prev.continueWatching.filter((c) => c.slug !== slug),
    }));
  }, []);

  const toggleMyList = useCallback((slug: string) => {
    setState((prev) => {
      const has = prev.myList.includes(slug);
      return {
        ...prev,
        myList: has
          ? prev.myList.filter((s) => s !== slug)
          : [slug, ...prev.myList],
      };
    });
  }, []);

  const toggleFavorite = useCallback((slug: string) => {
    setState((prev) => {
      const has = prev.favorites.includes(slug);
      return {
        ...prev,
        favorites: has
          ? prev.favorites.filter((s) => s !== slug)
          : [slug, ...prev.favorites],
      };
    });
  }, []);

  const value = useMemo<LibraryContextValue>(
    () => ({
      ...state,
      ready,
      viewerKey: loadedKey || viewerKey,
      addContinue,
      removeContinue,
      toggleMyList,
      toggleFavorite,
      inMyList: (slug) => state.myList.includes(slug),
      inFavorites: (slug) => state.favorites.includes(slug),
    }),
    [
      state,
      ready,
      loadedKey,
      viewerKey,
      addContinue,
      removeContinue,
      toggleMyList,
      toggleFavorite,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

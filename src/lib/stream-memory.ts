/**
 * On-device stream memory: last-good mirror + play mode per channel.
 * Survives reloads; used to skip bad links and start on a known-good source.
 */

export type StreamMemoryEntry = {
  url: string;
  mode: "direct" | "proxy";
  updatedAt: number;
};

const KEY = "gls-tv-stream-memory-v10";
/** Keep last-good path for more channels across devices / PWA sessions. */
const MAX = 400;

type Store = Record<string, StreamMemoryEntry>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    const entries = Object.entries(store).sort(
      (a, b) => b[1].updatedAt - a[1].updatedAt,
    );
    const trimmed = Object.fromEntries(entries.slice(0, MAX));
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
}

export function getStreamMemory(slug: string): StreamMemoryEntry | null {
  const e = read()[slug];
  return e ?? null;
}

export function rememberStream(
  slug: string,
  url: string,
  mode: "direct" | "proxy",
) {
  const store = read();
  store[slug] = { url, mode, updatedAt: Date.now() };
  write(store);
}

export function clearStreamMemory(slug: string) {
  const store = read();
  delete store[slug];
  write(store);
}

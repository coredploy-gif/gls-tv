/** Client-side last channel resume (per viewer profile). */
export type LastChannel = {
  slug: string;
  title: string;
  href: string;
  poster?: string;
  updatedAt: number;
};

const keyFor = (viewerId: string) => `gls-tv-last-channel-v1:${viewerId}`;

export function readLastChannel(viewerId: string): LastChannel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(viewerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastChannel;
    if (!parsed?.slug || !parsed?.href) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastChannel(viewerId: string, entry: Omit<LastChannel, "updatedAt">) {
  if (typeof window === "undefined") return;
  const payload: LastChannel = { ...entry, updatedAt: Date.now() };
  localStorage.setItem(keyFor(viewerId), JSON.stringify(payload));
}

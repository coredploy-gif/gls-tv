import type { MediaSource } from "@/data/types";

/** Prefer mirrors tagged for the viewer's country (Vercel / CF geo headers). */
export function requestCountry(headers: Headers): string | null {
  const raw =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code") ||
    "";
  const code = raw.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") return null;
  return code.slice(0, 2);
}

function regionsFor(source: MediaSource & { geo_regions?: string | null }) {
  const raw = (source as { geo_regions?: string | null }).geo_regions;
  if (!raw?.trim()) return ["WORLD"];
  return raw
    .split(/[,|]/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Rank multi-source mirrors: country match first, then AF/WORLD, then others.
 * Does not drop mirrors — only reorders for failover preference.
 */
export function rankSourcesForCountry(
  sources: MediaSource[],
  country: string | null,
): MediaSource[] {
  if (!country || sources.length < 2) return sources;

  const score = (s: MediaSource) => {
    const regions = regionsFor(s);
    if (regions.includes(country)) return 0;
    if (regions.includes("AF") && ["ZA", "BW", "NA", "LS", "SZ", "MZ", "ZW"].includes(country)) {
      return 1;
    }
    if (regions.includes("WORLD") || regions.includes("*")) return 2;
    return 3;
  };

  return [...sources].sort((a, b) => {
    const d = score(a) - score(b);
    if (d !== 0) return d;
    return (a.priority ?? 99) - (b.priority ?? 99);
  });
}

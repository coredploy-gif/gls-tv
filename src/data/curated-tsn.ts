import type { CatalogItem } from "@/data/types";
import seeds from "@/data/user-stream-seeds.json";

/**
 * TSN 1–5 + Fox Sports 1–2 permanently on Sports.
 * Prefer live URLs from Supabase `stream_seeds` (eadmin / iptv-org sync).
 * Local JSON is tile fallback only — heal must not remap these slugs.
 */

const art =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1600&h=2400&q=92";

type SeedRow = {
  slug: string;
  title: string;
  url?: string;
};

const rows = (seeds.channels || []) as SeedRow[];

function fromSeed(row: SeedRow, index: number): CatalogItem {
  const url = (row.url || "").trim();
  const hasStream = /^https?:\/\//i.test(url);

  const isFox = /fox/i.test(row.slug) || /fox/i.test(row.title);
  return {
    id: `user-seed-${row.slug}`,
    slug: row.slug,
    title: row.title,
    type: "live",
    description: hasStream
      ? "User-seeded stream (local JSON)."
      : "Seeded slot — live URL from /eadmin or iptv-org sync.",
    countries: isFox ? ["us", "world"] : ["ca", "world"],
    categories: [
      "Sports",
      ...(isFox ? (["Fox"] as const) : (["TSN", "Canada"] as const)),
      "Popular",
      "Curated",
      "UserSeed",
      ...(hasStream ? (["Playable", "Verified"] as const) : (["NeedsUrl"] as const)),
    ],
    languages: ["en"],
    poster: art,
    backdrop: art.replace("w=1600&h=2400", "w=3840&h=2160"),
    license: "open_stream",
    isLive: true,
    featured: index === 0,
    sources: hasStream
      ? [
          {
            url,
            quality: "Auto",
            format: "hls",
            priority: 10,
            label: "user-seed",
          },
        ]
      : [],
  };
}

export const CURATED_TSN: CatalogItem[] = rows.map(fromSeed);

/** Slugs owned by the user seed file — catalog overrides must not replace them. */
export const USER_SEED_SLUGS = new Set(rows.map((r) => r.slug));

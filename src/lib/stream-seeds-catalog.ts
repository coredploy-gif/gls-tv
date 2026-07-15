import type { CatalogItem } from "@/data/types";
import { createClient } from "@supabase/supabase-js";

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const FALLBACK_ART =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1600&h=2400&q=92";

export function catalogFromSeed(row: {
  slug: string;
  title: string;
  url: string;
  categories?: string[] | null;
  countries?: string[] | null;
  poster?: string | null;
  backdrop?: string | null;
}): CatalogItem {
  const url = (row.url || "").trim();
  const has = /^https?:\/\//i.test(url);
  return {
    id: `stream-seed-${row.slug}`,
    slug: row.slug,
    title: row.title,
    type: "live",
    description: has
      ? "Eadmin-seeded stream."
      : "Eadmin slot — waiting for a stream URL.",
    countries: row.countries?.length ? row.countries : ["world"],
    categories: [
      ...new Set([
        ...(row.categories || ["Sports", "UserSeed"]),
        "Curated",
        "Popular",
        ...(has ? ["Playable", "Verified"] : ["NeedsUrl"]),
      ]),
    ],
    languages: ["en"],
    poster: row.poster || FALLBACK_ART,
    backdrop:
      row.backdrop ||
      FALLBACK_ART.replace("w=1600&h=2400", "w=3840&h=2160"),
    license: "open_stream",
    isLive: true,
    featured: false,
    sources: has
      ? [{ url, quality: "Auto", format: "hls", priority: 1, label: "eadmin" }]
      : [],
  };
}

export async function getSeedCatalogItem(
  slug: string,
): Promise<CatalogItem | null> {
  try {
    const sb = anon();
    if (!sb) return null;
    const { data } = await sb
      .from("stream_seeds")
      .select(
        "slug, title, url, categories, countries, poster, backdrop, is_active",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    return catalogFromSeed(data);
  } catch {
    return null;
  }
}

export async function listSeedCatalogItems(): Promise<CatalogItem[]> {
  try {
    const sb = anon();
    if (!sb) return [];
    const { data } = await sb
      .from("stream_seeds")
      .select(
        "slug, title, url, categories, countries, poster, backdrop, is_active",
      )
      .eq("is_active", true)
      .order("slug", { ascending: true });
    return (data || []).map(catalogFromSeed);
  } catch {
    return [];
  }
}

import type { CatalogItem } from "@/data/types";

export type UserPlaylistRow = {
  id: string;
  user_id: string;
  name: string;
  source_url: string | null;
  channel_count: number;
  status: string;
  error_message: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserPlaylistChannelRow = {
  id: string;
  playlist_id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string;
  poster: string;
  backdrop: string;
  categories: string[];
  countries: string[];
  tvg_id: string | null;
  stream_url: string;
  quality: string;
  format: string;
  sort_order: number;
};

const FALLBACK_ART =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1200&q=80";

export function channelRowToCatalog(
  row: UserPlaylistChannelRow,
): CatalogItem {
  const format =
    row.format === "mp4" || row.format === "dash" ? row.format : "hls";
  return {
    id: `user-${row.id}`,
    slug: row.slug,
    title: row.title,
    type: "live",
    description: row.description || "Imported from your playlist",
    countries: row.countries?.length ? row.countries : ["world"],
    categories: [
      ...new Set([...(row.categories || []), "My Playlist", "Imported"]),
    ],
    languages: [],
    poster: row.poster || FALLBACK_ART,
    backdrop: row.backdrop || row.poster || FALLBACK_ART,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: row.stream_url,
        quality: row.quality || "Auto",
        format,
      },
    ],
  };
}

export function mineWatchHref(slug: string) {
  return `/watch/mine/${encodeURIComponent(slug)}`;
}

export const PLAYLIST_LIMITS = {
  maxChannels: 2000,
  maxBytes: 8 * 1024 * 1024,
  maxRawStore: 512 * 1024,
} as const;

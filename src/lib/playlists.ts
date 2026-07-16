import type { CatalogItem } from "@/data/types";

export type UserPlaylistRow = {
  id: string;
  user_id: string;
  name: string;
  source_url: string | null;
  source_redacted?: string | null;
  channel_count: number;
  status: string;
  error_message: string | null;
  last_synced_at: string | null;
  last_attempt_at?: string | null;
  last_import_id?: string | null;
  import_stats?: Record<string, number | string>;
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
  stream_url?: string;
  quality: string;
  format: string;
  sort_order: number;
  health_status?: "unknown" | "healthy" | "degraded" | "unavailable";
  fail_count?: number;
  latency_ms?: number | null;
  last_checked_at?: string | null;
  last_ok_at?: string | null;
  quarantined_at?: string | null;
  quarantine_reason?: string | null;
};

const FALLBACK_ART =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1200&q=80";

export function channelRowToCatalog(
  row: UserPlaylistChannelRow,
): CatalogItem {
  const format: "hls" | "mp4" | "dash" =
    row.format === "mp4" || row.format === "dash" ? row.format : "hls";
  const streamUrl = row.stream_url?.trim();
  return {
    id: `user-${row.id}`,
    slug: row.slug,
    title: row.title,
    type: "live",
    description: row.description || "Imported from your playlist",
    countries: row.countries?.length ? row.countries : ["world"],
    categories: [
      ...new Set([
        ...(row.categories || []),
        "My Playlist",
        "Imported",
        ...(row.health_status === "unavailable" ? ["Unavailable"] : []),
      ]),
    ],
    languages: [],
    poster: row.poster || FALLBACK_ART,
    backdrop: row.backdrop || row.poster || FALLBACK_ART,
    license: "open_stream",
    isLive: true,
    sources: [
      // Prefer the original device path, which is fastest for streams whose
      // upstream permits browser access.
      ...(streamUrl
        ? [
            {
              url: streamUrl,
              quality: row.quality || "Auto",
              format,
              label: "browser-direct",
            },
          ]
        : []),
      // Keep the authenticated same-origin relay as the browser/CORS fallback.
      {
        url: `/api/hls?channelId=${encodeURIComponent(row.id)}`,
        quality: row.quality || "Auto",
        format,
        label: "secure-relay",
      },
    ],
  };
}

export function mineWatchHref(channelId: string) {
  return `/watch/mine/${encodeURIComponent(channelId)}`;
}

export const PLAYLIST_LIMITS = {
  maxChannels: 2000,
  maxAccountChannels: 5000,
  maxPlaylists: 10,
  maxBytes: 8 * 1024 * 1024,
  maxRawStore: 512 * 1024,
  refreshCooldownMs: 30_000,
  pageSize: 240,
} as const;

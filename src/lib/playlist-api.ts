import type {
  UserPlaylistChannelRow,
  UserPlaylistRow,
} from "@/lib/playlists";

export type PlaylistApiResponse = {
  error?: string | { code?: string; message?: string; importId?: string };
  playlists?: UserPlaylistRow[];
  channels?: UserPlaylistChannelRow[];
  entitled?: boolean;
  page?: { hasMore?: boolean };
  channelCount?: number;
  stats?: { truncated?: number };
  importId?: string;
  playlist?: { id?: string };
};

export async function readPlaylistResponse(
  res: Response,
): Promise<PlaylistApiResponse> {
  const text = await res.text();
  let data: PlaylistApiResponse = {};
  try {
    data = text ? (JSON.parse(text) as PlaylistApiResponse) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const detail =
      typeof data.error === "object" && data.error
        ? data.error
        : {
            code: `HTTP_${res.status}`,
            message:
              typeof data.error === "string"
                ? data.error
                : "The server returned an unexpected response.",
          };
    throw new Error(
      `${detail.message || "Request failed"}${detail.code ? ` (${detail.code})` : ""}${
        detail.importId ? ` · Import ${detail.importId}` : ""
      }`,
    );
  }
  return data;
}

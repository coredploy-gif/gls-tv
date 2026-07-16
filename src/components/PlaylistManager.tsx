"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { TitleCard } from "@/components/TitleCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  channelRowToCatalog,
  mineWatchHref,
  type UserPlaylistChannelRow,
  type UserPlaylistRow,
} from "@/lib/playlists";

type PlaylistApiResponse = {
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

async function readResponse(res: Response): Promise<PlaylistApiResponse> {
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

export function PlaylistManager() {
  const { user, loading: authLoading } = useAuth();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("My playlist");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<UserPlaylistRow[]>([]);
  const [channels, setChannels] = useState<UserPlaylistChannelRow[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | "all">(
    "all",
  );
  const [listLoading, setListLoading] = useState(false);
  const [entitled, setEntitled] = useState(false);
  const [hasMoreChannels, setHasMoreChannels] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [visibleByGroup, setVisibleByGroup] = useState<Record<string, number>>(
    {},
  );
  const [operationStatus, setOperationStatus] = useState<
    "idle" | "queued" | "fetching" | "parsing" | "applying" | "ready" | "error"
  >("idle");
  const [replacementPlaylistId, setReplacementPlaylistId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setChannels([]);
      return;
    }
    setListLoading(true);
    try {
      const batchSize = 1000;
      const res = await fetch(`/api/playlists?limit=${batchSize}`, {
        cache: "no-store",
      });
      const data = await readResponse(res);
      const allChannels = [...(data.channels || [])];
      let hasMore = data.page?.hasMore === true;
      while (hasMore && allChannels.length < 5000) {
        const nextRes = await fetch(
          `/api/playlists?offset=${allChannels.length}&limit=${batchSize}`,
          { cache: "no-store" },
        );
        const nextData = await readResponse(nextRes);
        const nextChannels = nextData.channels || [];
        allChannels.push(...nextChannels);
        hasMore =
          nextData.page?.hasMore === true && nextChannels.length > 0;
      }
      setPlaylists(data.playlists || []);
      setChannels(allChannels);
      setEntitled(data.entitled === true);
      setHasMoreChannels(hasMore);
    } catch {
      setError("We couldn’t load your playlists right now. Please refresh and try again.");
    } finally {
      setListLoading(false);
    }
  }, [user]);

  const loadMore = async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/playlists?offset=${channels.length}`, {
        cache: "no-store",
      });
      const data = await readResponse(res);
      setChannels((current) => [...current, ...(data.channels || [])]);
      setHasMoreChannels(data.page?.hasMore === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "More channels could not be loaded.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const deferredChannelSearch = useDeferredValue(channelSearch);

  const visibleChannels = useMemo(() => {
    const query = deferredChannelSearch.trim().toLocaleLowerCase();
    return channels.filter((channel) => {
      if (
        activePlaylistId !== "all" &&
        channel.playlist_id !== activePlaylistId
      ) {
        return false;
      }
      if (!query) return true;
      return [
        channel.title,
        channel.tvg_id || "",
        ...(channel.categories || []),
        ...(channel.countries || []),
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [channels, activePlaylistId, deferredChannelSearch]);

  const catalogItems = useMemo(
    () => visibleChannels.map(channelRowToCatalog),
    [visibleChannels],
  );

  const byGroup = useMemo(() => {
    const map = new Map<string, typeof catalogItems>();
    for (const item of catalogItems) {
      const group = item.categories.find((c) => c !== "My Playlist" && c !== "Imported") || "General";
      const list = map.get(group) ?? [];
      list.push(item);
      map.set(group, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [catalogItems]);

  const importPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Sign in first — your playlist is saved to your account.");
      return;
    }
    setBusy(true);
    setOperationStatus("queued");
    setError(null);
    setSuccess(null);
    let parsingTimer: number | undefined;
    let applyingTimer: number | undefined;
    try {
      setOperationStatus("fetching");
      parsingTimer = window.setTimeout(() => setOperationStatus("parsing"), 900);
      applyingTimer = window.setTimeout(() => setOperationStatus("applying"), 1800);
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim(),
          playlistId: replacementPlaylistId,
        }),
      });
      const data = await readResponse(res);
      window.clearTimeout(parsingTimer);
      window.clearTimeout(applyingTimer);
      setOperationStatus("ready");
      setSuccess(
        `Imported ${data.channelCount} channel${data.channelCount === 1 ? "" : "s"}${
          data.stats?.truncated ? ` · ${data.stats.truncated} over the limit` : ""
        } · Import ${data.importId}.`,
      );
      setUrl("");
      setReplacementPlaylistId(null);
      await load();
      if (data.playlist?.id) setActivePlaylistId(data.playlist.id);
    } catch (err) {
      setOperationStatus("error");
      setError(err instanceof Error ? err.message : "Playlist import failed.");
    } finally {
      if (parsingTimer) window.clearTimeout(parsingTimer);
      if (applyingTimer) window.clearTimeout(applyingTimer);
      setBusy(false);
    }
  };

  const refreshPlaylist = async (playlist: UserPlaylistRow) => {
    setBusy(true);
    setOperationStatus("fetching");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playlist.name,
          playlistId: playlist.id,
        }),
      });
      const data = await readResponse(res);
      setOperationStatus("ready");
      setSuccess(`Refreshed · ${data.channelCount} channels · Import ${data.importId}`);
      await load();
    } catch (err) {
      setOperationStatus("error");
      setError(err instanceof Error ? err.message : "Playlist refresh failed.");
    } finally {
      setBusy(false);
    }
  };

  const removePlaylist = async (id: string) => {
    if (!confirm("Remove this playlist and its channels from your account?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/playlists?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await readResponse(res);
      if (activePlaylistId === id) setActivePlaylistId("all");
      await load();
      setSuccess("Playlist removed.");
    } catch {
      setError("We couldn’t remove that playlist right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const renamePlaylist = async (playlist: UserPlaylistRow) => {
    const next = prompt("Playlist name", playlist.name)?.trim();
    if (!next || next === playlist.name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playlists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playlist.id, name: next }),
      });
      await readResponse(res);
      setSuccess("Playlist renamed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rename failed.");
    } finally {
      setBusy(false);
    }
  };

  const replaceSource = async (playlist: UserPlaylistRow) => {
    const replacement = prompt("New M3U source URL");
    if (!replacement?.trim()) return;
    setUrl(replacement.trim());
    setName(playlist.name);
    setReplacementPlaylistId(playlist.id);
    setActivePlaylistId(playlist.id);
    setError(null);
    setSuccess("Source prepared. Submit Import playlist to validate and replace atomically.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-10">
      {/* Hero import panel — always visible */}
      <section className="overflow-hidden rounded-sm border border-white/10 bg-[linear-gradient(135deg,rgba(229,9,20,0.18),rgba(10,10,10,0.9)_45%,rgba(26,26,26,0.95))] shadow-2xl shadow-black/50">
        <div className="border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
            Bring your own
          </p>
          <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl md:text-7xl">
            My Playlists
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gls-body sm:text-lg">
            Paste an M3U channel list or a single HLS (.m3u8) stream. We save it
            under your account and load channels into the GLS layout so you can
            watch instantly.
          </p>
        </div>

        <div className="grid gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <form onSubmit={importPlaylist} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                Playlist name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Home FTA · Sports · etc."
                className="w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3.5 text-lg text-white outline-none placeholder:text-white/35 focus:border-gls-red focus:ring-1 focus:ring-gls-red"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                M3U file link
              </span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                type="url"
                inputMode="url"
                placeholder="https://example.com/playlist.m3u"
                className="w-full rounded-sm border-2 border-white/25 bg-black/55 px-4 py-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-gls-red focus:ring-2 focus:ring-gls-red/40"
              />
            </label>
            <p className="text-xs leading-relaxed text-white/55">
              Use a direct public HTTPS link to an <code className="text-white/80">.m3u</code>{" "}
              channel list or a single <code className="text-white/80">.m3u8</code>{" "}
              stream (for example jmp2 Pluto/Roku links) you have the right to use.
              GLS does not host streams — it plays your URL.
            </p>
            <button
              type="submit"
              disabled={busy || authLoading || !user || !entitled}
              className="gls-cta inline-flex h-14 w-full items-center justify-center rounded text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px] sm:px-10"
            >
              {busy ? `${operationStatus}…` : "Import playlist"}
            </button>
            {!user && !authLoading && (
              <p className="text-sm font-medium text-amber-200">
                Sign in on the right first — then Import stays unlocked.
              </p>
            )}
            {user && !listLoading && !entitled && (
              <p className="text-sm text-amber-200">
                An active trial or membership is required.{" "}
                <Link href="/pricing" className="underline">
                  View plans
                </Link>
              </p>
            )}
            <p aria-live="polite" className="text-xs capitalize text-gls-muted">
              Import status: {operationStatus}
            </p>
            {error && (
              <p className="rounded bg-gls-red/25 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded bg-emerald-800/50 px-3 py-2 text-sm text-emerald-100">
                {success}
              </p>
            )}
          </form>

          <div className="lg:border-l lg:border-white/10 lg:pl-8">
            <Suspense fallback={<p className="text-sm text-gls-muted">Loading…</p>}>
              <AuthPanel />
            </Suspense>
          </div>
        </div>
      </section>

      {user && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="gls-display text-3xl text-white">Saved on your account</h2>
              <p className="mt-1 text-sm text-gls-muted">
                {listLoading
                  ? "Loading…"
                  : `${playlists.length} playlist${playlists.length === 1 ? "" : "s"} · showing ${channels.length} of ${playlists.reduce((sum, playlist) => sum + playlist.channel_count, 0)} channels`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white"
            >
              Refresh list
            </button>
          </div>

          {playlists.length === 0 && !listLoading && (
            <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center">
              <p className="text-lg text-white">No playlists yet</p>
              <p className="mt-2 text-sm text-gls-muted">
                Paste your M3U link above — channels will appear here in the same
                card grid as the rest of GLS TV.
              </p>
            </div>
          )}

          {playlists.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActivePlaylistId("all")}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    activePlaylistId === "all"
                      ? "bg-white text-black"
                      : "bg-white/10 text-gls-body hover:bg-white/15"
                  }`}
                >
                  All channels
                </button>
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePlaylistId(p.id)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                      activePlaylistId === p.id
                        ? "bg-white text-black"
                        : "bg-white/10 text-gls-body hover:bg-white/15"
                    }`}
                  >
                    {p.name} ({p.channel_count})
                  </button>
                ))}
              </div>
              <label className="block max-w-xl">
                <span className="sr-only">Search My Playlist channels</span>
                <input
                  type="search"
                  value={channelSearch}
                  onChange={(event) => setChannelSearch(event.target.value)}
                  placeholder="Search My Playlist channels…"
                  className="gls-admin-input w-full"
                />
              </label>
            </div>
          )}

          <ul className="space-y-3">
            {playlists.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-sm border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs text-gls-muted">
                    {p.source_redacted || "Saved source"}
                  </p>
                  <p className="mt-1 text-xs text-gls-body">
                    {p.channel_count} channels
                    {p.last_synced_at
                      ? ` · last success ${new Date(p.last_synced_at).toLocaleString()}`
                      : ""}
                    {p.last_attempt_at
                      ? ` · last attempt ${new Date(p.last_attempt_at).toLocaleString()}`
                      : ""}
                    {p.error_message ? " · Needs attention" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !entitled}
                    onClick={() => refreshPlaylist(p)}
                    className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white disabled:opacity-40"
                  >
                    Re-sync
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void renamePlaylist(p)}
                    className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy || !entitled}
                    onClick={() => void replaceSource(p)}
                    className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body"
                  >
                    Replace source
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removePlaylist(p.id)}
                    className="rounded border border-gls-red/40 px-3 py-1.5 text-sm text-red-300 transition hover:border-gls-red hover:text-white disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {hasMoreChannels && (
            <button
              type="button"
              disabled={listLoading}
              onClick={() => void loadMore()}
              className="rounded border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {listLoading ? "Loading…" : "Load more channels"}
            </button>
          )}
        </section>
      )}

      {user && catalogItems.length > 0 && (
        <section className="space-y-8">
          <div>
            <h2 className="gls-display text-4xl text-white">Your channels</h2>
            <p className="mt-1 text-sm text-gls-muted">
              Tap any tile to play in the GLS player ·{" "}
              <Link href="/browse" className="text-white underline-offset-2 hover:underline">
                also on Home
              </Link>
            </p>
          </div>

          {byGroup.map(([group, items]) => (
            <div key={group}>
              <h3 className="mb-3 text-lg font-semibold text-white">{group}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.slice(0, visibleByGroup[group] || 24).map((item) => (
                  <div
                    key={item.id}
                    className="relative w-full [&_a]:w-full"
                  >
                    <TitleCard
                      item={item}
                      href={mineWatchHref(item.id.replace(/^user-/, ""))}
                    />
                    {item.categories.includes("Unavailable") && (
                      <span className="pointer-events-none absolute right-2 top-2 rounded bg-amber-500/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow">
                        Unavailable · retrying
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {items.length > (visibleByGroup[group] || 24) && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleByGroup((current) => ({
                      ...current,
                      [group]: Math.min(
                        (current[group] || 24) + 24,
                        items.length,
                      ),
                    }))
                  }
                  className="mt-4 rounded border border-white/20 px-4 py-2 text-sm text-white"
                >
                  Show more · {items.length - (visibleByGroup[group] || 24)} remaining
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

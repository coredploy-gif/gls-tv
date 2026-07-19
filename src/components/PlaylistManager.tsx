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
import { readPlaylistResponse } from "@/lib/playlist-api";
import {
  channelRowToCatalog,
  mineWatchHref,
  type UserPlaylistChannelRow,
  type UserPlaylistRow,
} from "@/lib/playlists";

const GENERIC_CATEGORY_TAGS = new Set([
  "My Playlist",
  "Imported",
  "Unavailable",
]);

function channelCategoryLabel(
  channel: UserPlaylistChannelRow,
  playlistNameById: Map<string, string>,
): string {
  const fromTags = (channel.categories || []).find(
    (tag) => tag.trim() && !GENERIC_CATEGORY_TAGS.has(tag),
  );
  if (fromTags) return fromTags;
  return playlistNameById.get(channel.playlist_id) || "General";
}

export function PlaylistManager() {
  const { user, loading: authLoading } = useAuth();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("My playlist");
  const [channelTitle, setChannelTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [operationStatus, setOperationStatus] = useState<
    "idle" | "queued" | "fetching" | "parsing" | "applying" | "ready" | "error"
  >("idle");
  const [replacementPlaylistId, setReplacementPlaylistId] = useState<
    string | null
  >(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [playlists, setPlaylists] = useState<UserPlaylistRow[]>([]);
  const [channels, setChannels] = useState<UserPlaylistChannelRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [hasMoreChannels, setHasMoreChannels] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<string | "all">(
    "all",
  );
  const [visibleByGroup, setVisibleByGroup] = useState<Record<string, number>>(
    {},
  );

  const loadChannels = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setChannels([]);
      setEntitled(false);
      setHasMoreChannels(false);
      return;
    }
    setListLoading(true);
    setEntitlementLoading(true);
    try {
      const batchSize = 1000;
      const res = await fetch(`/api/playlists?limit=${batchSize}`, {
        cache: "no-store",
      });
      const data = await readPlaylistResponse(res);
      const allChannels = [...(data.channels || [])];
      let hasMore = data.page?.hasMore === true;
      while (hasMore && allChannels.length < 5000) {
        const nextRes = await fetch(
          `/api/playlists?offset=${allChannels.length}&limit=${batchSize}`,
          { cache: "no-store" },
        );
        const nextData = await readPlaylistResponse(nextRes);
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
      setPlaylists([]);
      setChannels([]);
      setHasMoreChannels(false);
    } finally {
      setListLoading(false);
      setEntitlementLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void loadChannels());
  }, [loadChannels]);

  const loadMoreChannels = async () => {
    setListLoading(true);
    try {
      const res = await fetch(`/api/playlists?offset=${channels.length}`, {
        cache: "no-store",
      });
      const data = await readPlaylistResponse(res);
      setChannels((current) => [...current, ...(data.channels || [])]);
      setHasMoreChannels(data.page?.hasMore === true);
    } catch {
      // Keep existing channels; user can retry via refresh after next import.
    } finally {
      setListLoading(false);
    }
  };

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
      applyingTimer = window.setTimeout(
        () => setOperationStatus("applying"),
        1800,
      );
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim(),
          channelTitle: channelTitle.trim() || undefined,
          playlistId: replacementPlaylistId,
        }),
      });
      const data = await readPlaylistResponse(res);
      window.clearTimeout(parsingTimer);
      window.clearTimeout(applyingTimer);
      setOperationStatus("ready");
      setSuccess(
        `Imported ${data.channelCount} channel${data.channelCount === 1 ? "" : "s"}${
          data.stats?.truncated
            ? ` · ${data.stats.truncated} over the limit`
            : ""
        } · Import ${data.importId}.`,
      );
      setUrl("");
      setChannelTitle("");
      setReplacementPlaylistId(null);
      setShowAddForm(false);
      await loadChannels();
    } catch (err) {
      setOperationStatus("error");
      setError(err instanceof Error ? err.message : "Playlist import failed.");
    } finally {
      if (parsingTimer) window.clearTimeout(parsingTimer);
      if (applyingTimer) window.clearTimeout(applyingTimer);
      setBusy(false);
    }
  };

  const openAddForm = () => {
    setShowAddForm(true);
    setError(null);
  };

  const closeAddForm = () => {
    if (busy) return;
    setShowAddForm(false);
    setReplacementPlaylistId(null);
  };

  useEffect(() => {
    if (!showAddForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      setShowAddForm(false);
      setReplacementPlaylistId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddForm, busy]);

  const deferredChannelSearch = useDeferredValue(channelSearch);

  const playlistNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const playlist of playlists) {
      map.set(playlist.id, playlist.name);
    }
    return map;
  }, [playlists]);

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
        playlistNameById.get(channel.playlist_id) || "",
        ...(channel.categories || []),
        ...(channel.countries || []),
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [channels, deferredChannelSearch, playlistNameById, activePlaylistId]);

  useEffect(() => {
    if (
      activePlaylistId !== "all" &&
      !playlists.some((playlist) => playlist.id === activePlaylistId)
    ) {
      setActivePlaylistId("all");
    }
  }, [activePlaylistId, playlists]);

  const byGroup = useMemo(() => {
    const map = new Map<
      string,
      { channel: UserPlaylistChannelRow; item: ReturnType<typeof channelRowToCatalog> }[]
    >();
    for (const channel of visibleChannels) {
      const group = channelCategoryLabel(channel, playlistNameById);
      const list = map.get(group) ?? [];
      list.push({ channel, item: channelRowToCatalog(channel) });
      map.set(group, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visibleChannels, playlistNameById]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="gls-display text-3xl text-white sm:text-4xl">
            My Playlists
          </h1>
          <p className="mt-1 text-sm text-gls-muted">
            Watch imported channels · manage M3U sources in Saved playlists
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/playlists/saved"
            className="rounded border border-white/25 px-3 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
          >
            Saved playlists
          </Link>
          <button
            type="button"
            onClick={openAddForm}
            className="gls-cta inline-flex h-10 items-center justify-center rounded px-5 text-sm font-semibold"
          >
            Add
          </button>
        </div>
      </header>

      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={closeAddForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-playlist-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-sm border border-white/15 bg-[linear-gradient(160deg,rgba(28,10,12,0.98),rgba(10,10,10,0.98)_40%,rgba(18,18,18,0.98))] shadow-2xl shadow-black/60 sm:rounded-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gls-red">
                  Import
                </p>
                <h2
                  id="add-playlist-title"
                  className="gls-display mt-1 text-3xl text-white"
                >
                  {replacementPlaylistId ? "Replace source" : "Add playlist"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeAddForm}
                disabled={busy}
                className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white disabled:opacity-40"
              >
                Close
              </button>
            </div>

            <div className="grid gap-8 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
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
                    M3U / stream link
                  </span>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    type="url"
                    inputMode="url"
                    autoFocus
                    placeholder="https://example.com/playlist.m3u or …/stream.m3u8"
                    className="w-full rounded-sm border-2 border-white/25 bg-black/55 px-4 py-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-gls-red focus:ring-2 focus:ring-gls-red/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                    Channel title{" "}
                    <span className="font-normal normal-case tracking-normal text-white/45">
                      (optional — for single .m3u8 links)
                    </span>
                  </span>
                  <input
                    value={channelTitle}
                    onChange={(e) => setChannelTitle(e.target.value)}
                    placeholder="e.g. BBC Food · Hell’s Kitchen"
                    className="w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-gls-red focus:ring-1 focus:ring-gls-red"
                  />
                </label>
                <p className="text-xs leading-relaxed text-white/55">
                  Use a direct public HTTPS link to an{" "}
                  <code className="text-white/80">.m3u</code> channel list or a
                  single <code className="text-white/80">.m3u8</code> stream (for
                  example jmp2 Pluto/Roku links) you have the right to use. GLS
                  does not host streams — it plays your URL. For YouTube, Vimeo,
                  MP4, or WebM, use{" "}
                  <Link
                    href="/library"
                    className="text-white underline-offset-2 hover:underline"
                  >
                    My Links
                  </Link>{" "}
                  instead.
                </p>
                <button
                  type="submit"
                  disabled={
                    busy || authLoading || !user || !entitled || entitlementLoading
                  }
                  className="gls-cta inline-flex h-14 w-full items-center justify-center rounded text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px] sm:px-10"
                >
                  {busy ? `${operationStatus}…` : "Import playlist"}
                </button>
                {!user && !authLoading && (
                  <p className="text-sm font-medium text-amber-200">
                    Sign in on the right first — then Import stays unlocked.
                  </p>
                )}
                {user && !entitlementLoading && !entitled && (
                  <p className="text-sm text-amber-200">
                    An active trial or membership is required.{" "}
                    <Link href="/pricing" className="underline">
                      View plans
                    </Link>
                  </p>
                )}
                <p
                  aria-live="polite"
                  className="text-xs capitalize text-gls-muted"
                >
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
                {!user && !authLoading ? (
                  <Suspense
                    fallback={<p className="text-sm text-gls-muted">Loading…</p>}
                  >
                    <AuthPanel onDone={() => void loadChannels()} />
                  </Suspense>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {(error || success) && !showAddForm && (
        <div className="space-y-2">
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
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="gls-display text-3xl text-white sm:text-4xl">
            Your channels
          </h2>
          <p className="mt-1 text-sm text-gls-muted">
            {authLoading || listLoading
              ? "Loading…"
              : !user
                ? "Sign in to see imported channels."
                : channels.length === 0
                  ? "No channels yet — use Add to import a playlist."
                  : `${visibleChannels.length} of ${channels.length} channel${channels.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {user && playlists.length > 0 && channels.length > 0 && (
          <div className="space-y-3">
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
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => setActivePlaylistId(playlist.id)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    activePlaylistId === playlist.id
                      ? "bg-white text-black"
                      : "bg-white/10 text-gls-body hover:bg-white/15"
                  }`}
                >
                  {playlist.name} ({playlist.channel_count})
                </button>
              ))}
            </div>
            <label className="block max-w-xl">
              <span className="sr-only">Search your channels</span>
              <input
                type="search"
                value={channelSearch}
                onChange={(event) => setChannelSearch(event.target.value)}
                placeholder="Search channels…"
                className="gls-admin-input w-full"
              />
            </label>
          </div>
        )}

        {!user && !authLoading && (
          <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-lg text-white">Sign in to browse your channels</p>
            <p className="mt-2 text-sm text-gls-muted">
              Imports are saved to your account and show up here after you add
              them.
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="gls-cta mt-6 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
            >
              Sign in &amp; Add
            </button>
          </div>
        )}

        {user && !listLoading && channels.length === 0 && (
          <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-lg text-white">No channels yet</p>
            <p className="mt-2 text-sm text-gls-muted">
              Add an M3U or HLS link — channels will appear here, grouped by
              category.
            </p>
          </div>
        )}

        {byGroup.map(([group, entries]) => (
          <div key={group}>
            <h3 className="mb-3 text-lg font-semibold text-white">
              {group}
              <span className="ml-2 text-sm font-normal text-gls-muted">
                {entries.length}
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {entries
                .slice(0, visibleByGroup[group] || 24)
                .map(({ channel, item }) => (
                  <div key={item.id} className="relative w-full [&_a]:w-full">
                    <TitleCard item={item} href={mineWatchHref(channel.id)} />
                    {item.categories.includes("Unavailable") && (
                      <span className="pointer-events-none absolute right-2 top-2 rounded bg-amber-500/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow">
                        Unavailable · retrying
                      </span>
                    )}
                  </div>
                ))}
            </div>
            {entries.length > (visibleByGroup[group] || 24) && (
              <button
                type="button"
                onClick={() =>
                  setVisibleByGroup((current) => ({
                    ...current,
                    [group]: Math.min(
                      (current[group] || 24) + 24,
                      entries.length,
                    ),
                  }))
                }
                className="mt-4 rounded border border-white/20 px-4 py-2 text-sm text-white"
              >
                Show more · {entries.length - (visibleByGroup[group] || 24)}{" "}
                remaining
              </button>
            )}
          </div>
        ))}

        {hasMoreChannels && (
          <button
            type="button"
            disabled={listLoading}
            onClick={() => void loadMoreChannels()}
            className="rounded border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {listLoading ? "Loading…" : "Load more channels"}
          </button>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { TitleCard } from "@/components/TitleCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  channelRowToCatalog,
  mineWatchHref,
  type UserPlaylistChannelRow,
  type UserPlaylistRow,
} from "@/lib/playlists";

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

  const load = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setChannels([]);
      return;
    }
    setListLoading(true);
    try {
      const res = await fetch("/api/playlists", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load playlists");
      setPlaylists(data.playlists || []);
      setChannels(data.channels || []);
    } catch (e) {
      setError("We couldn’t load your playlists right now. Please refresh and try again.");
    } finally {
      setListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleChannels = useMemo(() => {
    if (activePlaylistId === "all") return channels;
    return channels.filter((c) => c.playlist_id === activePlaylistId);
  }, [channels, activePlaylistId]);

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
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setSuccess(
        `Imported ${data.channelCount} channel${data.channelCount === 1 ? "" : "s"}${
          data.truncated ? ` (capped from ${data.totalFound})` : ""
        }.`,
      );
      setUrl("");
      await load();
      if (data.playlist?.id) setActivePlaylistId(data.playlist.id);
    } catch (err) {
      setError("We couldn’t import that playlist. Please check the link and try again.");
    } finally {
      setBusy(false);
    }
  };

  const refreshPlaylist = async (playlist: UserPlaylistRow) => {
    if (!playlist.source_url) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: playlist.source_url,
          name: playlist.name,
          playlistId: playlist.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setSuccess(`Refreshed · ${data.channelCount} channels`);
      await load();
    } catch (err) {
      setError("We couldn’t refresh that playlist right now. Please try again.");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (activePlaylistId === id) setActivePlaylistId("all");
      await load();
      setSuccess("Playlist removed.");
    } catch (err) {
      setError("We couldn’t remove that playlist right now. Please try again.");
    } finally {
      setBusy(false);
    }
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
            Paste an M3U link. We save it under your account, parse every channel,
            and load them into the GLS layout so you can watch instantly.
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
              or <code className="text-white/80">.m3u8</code> playlist you have
              the right to use. GLS does not host streams — it plays your URL.
            </p>
            <button
              type="submit"
              disabled={busy || authLoading || !user}
              className="gls-cta inline-flex h-14 w-full items-center justify-center rounded text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px] sm:px-10"
            >
              {busy ? "Importing…" : "Import playlist"}
            </button>
            {!user && !authLoading && (
              <p className="text-sm font-medium text-amber-200">
                Sign in on the right first — then Import stays unlocked.
              </p>
            )}
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
                  : `${playlists.length} playlist${playlists.length === 1 ? "" : "s"} · ${channels.length} channel${channels.length === 1 ? "" : "s"}`}
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
                    {p.source_url}
                  </p>
                  <p className="mt-1 text-xs text-gls-body">
                    {p.channel_count} channels
                    {p.last_synced_at
                      ? ` · synced ${new Date(p.last_synced_at).toLocaleString()}`
                      : ""}
                    {p.error_message ? " · Needs attention" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !p.source_url}
                    onClick={() => refreshPlaylist(p)}
                    className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white disabled:opacity-40"
                  >
                    Re-sync
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

          {byGroup.slice(0, 8).map(([group, items]) => (
            <div key={group}>
              <h3 className="mb-3 text-lg font-semibold text-white">{group}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.slice(0, 24).map((item) => (
                  <div key={item.id} className="w-full [&_a]:w-full">
                    <TitleCard item={item} href={mineWatchHref(item.slug)} />
                  </div>
                ))}
              </div>
              {items.length > 24 && (
                <p className="mt-2 text-xs text-gls-muted">
                  Showing 24 of {items.length} in {group}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

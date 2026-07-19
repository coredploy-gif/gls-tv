"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { readPlaylistResponse } from "@/lib/playlist-api";
import type { UserPlaylistRow } from "@/lib/playlists";

export function SavedPlaylistsManager() {
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<UserPlaylistRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [entitled, setEntitled] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setEntitled(false);
      return;
    }
    setListLoading(true);
    try {
      // Playlists metadata only — channel browsing lives on /playlists.
      const res = await fetch("/api/playlists?limit=0", {
        cache: "no-store",
      });
      const data = await readPlaylistResponse(res);
      setPlaylists(data.playlists || []);
      setEntitled(data.entitled === true);
    } catch {
      setError(
        "We couldn’t load your playlists right now. Please refresh and try again.",
      );
    } finally {
      setListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const refreshPlaylist = async (playlist: UserPlaylistRow) => {
    setBusy(true);
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
      const data = await readPlaylistResponse(res);
      setSuccess(
        `Refreshed · ${data.channelCount} channels · Import ${data.importId}`,
      );
      await load();
    } catch (err) {
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
      await readPlaylistResponse(res);
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
      await readPlaylistResponse(res);
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
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: replacement.trim(),
          name: playlist.name,
          playlistId: playlist.id,
        }),
      });
      const data = await readPlaylistResponse(res);
      setSuccess(
        `Source replaced · ${data.channelCount} channels · Import ${data.importId}`,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Source replace failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return <p className="text-sm text-gls-muted">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-sm border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
        <p className="text-lg text-white">Sign in to view saved playlists</p>
        <p className="mt-2 text-sm text-gls-muted">
          Your M3U imports are stored on your account.
        </p>
        <Link
          href="/playlists"
          className="gls-cta mt-6 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
        >
          Back to My Playlists
        </Link>
      </div>
    );
  }

  const totalChannels = playlists.reduce(
    (sum, playlist) => sum + playlist.channel_count,
    0,
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
            Sources
          </p>
          <h1 className="gls-display mt-2 text-4xl text-white sm:text-5xl">
            Saved playlists
          </h1>
          <p className="mt-2 text-sm text-gls-muted">
            {listLoading
              ? "Loading…"
              : `${playlists.length} playlist link${playlists.length === 1 ? "" : "s"} · ${totalChannels} channel${totalChannels === 1 ? "" : "s"} on My Playlists`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/playlists"
            className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white"
          >
            Your channels
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white"
          >
            Refresh list
          </button>
        </div>
      </header>

      {(error || success) && (
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

      {user && !listLoading && !entitled && (
        <p className="text-sm text-amber-200">
          An active trial or membership is required for re-sync and replace.{" "}
          <Link href="/pricing" className="underline">
            View plans
          </Link>
        </p>
      )}

      <section className="space-y-4">
        {playlists.length === 0 && !listLoading && (
          <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-lg text-white">No playlist links yet</p>
            <p className="mt-2 text-sm text-gls-muted">
              Add an M3U from My Playlists — sources to manage show up here.
            </p>
            <Link
              href="/playlists"
              className="gls-cta mt-6 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
            >
              Go to My Playlists
            </Link>
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
                  onClick={() => void refreshPlaylist(p)}
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
                  onClick={() => void removePlaylist(p.id)}
                  className="rounded border border-gls-red/40 px-3 py-1.5 text-sm text-red-300 transition hover:border-gls-red hover:text-white disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { StreamSeedRow } from "@/lib/eadmin";
import Link from "next/link";

type Draft = {
  slug: string;
  title: string;
  url: string;
  is_active: boolean;
};

function rowToDraft(r: StreamSeedRow): Draft {
  return {
    slug: r.slug,
    title: r.title,
    url: r.url || "",
    is_active: r.is_active !== false,
  };
}

export function EadminSeedsPanel() {
  const { user, loading } = useAuth();
  const [seeds, setSeeds] = useState<Draft[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [keepExisting, setKeepExisting] = useState(true);
  const [useFullIndex, setUseFullIndex] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/eadmin/seeds");
    const json = await res.json();
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    if (!res.ok) {
      setError(json.error || "Failed to load seeds");
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setSeeds((json.seeds as StreamSeedRow[]).map(rowToDraft));
  }, []);

  useEffect(() => {
    if (!loading && user) void load();
    if (!loading && !user) setAllowed(null);
  }, [loading, user, load]);

  const saveAll = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/eadmin/seeds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seeds),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setSeeds((json.seeds as StreamSeedRow[]).map(rowToDraft));
    setInfo("Saved. Streams apply on next watch (no deploy).");
  };

  const addRow = async () => {
    if (!newSlug.trim() || !newTitle.trim()) {
      setError("Slug and title required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/eadmin/seeds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newSlug,
        title: newTitle,
        url: newUrl,
        is_active: true,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Add failed");
      return;
    }
    setNewSlug("");
    setNewTitle("");
    setNewUrl("");
    await load();
    setInfo("Channel seeded.");
  };

  const remove = async (slug: string) => {
    if (!confirm(`Delete seed ${slug}?`)) return;
    setBusy(true);
    const res = await fetch(
      `/api/eadmin/seeds?slug=${encodeURIComponent(slug)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "Delete failed");
      return;
    }
    await load();
  };

  const syncIptvOrg = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/eadmin/sync-iptv-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: useFullIndex ? "index" : "smart",
        replaceExisting: !keepExisting,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "iptv-org sync failed");
      return;
    }
    const written = (json.written as string[])?.length ?? 0;
    const missing = (json.missing as string[]) ?? [];
    setInfo(
      `Synced ${written} from iptv-org` +
        (missing.length ? ` · not in playlist: ${missing.join(", ")}` : "") +
        " · empty slots only stay empty if the channel wasn’t found.",
    );
    await load();
  };

  if (loading) {
    return <p className="text-sm text-gls-muted">Checking account…</p>;
  }

  if (!user) {
    return (
      <p className="text-sm text-gls-body">
        <Link href="/auth?next=/eadmin" className="text-white underline">
          Sign in
        </Link>{" "}
        with an admin email to seed streams.
      </p>
    );
  }

  if (allowed === false) {
    return (
      <p className="text-sm text-amber-200">
        Signed in as {user.email}, but this account is not in{" "}
        <code className="text-white/80">EADMIN_EMAILS</code> on the server.
      </p>
    );
  }

  if (allowed !== true) {
    return <p className="text-sm text-gls-muted">Loading seeds…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-gls-body">
          You own reliability. Paste HLS URLs below — or pull only your
          allowlisted targets from the public iptv-org index (never the full
          13k into the phone). Matching Sports tiles pick them up on watch.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveAll()}
          className="gls-cta rounded px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save all"}
        </button>
      </div>

      <div className="rounded-sm border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gls-muted">
          Sync from iptv-org
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-gls-body">
          Downloads the public playlist on the server, keeps only TSN 1–5,
          SABC, Fox Sports 1–2, ZBC TV when those names exist, and writes URLs
          into <code className="text-white/80">stream_seeds</code>. Channels
          not found are left alone.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gls-body">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={keepExisting}
              onChange={(e) => setKeepExisting(e.target.checked)}
            />
            Keep my URLs (only fill empty)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={useFullIndex}
              onChange={(e) => setUseFullIndex(e.target.checked)}
            />
            Use full index.m3u (~13k, slower)
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void syncIptvOrg()}
            className="rounded border border-white/25 px-4 py-2 text-sm font-medium text-white hover:border-white disabled:opacity-60"
          >
            {busy ? "Syncing…" : "Pull allowlisted channels"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded bg-gls-red/20 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">
          {info}
        </p>
      )}

      <div className="overflow-x-auto rounded-sm border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-gls-muted">
            <tr>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Stream URL</th>
              <th className="px-3 py-2">On</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {seeds.map((row, i) => (
              <tr key={row.slug} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono text-xs text-gls-muted">
                  {row.slug}
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.title}
                    onChange={(e) => {
                      const next = [...seeds];
                      next[i] = { ...row, title: e.target.value };
                      setSeeds(next);
                    }}
                    className="w-full min-w-[8rem] rounded border border-white/15 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-gls-red"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.url}
                    onChange={(e) => {
                      const next = [...seeds];
                      next[i] = { ...row, url: e.target.value };
                      setSeeds(next);
                    }}
                    placeholder="https://….m3u8"
                    className="w-full min-w-[18rem] rounded border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-gls-red"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    onChange={(e) => {
                      const next = [...seeds];
                      next[i] = { ...row, is_active: e.target.checked };
                      setSeeds(next);
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void remove(row.slug)}
                    className="text-xs text-gls-muted underline hover:text-white"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-sm border border-white/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gls-muted">
          Add channel seed
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="slug (e.g. my-sports-1)"
            className="rounded border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-gls-red"
          />
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="rounded border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-gls-red"
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://….m3u8"
            className="rounded border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white outline-none focus:border-gls-red"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void addRow()}
          className="mt-3 rounded border border-white/20 px-4 py-2 text-sm text-white hover:border-white disabled:opacity-60"
        >
          Add seed
        </button>
      </div>
    </div>
  );
}

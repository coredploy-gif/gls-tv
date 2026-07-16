"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  MEDIA_FORMAT_META,
  type MediaLinkFormat,
  type UserMediaLink,
  validateMediaLinkUrl,
} from "@/lib/media-links";

type ApiResponse = {
  links?: UserMediaLink[];
  entitled?: boolean;
  error?: string;
  link?: UserMediaLink;
};

const CATEGORIES = [
  "Uncategorized",
  "Live TV",
  "Movies",
  "Music",
  "Sports",
  "Kids",
  "Other",
] as const;

export function MediaLibrary() {
  const { user, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<UserMediaLink[]>([]);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Live TV");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<MediaLinkFormat | "">("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof validateMediaLinkUrl> | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!user) {
      setLinks([]);
      setEntitled(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media-links", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || "Could not load library");
      setLinks(data.links || []);
      setEntitled(data.entitled === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (url.trim().length < 8) {
      setPreview(null);
      return;
    }
    setPreview(validateMediaLinkUrl(url, title));
  }, [url, title]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((link) => {
      if (favoritesOnly && !link.is_favorite) return false;
      if (formatFilter && link.format !== formatFilter) return false;
      if (!q) return true;
      return (
        link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.category.toLowerCase().includes(q)
      );
    });
  }, [links, search, formatFilter, favoritesOnly]);

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/media-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          category,
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || "Could not save link");
      setSuccess(`Saved “${data.link?.title}”.`);
      setUrl("");
      setTitle("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const renameLink = async (link: UserMediaLink) => {
    const next = prompt("Link title", link.title)?.trim();
    if (!next || next === link.title) return;
    setBusy(true);
    try {
      const res = await fetch("/api/media-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.id, title: next }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || "Rename failed");
      setLinks((prev) =>
        prev.map((row) => (row.id === link.id ? { ...row, title: next } : row)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async (link: UserMediaLink) => {
    const res = await fetch("/api/media-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, is_favorite: !link.is_favorite }),
    });
    if (!res.ok) return;
    setLinks((prev) =>
      prev.map((row) =>
        row.id === link.id ? { ...row, is_favorite: !link.is_favorite } : row,
      ),
    );
  };

  const removeLink = async (link: UserMediaLink) => {
    if (!confirm(`Remove “${link.title}”?`)) return;
    const res = await fetch(`/api/media-links?id=${encodeURIComponent(link.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Could not delete link");
      return;
    }
    setLinks((prev) => prev.filter((row) => row.id !== link.id));
  };

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(229,9,20,0.16),rgba(8,8,8,0.95)_42%,rgba(20,20,20,0.98))] shadow-2xl shadow-black/40">
        <div className="border-b border-white/10 px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
            Personal collection
          </p>
          <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">
            My Links
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gls-body">
            Save playable streams and videos — HLS (.m3u8), YouTube, Vimeo, MP4,
            and WebM. Give each link a clear name so you’re not stuck with hash
            IDs.
          </p>
        </div>

        <div className="grid gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
          <form onSubmit={addLink} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                Media URL
              </span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                type="url"
                placeholder="https://jmp2.uk/rok-….m3u8 or YouTube / MP4"
                className="w-full rounded-xl border-2 border-white/20 bg-black/50 px-4 py-3.5 text-base text-white outline-none placeholder:text-white/35 focus:border-gls-red"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                  Display name
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="BBC Food · My clip"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-gls-red"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                  Category
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-gls-red"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {preview && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  preview.ok
                    ? "border-gls-mint/30 bg-gls-mint/10 text-gls-mint"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-100"
                }`}
              >
                {preview.ok ? (
                  <>
                    Detected{" "}
                    <strong>{MEDIA_FORMAT_META[preview.format!].label}</strong>
                    {preview.title ? ` · ${preview.title}` : ""}
                  </>
                ) : (
                  preview.error
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || authLoading || !user || !entitled || !preview?.ok}
              className="gls-cta inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold disabled:opacity-45 sm:w-auto sm:min-w-[200px] sm:px-8"
            >
              {busy ? "Saving…" : "Add to library"}
            </button>
            {user && !loading && !entitled && (
              <p className="text-sm text-amber-200">
                Membership required.{" "}
                <Link href="/pricing" className="underline">
                  View plans
                </Link>
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-gls-red/20 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-gls-mint/15 px-3 py-2 text-sm text-gls-mint">
                {success}
              </p>
            )}
          </form>

          <div className="space-y-4">
            {!user && !authLoading ? <AuthPanel /> : null}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Guaranteed playable
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gls-body">
                {(Object.keys(MEDIA_FORMAT_META) as MediaLinkFormat[]).map(
                  (key) => (
                    <li key={key} className="flex gap-2">
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: MEDIA_FORMAT_META[key].accent }}
                      />
                      <span>
                        <span className="font-medium text-white">
                          {MEDIA_FORMAT_META[key].label}
                        </span>
                        <span className="text-gls-muted">
                          {" "}
                          — {MEDIA_FORMAT_META[key].hint}
                        </span>
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <p className="mt-4 text-xs text-gls-muted">
                Full IPTV lists still go to{" "}
                <Link href="/playlists" className="text-white underline-offset-2 hover:underline">
                  My Playlists
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {user && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your links…"
              className="gls-admin-input flex-1 rounded-xl"
            />
            <select
              value={formatFilter}
              onChange={(e) =>
                setFormatFilter((e.target.value || "") as MediaLinkFormat | "")
              }
              className="gls-admin-input w-full rounded-xl sm:w-44"
            >
              <option value="">All formats</option>
              {(Object.keys(MEDIA_FORMAT_META) as MediaLinkFormat[]).map((k) => (
                <option key={k} value={k}>
                  {MEDIA_FORMAT_META[k].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                favoritesOnly
                  ? "border-gls-red/50 bg-gls-red/20 text-gls-red"
                  : "border-white/15 text-gls-muted"
              }`}
            >
              Favorites
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gls-muted">Loading library…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
              <p className="text-lg font-semibold text-white">No links yet</p>
              <p className="mt-2 text-sm text-gls-muted">
                Paste a jmp2 .m3u8, YouTube URL, or MP4 above to start.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((link) => {
                const meta = MEDIA_FORMAT_META[link.format];
                return (
                  <article
                    key={link.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <div
                      className="relative flex h-36 items-center justify-center overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${meta.accent}22, transparent 55%), #0a0a0a`,
                      }}
                    >
                      {link.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.thumbnail_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: meta.accent }}>
                          {meta.label}
                        </span>
                      )}
                      <Link
                        href={`/library/watch/${link.id}`}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100"
                      >
                        <span className="rounded-full bg-gls-red px-4 py-2 text-sm font-semibold text-white shadow-lg">
                          Play
                        </span>
                      </Link>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold text-white">
                          {link.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(link)}
                          className="shrink-0 text-gls-muted hover:text-gls-red"
                          aria-label="Favorite"
                        >
                          {link.is_favorite ? "♥" : "♡"}
                        </button>
                      </div>
                      <p className="truncate text-xs text-gls-muted">
                        {(() => {
                          try {
                            return new URL(link.url).hostname;
                          } catch {
                            return link.url;
                          }
                        })()}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            borderColor: `${meta.accent}66`,
                            color: meta.accent,
                          }}
                        >
                          {meta.label}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gls-muted">
                          {link.category}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Link
                          href={`/library/watch/${link.id}`}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/40"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void renameLink(link)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gls-muted hover:text-white"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeLink(link)}
                          className="rounded-lg border border-gls-red/30 px-3 py-1.5 text-xs text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

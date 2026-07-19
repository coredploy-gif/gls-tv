"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaLinkCard } from "@/components/MediaLinkCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  MEDIA_FORMAT_META,
  MEDIA_LINK_CATEGORIES,
  normalizeMediaLinkCategory,
  type MediaLinkFormat,
  type UserMediaLink,
} from "@/lib/media-links";

type ApiResponse = {
  links?: UserMediaLink[];
  entitled?: boolean;
  error?: string;
};

export function SavedLinksManager() {
  const { user, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<UserMediaLink[]>([]);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<MediaLinkFormat | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

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

  const favorites = useMemo(
    () => links.filter((l) => l.is_favorite).slice(0, 12),
    [links],
  );

  const recentlyWatched = useMemo(
    () =>
      [...links]
        .filter((l) => l.last_watched_at)
        .sort(
          (a, b) =>
            new Date(b.last_watched_at!).getTime() -
            new Date(a.last_watched_at!).getTime(),
        )
        .slice(0, 12),
    [links],
  );

  const categoryOptions = useMemo(() => {
    const extras = links
      .map((l) => l.category)
      .filter(
        (c) =>
          !MEDIA_LINK_CATEGORIES.includes(
            c as (typeof MEDIA_LINK_CATEGORIES)[number],
          ),
      );
    return Array.from(new Set([...MEDIA_LINK_CATEGORIES, ...extras]));
  }, [links]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      const key = link.category || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [links]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((link) => {
      if (favoritesOnly && !link.is_favorite) return false;
      if (formatFilter && link.format !== formatFilter) return false;
      if (categoryFilter && link.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.category.toLowerCase().includes(q)
      );
    });
  }, [links, search, formatFilter, categoryFilter, favoritesOnly]);

  const groupedLibrary = useMemo(() => {
    const order = [
      ...MEDIA_LINK_CATEGORIES,
      ...categoryOptions.filter(
        (c) =>
          !MEDIA_LINK_CATEGORIES.includes(
            c as (typeof MEDIA_LINK_CATEGORIES)[number],
          ),
      ),
    ];
    const map = new Map<string, UserMediaLink[]>();
    for (const link of filtered) {
      const key = link.category || "Uncategorized";
      const list = map.get(key) || [];
      list.push(link);
      map.set(key, list);
    }
    return order
      .filter((name) => (map.get(name) || []).length > 0)
      .map((name) => ({ name, items: map.get(name)! }));
  }, [filtered, categoryOptions]);

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

  const moveCategory = async (link: UserMediaLink, nextCategory: string) => {
    const next = normalizeMediaLinkCategory(nextCategory);
    if (next === link.category) return;
    setBusy(true);
    try {
      const res = await fetch("/api/media-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.id, category: next }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || "Could not move link");
      setLinks((prev) =>
        prev.map((row) =>
          row.id === link.id ? { ...row, category: next } : row,
        ),
      );
      setSuccess(`Moved “${link.title}” to ${next}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Move failed");
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

  const reportLink = async (link: {
    id: string;
    title: string;
    url: string;
  }) => {
    const reason =
      prompt(
        "Report reason (copyright, illegal, broken, malware, other)",
        "broken",
      )?.trim() || "other";
    const details = prompt("Optional details")?.trim() || undefined;
    const res = await fetch("/api/media-links/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_kind: "user_media_link",
        target_id: link.id,
        target_url: link.url,
        target_title: link.title,
        reason,
        details,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not submit report");
      return;
    }
    setSuccess("Report submitted. Thanks — our team will review it.");
  };

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-sm border border-white/10 bg-[linear-gradient(135deg,rgba(229,9,20,0.18),rgba(10,10,10,0.9)_45%,rgba(26,26,26,0.95))] shadow-2xl shadow-black/50">
        <div className="px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
            Your library
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="gls-display text-5xl text-white sm:text-6xl md:text-7xl">
              Saved links
            </h1>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/library"
                className="shrink-0 rounded border border-white/25 px-4 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
              >
                Staff picks
              </Link>
              <Link
                href="/library?add=1"
                className="shrink-0 rounded border border-gls-red/50 bg-gls-red/20 px-4 py-2 text-sm font-medium text-white transition hover:border-gls-red hover:bg-gls-red/30"
              >
                Add link
              </Link>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-base text-gls-body sm:text-lg">
            Favorites, recently watched, and folders — only you can see these.
            Organize into Movies, Kung Fu, Sports, News, and more.
          </p>
          {user && !loading && !entitled && (
            <p className="mt-4 text-sm text-amber-200">
              Membership required to manage saved links.{" "}
              <Link href="/pricing" className="underline">
                View plans
              </Link>
            </p>
          )}
        </div>
      </section>

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

      {!user && !authLoading && (
        <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">
            Sign in to view saved links
          </p>
          <p className="mt-2 text-sm text-gls-muted">
            Personal links are saved to your account.
          </p>
          <Link
            href="/library"
            className="gls-cta mt-6 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
          >
            Back to My Links
          </Link>
        </div>
      )}

      {user && favorites.length > 0 && !favoritesOnly && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Favorites</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((link) => (
              <MediaLinkCard
                key={link.id}
                title={link.title}
                url={link.url}
                format={link.format}
                category={link.category}
                categoryOptions={categoryOptions}
                thumbnailUrl={link.thumbnail_url}
                href={`/library/watch/${link.id}`}
                favorite={link.is_favorite}
                onFavorite={() => void toggleFavorite(link)}
                onRename={() => void renameLink(link)}
                onMoveCategory={(next) => void moveCategory(link, next)}
                onRemove={() => void removeLink(link)}
                onReport={() => void reportLink(link)}
                busy={busy}
              />
            ))}
          </div>
        </section>
      )}

      {user && recentlyWatched.length > 0 && !favoritesOnly && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Recently watched</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentlyWatched.map((link) => (
              <MediaLinkCard
                key={link.id}
                title={link.title}
                url={link.url}
                format={link.format}
                category={link.category}
                thumbnailUrl={link.thumbnail_url}
                href={`/library/watch/${link.id}`}
                favorite={link.is_favorite}
                onFavorite={() => void toggleFavorite(link)}
                busy={busy}
                badge="Recent"
              />
            ))}
          </div>
        </section>
      )}

      {user && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">All saved links</h2>
            <p className="text-sm text-gls-muted">
              {loading
                ? "Loading…"
                : `${links.length} link${links.length === 1 ? "" : "s"} in your library`}
            </p>
          </div>

          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Folders"
          >
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === ""}
              onClick={() => setCategoryFilter("")}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                categoryFilter === ""
                  ? "border-gls-red/50 bg-gls-red/20 text-gls-red"
                  : "border-white/15 text-gls-muted hover:text-white"
              }`}
            >
              All ({links.length})
            </button>
            {categoryOptions
              .filter(
                (name) =>
                  (categoryCounts.get(name) || 0) > 0 ||
                  name === categoryFilter,
              )
              .map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={categoryFilter === name}
                  onClick={() => setCategoryFilter(name)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    categoryFilter === name
                      ? "border-gls-red/50 bg-gls-red/20 text-gls-red"
                      : "border-white/15 text-gls-muted hover:text-white"
                  }`}
                >
                  {name} ({categoryCounts.get(name) || 0})
                </button>
              ))}
          </div>

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
              {(Object.keys(MEDIA_FORMAT_META) as MediaLinkFormat[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {MEDIA_FORMAT_META[k].label}
                  </option>
                ),
              )}
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
              <p className="text-lg font-semibold text-white">No links here</p>
              <p className="mt-2 text-sm text-gls-muted">
                {categoryFilter
                  ? `Nothing in ${categoryFilter} yet — add a link and pick that folder.`
                  : "Paste a public .m3u8, YouTube URL, or MP4 from My Links → Add."}
              </p>
              <Link
                href="/library?add=1"
                className="gls-cta mt-6 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
              >
                Add link
              </Link>
            </div>
          ) : categoryFilter ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((link) => (
                <MediaLinkCard
                  key={link.id}
                  title={link.title}
                  url={link.url}
                  format={link.format}
                  category={link.category}
                  categoryOptions={categoryOptions}
                  thumbnailUrl={link.thumbnail_url}
                  href={`/library/watch/${link.id}`}
                  favorite={link.is_favorite}
                  onFavorite={() => void toggleFavorite(link)}
                  onRename={() => void renameLink(link)}
                  onMoveCategory={(next) => void moveCategory(link, next)}
                  onRemove={() => void removeLink(link)}
                  onReport={() => void reportLink(link)}
                  busy={busy}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedLibrary.map((group) => (
                <div key={group.name} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {group.name}
                      <span className="ml-2 text-sm font-normal text-gls-muted">
                        {group.items.length}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(group.name)}
                      className="text-xs text-gls-muted hover:text-white"
                    >
                      View folder
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((link) => (
                      <MediaLinkCard
                        key={link.id}
                        title={link.title}
                        url={link.url}
                        format={link.format}
                        category={link.category}
                        categoryOptions={categoryOptions}
                        thumbnailUrl={link.thumbnail_url}
                        href={`/library/watch/${link.id}`}
                        favorite={link.is_favorite}
                        onFavorite={() => void toggleFavorite(link)}
                        onRename={() => void renameLink(link)}
                        onMoveCategory={(next) => void moveCategory(link, next)}
                        onRemove={() => void removeLink(link)}
                        onReport={() => void reportLink(link)}
                        busy={busy}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

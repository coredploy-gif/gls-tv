"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  MEDIA_FORMAT_META,
  MEDIA_LINK_CATEGORIES,
  normalizeMediaLinkCategory,
  type AdminMediaLink,
  type MediaLinkFormat,
  type UserMediaLink,
  validateMediaLinkUrl,
} from "@/lib/media-links";
import { PUBLIC_KUNG_FU_PICKS } from "@/lib/public-kung-fu-picks";
import { useAppCopy } from "@/lib/useAppCopy";

type ApiResponse = {
  links?: UserMediaLink[];
  entitled?: boolean;
  error?: string;
  link?: UserMediaLink;
  probe?: { detail?: string };
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function LinkCard({
  title,
  url,
  format,
  category,
  categoryOptions,
  thumbnailUrl,
  href,
  favorite,
  onFavorite,
  onRename,
  onMoveCategory,
  onRemove,
  onReport,
  busy,
  badge,
}: {
  title: string;
  url: string;
  format: MediaLinkFormat;
  category: string;
  categoryOptions?: string[];
  thumbnailUrl?: string | null;
  href: string;
  favorite?: boolean;
  onFavorite?: () => void;
  onRename?: () => void;
  onMoveCategory?: (next: string) => void;
  onRemove?: () => void;
  onReport?: () => void;
  busy?: boolean;
  badge?: string;
}) {
  const meta = MEDIA_FORMAT_META[format];
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div
        className="relative flex h-36 items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${meta.accent}22, transparent 55%), #0a0a0a`,
        }}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-sm font-semibold" style={{ color: meta.accent }}>
            {meta.label}
          </span>
        )}
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
            {badge}
          </span>
        ) : null}
        <Link
          href={href}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100"
        >
          <span className="rounded-full bg-gls-red px-4 py-2 text-sm font-semibold text-white shadow-lg">
            Play
          </span>
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-white">{title}</h3>
          {onFavorite ? (
            <button
              type="button"
              onClick={onFavorite}
              className="shrink-0 text-gls-muted hover:text-gls-red"
              aria-label="Favorite"
            >
              {favorite ? "♥" : "♡"}
            </button>
          ) : null}
        </div>
        <p className="truncate text-xs text-gls-muted">{hostOf(url)}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ borderColor: `${meta.accent}66`, color: meta.accent }}
          >
            {meta.label}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gls-muted">
            {category}
          </span>
        </div>
        {onMoveCategory && categoryOptions ? (
          <label className="block pt-1">
            <span className="sr-only">Move to folder</span>
            <select
              value={category}
              disabled={busy}
              onChange={(e) => onMoveCategory(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-gls-red"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex gap-2 pt-1">
          <Link
            href={href}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/40"
          >
            Open
          </Link>
          {onRename ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRename}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gls-muted hover:text-white"
            >
              Rename
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-gls-red/30 px-3 py-1.5 text-xs text-red-300"
            >
              Remove
            </button>
          ) : null}
          {onReport ? (
            <button
              type="button"
              onClick={onReport}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gls-muted hover:text-white"
            >
              Report
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function MediaLibrary() {
  const { user, loading: authLoading } = useAuth();
  const copy = useAppCopy();
  const [links, setLinks] = useState<UserMediaLink[]>([]);
  const [featured, setFeatured] = useState<AdminMediaLink[]>([]);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Movies");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<MediaLinkFormat | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof validateMediaLinkUrl> | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!user) {
      setLinks([]);
      setFeatured([]);
      setEntitled(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [mine, staff] = await Promise.all([
        fetch("/api/media-links", { cache: "no-store" }),
        fetch("/api/media-links/featured", { cache: "no-store" }),
      ]);
      const mineData = (await mine.json()) as ApiResponse;
      const staffData = (await staff.json()) as { links?: AdminMediaLink[]; error?: string };
      if (!mine.ok) throw new Error(mineData.error || "Could not load library");
      setLinks(mineData.links || []);
      setEntitled(mineData.entitled === true);
      if (staff.ok) setFeatured(staffData.links || []);
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
      .filter((c) => !MEDIA_LINK_CATEGORIES.includes(c as (typeof MEDIA_LINK_CATEGORIES)[number]));
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
      ...categoryOptions.filter((c) => !MEDIA_LINK_CATEGORIES.includes(c as (typeof MEDIA_LINK_CATEGORIES)[number])),
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
          category: normalizeMediaLinkCategory(category),
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || "Could not save link");
      setSuccess(
        `Saved “${data.link?.title}” in ${data.link?.category || category}${
          data.probe?.detail ? ` · ${data.probe.detail}` : ""
        }.`,
      );
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

  const reportLink = async (
    link: { id: string; title: string; url: string },
    kind: "user_media_link" | "admin_media_link",
  ) => {
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
        target_kind: kind,
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
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(229,9,20,0.16),rgba(8,8,8,0.95)_42%,rgba(20,20,20,0.98))] shadow-2xl shadow-black/40">
        <div className="border-b border-white/10 px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
            Personal collection
          </p>
          <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">
            My Links
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gls-body">
            Import guaranteed-playable member-facing links: HLS (.m3u8), YouTube,
            Vimeo, MP4, WebM. Use a clear title — avoid raw hash names. Organize into
            folders like Movies, Kung Fu, Sports, and News. These stay in your library,
            separate from the licensed GLS catalog. Full IPTV playlists still go to{" "}
            <Link href="/playlists" className="text-white underline-offset-2 hover:underline">
              My Playlists
            </Link>
            .
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
                placeholder="https://…/index.m3u8 or YouTube / MP4 (http public IP OK)"
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
                  Folder
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-gls-red"
                >
                  {MEDIA_LINK_CATEGORIES.map((c) => (
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
                    Format OK ·{" "}
                    <strong>{MEDIA_FORMAT_META[preview.format!].label}</strong>
                    {preview.title ? ` · ${preview.title}` : ""}
                    <span className="block text-xs text-gls-mint/80">
                      {preview.provisional
                        ? "No file extension detected — we’ll confirm video Content-Type when you save."
                        : "We’ll also check reachability when you save."}
                    </span>
                  </>
                ) : (
                  preview.error
                )}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Public Kung Fu picks
              </p>
              <p className="mt-1 text-xs text-gls-muted">
                One-click fills a legally free PD / museum / official cultural
                clip into the form (Kung Fu folder). Not Bruce / Jackie / Jet
                theatrical features — those aren&apos;t free to seed.
              </p>
              <ul className="mt-3 space-y-2">
                {PUBLIC_KUNG_FU_PICKS.map((pick) => (
                  <li key={pick.url}>
                    <button
                      type="button"
                      onClick={() => {
                        setUrl(pick.url);
                        setTitle(pick.title);
                        setCategory(pick.category);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-sm text-white/90 transition hover:border-gls-red/50 hover:bg-white/10"
                    >
                      {pick.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
              {copy("links.disclaimer")}
            </div>

            <button
              type="submit"
              disabled={busy || authLoading || !user || !entitled || !preview?.ok}
              className="gls-cta inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold disabled:opacity-45 sm:w-auto sm:min-w-[200px] sm:px-8"
            >
              {busy ? "Checking & saving…" : "Add to My Links"}
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
                Self-import all of these
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
              <p className="mt-3 text-xs text-gls-muted">
                Local smoke test: use{" "}
                <strong className="text-white/90">Try sample MP4</strong> (same
                origin{" "}
                <code className="text-white/80">/media/sample.mp4</code>
                ). Served from{" "}
                <code className="text-white/80">public/media/</code> — import is
                allowed without probing private networks. Absolute http(s) URLs
                only for other hosts.
              </p>
              <button
                type="button"
                onClick={() => {
                  const sampleUrl = `${window.location.origin}/media/sample.mp4`;
                  setUrl(sampleUrl);
                  if (!title.trim()) setTitle("Sample MP4");
                  setError(null);
                  setSuccess(null);
                }}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/10"
              >
                Try sample MP4
              </button>
            </div>
          </div>
        </div>
      </section>

      {user && featured.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Staff picks</h2>
            <p className="mt-1 text-sm text-gls-muted">
              Curated by GLS for members — separate from the licensed catalog and
              from your personal links.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((link) => (
              <LinkCard
                key={link.id}
                title={link.title}
                url={link.url}
                format={link.format}
                category={link.category}
                thumbnailUrl={link.thumbnail_url}
                href={`/library/featured/${link.id}`}
                badge="Staff"
                onReport={() => void reportLink(link, "admin_media_link")}
              />
            ))}
          </div>
        </section>
      )}

      {user && favorites.length > 0 && !favoritesOnly && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Favorites</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((link) => (
              <LinkCard
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
                onReport={() => void reportLink(link, "user_media_link")}
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
              <LinkCard
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
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Your library</h2>
              <p className="text-sm text-gls-muted">
                Organize into Movies, Kung Fu, Sports, News, and more — only you
                can see these.
              </p>
            </div>
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
              .filter((name) => (categoryCounts.get(name) || 0) > 0 || name === categoryFilter)
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
              <p className="text-lg font-semibold text-white">No links here</p>
              <p className="mt-2 text-sm text-gls-muted">
                {categoryFilter
                  ? `Nothing in ${categoryFilter} yet — add a link and pick that folder.`
                  : "Paste a public .m3u8, YouTube URL, or MP4 above to start."}
              </p>
            </div>
          ) : categoryFilter ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((link) => (
                <LinkCard
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
                  onReport={() => void reportLink(link, "user_media_link")}
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
                      <LinkCard
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
                        onReport={() => void reportLink(link, "user_media_link")}
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

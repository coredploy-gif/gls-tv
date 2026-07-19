"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { MediaLinkCard } from "@/components/MediaLinkCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isWeakMediaLinkTitle,
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

function MediaLibraryInner() {
  const { user, loading: authLoading } = useAuth();
  const copy = useAppCopy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [featured, setFeatured] = useState<AdminMediaLink[]>([]);
  const [linkCount, setLinkCount] = useState(0);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Movies");
  const [preview, setPreview] = useState<ReturnType<typeof validateMediaLinkUrl> | null>(
    null,
  );
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setShowAddForm(true);
      router.replace("/library", { scroll: false });
    }
  }, [searchParams, router]);

  const load = useCallback(async () => {
    if (!user) {
      setFeatured([]);
      setLinkCount(0);
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
      const staffData = (await staff.json()) as {
        links?: AdminMediaLink[];
        error?: string;
      };
      if (!mine.ok) throw new Error(mineData.error || "Could not load library");
      setLinkCount((mineData.links || []).length);
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
    const next = validateMediaLinkUrl(url, title);
    setPreview(next);
    if (next.ok && next.title && isWeakMediaLinkTitle(title)) {
      setTitle(next.title);
    }
  }, [url, title]);

  useEffect(() => {
    if (!showAddForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      setShowAddForm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddForm, busy]);

  const openAddForm = () => {
    setShowAddForm(true);
    setError(null);
  };

  const closeAddForm = () => {
    if (busy) return;
    setShowAddForm(false);
  };

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
      setShowAddForm(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
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
      <section className="overflow-hidden rounded-sm border border-white/10 bg-[linear-gradient(135deg,rgba(229,9,20,0.18),rgba(10,10,10,0.9)_45%,rgba(26,26,26,0.95))] shadow-2xl shadow-black/50">
        <div className="px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
            Personal collection
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="gls-display text-5xl text-white sm:text-6xl md:text-7xl">
              My Links
            </h1>
            <Link
              href="/library/saved"
              className="shrink-0 rounded border border-white/25 px-4 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              Saved links
            </Link>
          </div>
          <p className="mt-3 max-w-2xl text-base text-gls-body sm:text-lg">
            Save HLS, YouTube, Vimeo, MP4, or WebM links to your account. Staff
            picks appear below — your personal library lives under Saved links.
          </p>
          <button
            type="button"
            onClick={openAddForm}
            className="gls-cta mt-6 inline-flex h-12 items-center justify-center rounded px-8 text-base font-semibold sm:h-14 sm:px-10 sm:text-lg"
          >
            Add
          </button>
        </div>
      </section>

      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={closeAddForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-link-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-sm border border-white/15 bg-[linear-gradient(160deg,rgba(28,10,12,0.98),rgba(10,10,10,0.98)_40%,rgba(18,18,18,0.98))] shadow-2xl shadow-black/60 sm:rounded-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gls-red">
                  Import
                </p>
                <h2
                  id="add-link-title"
                  className="gls-display mt-1 text-3xl text-white"
                >
                  Add link
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

            <div className="grid gap-8 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
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
                    autoFocus
                    placeholder="https://…/index.m3u8 or YouTube / MP4 (http public IP OK)"
                    className="w-full rounded-sm border-2 border-white/25 bg-black/55 px-4 py-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-gls-red focus:ring-2 focus:ring-gls-red/40"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                      Display name / Title
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Prefills from URL — edit before save"
                      className="w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-gls-red focus:ring-1 focus:ring-gls-red"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                      Folder
                    </span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-gls-red focus:ring-1 focus:ring-gls-red"
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
                    className={`rounded-sm border px-4 py-3 text-sm ${
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

                <div className="rounded-sm border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Public Kung Fu picks
                  </p>
                  <p className="mt-1 text-xs text-gls-muted">
                    One-click fills a legally free PD / museum / official cultural
                    clip into the form (Kung Fu folder).
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

                <div className="rounded-sm border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  {copy("links.disclaimer")}
                </div>

                <button
                  type="submit"
                  disabled={
                    busy || authLoading || !user || !entitled || !preview?.ok
                  }
                  className="gls-cta inline-flex h-12 w-full items-center justify-center rounded text-base font-semibold disabled:opacity-45 sm:w-auto sm:min-w-[200px] sm:px-8"
                >
                  {busy ? "Checking & saving…" : "Add to My Links"}
                </button>
                {!user && !authLoading && (
                  <p className="text-sm font-medium text-amber-200">
                    Sign in on the right first — then Add stays unlocked.
                  </p>
                )}
                {user && !loading && !entitled && (
                  <p className="text-sm text-amber-200">
                    Membership required.{" "}
                    <Link href="/pricing" className="underline">
                      View plans
                    </Link>
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

              <div className="space-y-4 lg:border-l lg:border-white/10 lg:pl-8">
                {!user && !authLoading ? (
                  <Suspense
                    fallback={<p className="text-sm text-gls-muted">Loading…</p>}
                  >
                    <AuthPanel onDone={() => void load()} />
                  </Suspense>
                ) : null}
                <div className="rounded-sm border border-white/10 bg-black/30 p-4">
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
                    Local smoke test:{" "}
                    <strong className="text-white/90">Try sample MP4</strong> (
                    <code className="text-white/80">/media/sample.mp4</code>).
                    Full IPTV playlists go to{" "}
                    <Link
                      href="/playlists"
                      className="text-white underline-offset-2 hover:underline"
                    >
                      My Playlists
                    </Link>
                    .
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
              {success}{" "}
              <Link
                href="/library/saved"
                className="underline underline-offset-2 hover:text-white"
              >
                View saved links
              </Link>
            </p>
          )}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="gls-display text-4xl text-white">Staff picks</h2>
            <p className="mt-1 text-sm text-gls-muted">
              Curated by GLS for members — separate from the licensed catalog and
              from your personal links.
            </p>
          </div>
          {user && linkCount > 0 && (
            <Link
              href="/library/saved"
              className="text-sm text-gls-body underline-offset-2 hover:text-white hover:underline"
            >
              Your library · {linkCount}
            </Link>
          )}
        </div>

        {!user && !authLoading && (
          <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-lg text-white">Sign in to browse Staff picks</p>
            <p className="mt-2 text-sm text-gls-muted">
              Member-curated streams appear here after you sign in — no Who&apos;s
              watching step beyond your usual session.
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

        {user && loading && (
          <p className="text-sm text-gls-muted">Loading Staff picks…</p>
        )}

        {user && !loading && featured.length === 0 && (
          <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-lg text-white">No Staff picks yet</p>
            <p className="mt-2 text-sm text-gls-muted">
              Use Add to save your own links, or check back when GLS publishes
              new picks.
            </p>
          </div>
        )}

        {user && featured.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((link) => (
              <MediaLinkCard
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
        )}
      </section>
    </div>
  );
}

export function MediaLibrary() {
  return (
    <Suspense fallback={<p className="text-sm text-gls-muted">Loading…</p>}>
      <MediaLibraryInner />
    </Suspense>
  );
}

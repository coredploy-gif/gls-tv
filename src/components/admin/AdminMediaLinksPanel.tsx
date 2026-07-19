"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isWeakMediaLinkTitle,
  MEDIA_FORMAT_META,
  MEDIA_LINK_CATEGORIES,
  type AdminMediaLink,
  type MediaLinkFormat,
  validateMediaLinkUrl,
} from "@/lib/media-links";

type PreviewState = {
  url: string;
  title: string;
  category: string;
  notes: string;
  format: MediaLinkFormat;
  thumbnailUrl?: string;
  embedUrl?: string;
};

export function AdminMediaLinksPanel() {
  const [links, setLinks] = useState<AdminMediaLink[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Sports");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/media-links", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || "Failed to load admin links");
      return;
    }
    setLinks(data.links || []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (url.trim().length < 8) return;
    const next = validateMediaLinkUrl(url, title);
    if (next.ok && next.title && isWeakMediaLinkTitle(title)) {
      setTitle(next.title);
    }
    if (next.ok && next.format === "hls" && category === "Featured") {
      setCategory("Sports");
    }
  }, [url, title, category]);

  const liveCheck =
    url.trim().length > 8 ? validateMediaLinkUrl(url, title) : null;

  const openPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setPreview(null);
    const v = validateMediaLinkUrl(url, title);
    if (!v.ok || !v.format || !v.title) {
      setStatus(v.error || "Invalid URL");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/media-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: v.title,
          category: category.trim() || "Sports",
          notes: notes.trim(),
          preview_only: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Preview failed");
      }
      const p = data.preview as PreviewState & { probe?: string };
      setPreview({
        url: p.url,
        title: p.title,
        category: p.category,
        notes: p.notes || "",
        format: p.format,
        thumbnailUrl: p.thumbnailUrl,
        embedUrl: p.embedUrl,
      });
      setStatus(p.probe ? `Preview OK · ${p.probe}` : "Preview OK");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async (publish: boolean) => {
    if (!preview) return;
    if (publish) {
      const ok = window.confirm(
        `Publish “${preview.title}” to all members?\n\nIt will appear under My Links → Staff picks (not the licensed catalog).`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/media-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: preview.url,
          title: preview.title,
          category: preview.category,
          notes: preview.notes,
          is_published: publish,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus(
        publish
          ? `Published “${data.link?.title}” — visible on My Links → Staff picks.`
          : `Draft saved “${data.link?.title}”. Preview again, then Confirm publish.`,
      );
      setUrl("");
      setTitle("");
      setNotes("");
      setPreview(null);
      await load();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const setPublished = async (link: AdminMediaLink, is_published: boolean) => {
    if (is_published) {
      const ok = window.confirm(
        `Publish “${link.title}” to all members under My Links → Staff picks?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/media-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.id, is_published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      setLinks((prev) =>
        prev.map((row) =>
          row.id === link.id ? { ...row, is_published } : row,
        ),
      );
      setStatus(
        is_published
          ? `Published “${link.title}”.`
          : `Unpublished “${link.title}” (draft).`,
      );
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this admin link?")) return;
    const res = await fetch(`/api/admin/media-links?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setStatus("Delete failed");
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const rename = async (link: AdminMediaLink) => {
    const next = prompt("Display name / Title", link.title)?.trim();
    if (!next || next === link.title) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/media-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.id, title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rename failed");
      setLinks((prev) =>
        prev.map((row) => (row.id === link.id ? { ...row, title: next } : row)),
      );
      setStatus(`Renamed to “${next}”.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Staff media picks</h2>
        <p className="mt-1 text-sm text-gls-muted">
          Curate playable links for members. They appear on{" "}
          <strong className="text-white/80">My Links → Staff picks</strong> after
          you preview and confirm publish — never mixed into the licensed catalog.
          Members self-import their own HLS / YouTube / Vimeo / MP4 / WebM under My
          Links.
        </p>
      </div>

      <form onSubmit={openPreview} className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
            Media URL
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
            }}
            required
            placeholder="https://…/index.m3u8 or http://IP:port/play/… (any public host; http IP OK)"
            className="gls-admin-input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
            Display name / Title
          </span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setPreview(null);
            }}
            placeholder="Prefills from URL — edit before save"
            className="gls-admin-input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
            Folder
          </span>
          <select
            value={
              MEDIA_LINK_CATEGORIES.includes(
                category as (typeof MEDIA_LINK_CATEGORIES)[number],
              )
                ? category
                : "Other"
            }
            onChange={(e) => {
              setCategory(e.target.value);
              setPreview(null);
            }}
            className="gls-admin-input w-full"
          >
            {MEDIA_LINK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (optional)"
          className="gls-admin-input sm:col-span-2"
        />
        {liveCheck && (
          <p
            className={`sm:col-span-2 text-sm ${
              liveCheck.ok ? "text-gls-mint" : "text-amber-200"
            }`}
          >
            {liveCheck.ok
              ? `Format OK · ${MEDIA_FORMAT_META[liveCheck.format as MediaLinkFormat].label}${
                  liveCheck.title ? ` · ${liveCheck.title}` : ""
                }`
              : liveCheck.error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !liveCheck?.ok}
          className="rounded-lg border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40 sm:col-span-2 sm:w-fit"
        >
          {busy && !preview ? "Checking…" : "Preview before publish"}
        </button>
      </form>

      {preview && (
        <div className="rounded-xl border border-gls-mint/30 bg-gls-mint/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gls-mint">
            Member preview
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row">
            <div
              className="relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/50 sm:w-56"
              style={{
                background: `linear-gradient(135deg, ${MEDIA_FORMAT_META[preview.format].accent}33, #0a0a0a)`,
              }}
            >
              {preview.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-white/80">
                  {MEDIA_FORMAT_META[preview.format].label}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Name on My Links
                </span>
                <input
                  value={preview.title}
                  onChange={(e) =>
                    setPreview({ ...preview, title: e.target.value })
                  }
                  className="gls-admin-input w-full text-lg font-semibold"
                />
              </label>
              <p className="mt-1 truncate text-xs text-gls-muted">{preview.url}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-gls-muted">
                {MEDIA_FORMAT_META[preview.format].label} · Folder:{" "}
                {preview.category}
              </p>
              {preview.embedUrl && (
                <p className="mt-2 text-xs text-gls-muted">
                  Embed ready · members play via My Links watch page
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !preview.title.trim()}
                  onClick={() => void save(false)}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  disabled={busy || !preview.title.trim()}
                  onClick={() => void save(true)}
                  className="gls-cta rounded-lg px-4 py-2 text-sm disabled:opacity-40"
                >
                  {busy ? "Publishing…" : "Confirm publish"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPreview(null)}
                  className="rounded-lg px-3 py-2 text-sm text-gls-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status && <p className="text-sm text-gls-muted">{status}</p>}

      <ul className="max-h-96 space-y-2 overflow-y-auto">
        {links.map((link) => (
          <li
            key={link.id}
            className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{link.title}</p>
              <p className="truncate text-xs text-gls-muted">{link.url}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-gls-muted">
                {MEDIA_FORMAT_META[link.format]?.label || link.format} ·{" "}
                {link.category}
                {link.is_published ? " · published" : " · draft"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {link.is_published ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setPublished(link, false)}
                  className="rounded border border-white/20 px-3 py-1.5 text-xs text-gls-muted"
                >
                  Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setPublished(link, true)}
                  className="rounded border border-gls-mint/40 px-3 py-1.5 text-xs text-gls-mint"
                >
                  Confirm publish
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void rename(link)}
                className="rounded border border-white/20 px-3 py-1.5 text-xs text-white/80"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => void remove(link.id)}
                className="rounded border border-gls-red/40 px-3 py-1.5 text-xs text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {!links.length && (
          <li className="text-sm text-gls-muted">No admin media links yet.</li>
        )}
      </ul>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MEDIA_FORMAT_META,
  type AdminMediaLink,
  type MediaLinkFormat,
  validateMediaLinkUrl,
} from "@/lib/media-links";

export function AdminMediaLinksPanel() {
  const [links, setLinks] = useState<AdminMediaLink[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Featured");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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

  const preview = url.trim().length > 8 ? validateMediaLinkUrl(url, title) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/media-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          category,
          notes,
          is_published: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus(`Saved “${data.link?.title}”.`);
      setUrl("");
      setTitle("");
      setNotes("");
      await load();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Save failed");
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

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Quick media links</h2>
        <p className="mt-1 text-sm text-gls-muted">
          Import guaranteed-playable member-facing links: HLS (.m3u8), YouTube,
          Vimeo, MP4, WebM. Use a clear title — avoid raw hash names.
        </p>
      </div>

      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://jmp2.uk/rok-….m3u8"
          className="gls-admin-input sm:col-span-2"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Display title (e.g. Hell’s Kitchen)"
          className="gls-admin-input"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="gls-admin-input"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (optional)"
          className="gls-admin-input sm:col-span-2"
        />
        {preview && (
          <p
            className={`sm:col-span-2 text-sm ${
              preview.ok ? "text-gls-mint" : "text-amber-200"
            }`}
          >
            {preview.ok
              ? `Ready · ${MEDIA_FORMAT_META[preview.format as MediaLinkFormat].label}`
              : preview.error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !preview?.ok}
          className="gls-cta rounded-lg px-5 py-2.5 text-sm disabled:opacity-40 sm:col-span-2 sm:w-fit"
        >
          {busy ? "Saving…" : "Publish link"}
        </button>
      </form>

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
            <button
              type="button"
              onClick={() => void remove(link.id)}
              className="rounded border border-gls-red/40 px-3 py-1.5 text-xs text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
        {!links.length && (
          <li className="text-sm text-gls-muted">No admin media links yet.</li>
        )}
      </ul>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type LinkRow = {
  id: string;
  title: string;
  url: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
};

export default function AdminSystemLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [placement, setPlacement] = useState("nav");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system-links", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Links could not be loaded");
      setLinks(json.links || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Links could not be loaded");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const add = async () => {
    if (!title.trim() || !url.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/system-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title,
          url,
          placement,
          is_active: isActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Link could not be saved");
      setTitle("");
      setUrl("");
      setPlacement("nav");
      setIsActive(true);
      setEditingId(null);
      setMessage(editingId ? "Link updated." : "Link created.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Link could not be saved");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this managed link?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Link could not be deleted");
      setMessage("Link deleted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Link could not be deleted");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Site wiring"
        title="System links"
        description="Add managed URLs for nav, footer, landing, sports, and custom surfaces across GLS TV."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="gls-admin-card h-fit space-y-3 rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
            {editingId ? "Edit link" : "Add link"}
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="gls-admin-input"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="gls-admin-input"
          />
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            className="gls-admin-input"
          >
            {["nav", "footer"].map(
              (p) => (
                <option key={p} value={p}>
                  Placement: {p}
                </option>
              ),
            )}
          </select>
          <label className="flex items-center gap-2 text-sm text-gls-body">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Published
          </label>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="gls-cta w-full rounded-md px-3 py-2.5 text-sm"
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Add link"}
          </button>
          {editingId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setUrl("");
                setPlacement("nav");
                setIsActive(true);
              }}
              className="w-full rounded border border-white/20 px-3 py-2 text-sm text-white"
            >
              Cancel edit
            </button>
          )}
          <div aria-live="polite">
            {error && <p className="text-sm text-red-200">{error}</p>}
            {message && <p className="text-sm text-emerald-200">{message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.id}
              className="gls-admin-card flex items-center justify-between gap-3 rounded-lg px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{l.title}</p>
                  <span className="gls-admin-pill bg-white/10 text-gls-body">
                    {l.placement}
                  </span>
                  <span className="gls-admin-pill bg-white/10 text-gls-body">
                    {l.is_active ? "published" : "draft"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gls-muted">{l.url}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(l.id);
                    setTitle(l.title);
                    setUrl(l.url);
                    setPlacement(l.placement);
                    setIsActive(l.is_active);
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-xs font-medium text-gls-muted transition hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(l.id)}
                  className="text-xs font-medium text-gls-muted transition hover:text-gls-red"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!links.length && (
            <div className="gls-admin-card rounded-lg px-5 py-12 text-center">
              <p className="gls-display text-3xl text-white/15">No links yet</p>
              <p className="mt-2 text-sm text-gls-muted">
                Add your first managed URL on the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/system-links");
    const json = await res.json();
    setLinks(json.links || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!title.trim() || !url.trim()) return;
    await fetch("/api/admin/system-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url, placement }),
    });
    setTitle("");
    setUrl("");
    void load();
  };

  const remove = async (id: string) => {
    await fetch("/api/admin/system-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    void load();
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
            Add link
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
            {["nav", "footer", "browse", "sports", "landing", "custom"].map(
              (p) => (
                <option key={p} value={p}>
                  Placement: {p}
                </option>
              ),
            )}
          </select>
          <button
            type="button"
            onClick={add}
            className="gls-cta w-full rounded-md px-3 py-2.5 text-sm"
          >
            Add link
          </button>
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
                </div>
                <p className="mt-1 truncate text-xs text-gls-muted">{l.url}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(l.id)}
                className="shrink-0 text-xs font-medium text-gls-muted transition hover:text-gls-red"
              >
                Remove
              </button>
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

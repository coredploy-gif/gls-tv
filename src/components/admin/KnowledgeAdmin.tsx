"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  category: string;
  is_published: boolean;
};

export function KnowledgeAdmin() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/knowledge?admin=1&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    setArticles(json.articles || []);
  }, [q]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const save = async () => {
    if (!editing?.title) return;
    await fetch("/api/admin/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", ...editing }),
    });
    setEditing(null);
    void load();
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Answers engine"
        title="Knowledge base"
        description="Powers live chat for the entire GLS TV system — plans, profiles, streams, and support."
        actions={
          <button
            type="button"
            className="gls-cta rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide"
            onClick={() =>
              setEditing({
                title: "",
                summary: "",
                body_md: "",
                category: "general",
                is_published: true,
              })
            }
          >
            + Article
          </button>
        }
      />

      <div className="mt-8 max-w-lg">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search knowledge…"
          className="gls-admin-input"
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {articles.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setEditing(a)}
            className="gls-admin-card group rounded-lg px-5 py-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-white transition group-hover:text-white">
                {a.title}
              </p>
              <span className="gls-admin-pill shrink-0 bg-gls-red/15 text-gls-red">
                {a.category}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gls-muted">
              {a.summary}
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-white/30 group-hover:text-gls-red/80">
              {a.is_published ? "Published" : "Draft"} · Edit →
            </p>
          </button>
        ))}
      </div>

      {editing && (
        <div
          className="gls-admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="gls-admin-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
              Article
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">
              {editing.id ? "Edit article" : "New article"}
            </h3>
            <div className="mt-5 space-y-3">
              <input
                className="gls-admin-input"
                placeholder="Title"
                value={editing.title || ""}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
              <input
                className="gls-admin-input"
                placeholder="Summary"
                value={editing.summary || ""}
                onChange={(e) =>
                  setEditing({ ...editing, summary: e.target.value })
                }
              />
              <input
                className="gls-admin-input"
                placeholder="Category"
                value={editing.category || ""}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
              />
              <textarea
                className="gls-admin-input h-52 font-mono text-xs leading-relaxed"
                placeholder="Markdown body"
                value={editing.body_md || ""}
                onChange={(e) =>
                  setEditing({ ...editing, body_md: e.target.value })
                }
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="gls-cta rounded-md px-5 py-2.5 text-sm"
                onClick={save}
              >
                Save article
              </button>
              <button
                type="button"
                className="rounded-md border border-white/20 px-5 py-2.5 text-sm text-gls-body hover:text-white"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

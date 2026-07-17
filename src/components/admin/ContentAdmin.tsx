"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { COPY_FALLBACKS, t, type CopyKey } from "@/lib/copy";

type Entry = {
  key: string;
  value: string;
  updated_at?: string;
  fromDb?: boolean;
};

export function ContentAdmin() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/content?admin=1", { cache: "no-store" });
    const json = await res.json();
    setEntries(json.entries || []);
    if (json.warning) setMsg(json.warning);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const filtered = entries.filter((e) => {
    const hay = `${e.key} ${e.value}`.toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  });

  const openEdit = (e: Entry) => {
    setEditing(e);
    setDraft(e.value);
    setMsg(null);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          key: editing.key,
          value: draft,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Save failed");
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetKey = async (key: string) => {
    if (!confirm(`Reset “${key}” to the code fallback?`)) return;
    setBusy(true);
    try {
      await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", key }),
      });
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content engine"
        title="App copy"
        description="Edit user-facing strings (FAQ, auth errors, player notices, My Links disclaimer). Code fallbacks keep the UI safe if a key is missing."
      />

      <div className="mt-8 max-w-lg">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search keys or text…"
          className="gls-admin-input"
        />
      </div>

      {msg && (
        <p className="mt-4 text-sm text-amber-200/90">{msg}</p>
      )}

      <div className="mt-5 space-y-2">
        {filtered.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => openEdit(e)}
            className="gls-admin-card flex w-full flex-col gap-1 rounded-lg px-5 py-4 text-left"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="text-xs font-semibold text-gls-red">{e.key}</code>
              <span className="gls-admin-pill text-[10px]">
                {e.fromDb ? "DB" : "Fallback"}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-gls-muted">{e.value}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/15 px-4 py-10 text-center text-sm text-gls-muted">
            No keys match.
          </p>
        )}
      </div>

      {editing && (
        <div
          className="gls-admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="gls-admin-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg p-6"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
              Copy key
            </p>
            <h3 className="mt-1 font-mono text-lg text-white">{editing.key}</h3>
            <p className="mt-2 text-xs text-gls-muted">
              Fallback:{" "}
              {COPY_FALLBACKS[editing.key as CopyKey] ||
                t(editing.key) ||
                "—"}
            </p>
            <textarea
              className="gls-admin-input mt-4 h-40 leading-relaxed"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="gls-cta rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resetKey(editing.key)}
                className="rounded-md border border-white/20 px-4 py-2 text-xs font-semibold text-white/80"
              >
                Reset to fallback
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md px-4 py-2 text-xs font-semibold text-gls-muted"
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

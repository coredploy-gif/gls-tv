"use client";

import { useCallback, useEffect, useState } from "react";

type Report = {
  id: string;
  target_kind: string;
  target_id: string;
  target_title: string | null;
  target_url: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

export function LinkReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/media-links/report", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json.error || "Failed to load reports");
      return;
    }
    setReports(json.reports || []);
    setStatus(null);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const resolve = async (id: string, next: string) => {
    const res = await fetch("/api/media-links/report", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    if (!res.ok) {
      setStatus("Update failed");
      return;
    }
    await load();
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Link reports</h2>
        <p className="mt-1 text-sm text-gls-muted">
          Member reports on My Links / Staff picks. Resolve or dismiss after review.
        </p>
      </div>
      {status && <p className="text-sm text-amber-200">{status}</p>}
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {reports.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-white/10 p-3 text-sm"
          >
            <p className="font-medium text-white">
              {r.target_title || r.target_id}{" "}
              <span className="text-xs uppercase text-gls-muted">
                · {r.target_kind} · {r.reason} · {r.status}
              </span>
            </p>
            {r.target_url && (
              <p className="truncate text-xs text-gls-muted">{r.target_url}</p>
            )}
            {r.details && <p className="mt-1 text-xs text-gls-body">{r.details}</p>}
            {r.status === "open" || r.status === "reviewing" ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border border-gls-mint/40 px-2 py-1 text-xs text-gls-mint"
                  onClick={() => void resolve(r.id, "resolved")}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  className="rounded border border-white/20 px-2 py-1 text-xs text-gls-muted"
                  onClick={() => void resolve(r.id, "dismissed")}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {!reports.length && (
          <li className="text-sm text-gls-muted">No reports yet.</li>
        )}
      </ul>
    </section>
  );
}

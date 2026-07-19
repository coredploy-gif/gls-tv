"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type AuditItem = {
  id: string;
  source: "audit" | "billing";
  at: string;
  action: string;
  summary: string | null;
  actor: string | null;
  entityType: string | null;
  entityId: string | null;
  amountZar: number | null;
};

export function AuditTrail() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ source, q, limit: "120" });
    const res = await fetch(`/api/admin/audit?${params}`);
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || "Failed");
      return;
    }
    setErr(null);
    setItems(json.items || []);
  }, [source, q]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Compliance"
        title="Audit trail"
        description="Admin actions + billing events — who changed what, grants, refunds, replies."
      />

      <div className="gls-admin-card gls-h-scroll gls-h-scroll-row mt-8 rounded-lg p-3">
        <input
          className="gls-admin-input min-w-[200px] flex-1"
          placeholder="Filter action / actor / id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="gls-admin-input w-auto shrink-0"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="all">All sources</option>
          <option value="audit">Admin audit</option>
          <option value="billing">Billing events</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-md border border-white/20 px-4 py-2 text-sm text-gls-body hover:text-white"
        >
          Apply
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-gls-red">{err}</p>}

      <div className="gls-admin-card gls-h-scroll mt-4 rounded-lg">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-white/[0.04]">
                <td className="px-4 py-3 text-xs text-gls-muted">
                  {new Date(i.at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`gls-admin-pill ${
                      i.source === "billing"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-sky-500/15 text-sky-200"
                    }`}
                  >
                    {i.source}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white">
                  {i.action}
                </td>
                <td className="px-4 py-3 text-gls-body">
                  {i.summary || "—"}
                  {i.entityId && (
                    <span className="mt-0.5 block font-mono text-[10px] text-gls-muted">
                      {i.entityType}:{i.entityId.slice(0, 18)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gls-muted">
                  {i.actor || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-white">
                  {i.amountZar != null ? `R${i.amountZar}` : "—"}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-gls-muted">
                  No events yet — grants, refunds, and replies will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

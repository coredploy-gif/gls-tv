"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Row = {
  id: string;
  payment_reference: string;
  member_reference: string;
  amount_zar_cents: number;
  payment_method: string;
  match: string;
  yoco_status: string | null;
  updated_at: string;
};

type Payload = {
  summary: {
    paidCount: number;
    matched: number;
    missingInYoco: number;
    yocoUnpaid: number;
    eftOrManual: number;
    yocoConfigured: boolean;
    yocoError: string | null;
  };
  rows: Row[];
};

export function ReconciliationBoard() {
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reconciliation", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json.error || "Failed to load");
      return;
    }
    setData(json);
    setStatus(null);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const snapshot = async () => {
    setStatus("Saving snapshot…");
    const res = await fetch("/api/admin/reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record_run", note: "Ops reconciliation" }),
    });
    const json = await res.json();
    setStatus(res.ok ? "Snapshot recorded." : json.error || "Failed");
  };

  const s = data?.summary;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="Reconciliation"
        description="Match GLS paid memberships against recent Yoco payment links. EFT/manual rows stay separate."
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="gls-cta rounded px-4 py-2 text-sm" onClick={() => void load()}>
          Refresh
        </button>
        <button
          type="button"
          className="rounded border border-white/20 px-4 py-2 text-sm text-white"
          onClick={() => void snapshot()}
        >
          Save snapshot
        </button>
      </div>
      {status && <p className="mt-3 text-sm text-amber-200">{status}</p>}
      {s && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Paid (GLS)", s.paidCount],
            ["Yoco matched", s.matched],
            ["Missing in Yoco", s.missingInYoco],
            ["Yoco unpaid", s.yocoUnpaid],
            ["EFT / manual", s.eftOrManual],
          ].map(([label, value]) => (
            <div key={String(label)} className="gls-admin-card rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-gls-muted">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}
      {s?.yocoError && (
        <p className="mt-3 text-sm text-red-300">Yoco list error: {s.yocoError}</p>
      )}
      {!s?.yocoConfigured && (
        <p className="mt-3 text-sm text-amber-200">
          YOCO_SECRET_KEY is not set — only GLS-side rows are shown.
        </p>
      )}
      <ul className="mt-6 max-h-[32rem] space-y-2 overflow-y-auto">
        {(data?.rows || []).map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-1 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm text-white">{row.payment_reference}</p>
              <p className="truncate text-xs text-gls-muted">
                {row.member_reference} · R{(row.amount_zar_cents / 100).toFixed(0)} ·{" "}
                {row.payment_method}
              </p>
            </div>
            <span
              className={`text-xs uppercase ${
                row.match === "matched"
                  ? "text-gls-mint"
                  : row.match === "missing_in_yoco" || row.match === "yoco_unpaid"
                    ? "text-amber-200"
                    : "text-gls-muted"
              }`}
            >
              {row.match.replaceAll("_", " ")}
              {row.yoco_status ? ` · yoco:${row.yoco_status}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

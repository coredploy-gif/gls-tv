"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Invoice = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  customerEmail: string | null;
  created: number;
  hostedUrl: string | null;
  pdf: string | null;
};

export function FinanceInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(
      `/api/admin/billing?view=invoices&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    if (json.error && !json.invoices?.length) setErr(json.error);
    setInvoices(json.invoices || []);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const refund = async (invoiceId: string) => {
    if (!confirm("Issue a full Stripe refund for this paid invoice?")) return;
    setBusy(invoiceId);
    setMsg(null);
    const res = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refund_invoice", invoiceId }),
    });
    const json = await res.json();
    setBusy(null);
    setMsg(
      res.ok
        ? `Refunded R${json.amount} (${json.refundId})`
        : json.error || "Refund failed",
    );
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="Invoices"
        description="Live Stripe invoice feed in ZAR. Open hosted invoices, PDFs, or issue refunds."
      />
      <input
        className="gls-admin-input mt-8 max-w-md"
        placeholder="Search email / number / status…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {err && <p className="mt-3 text-sm text-amber-200">{err}</p>}
      {msg && <p className="mt-3 text-sm text-gls-body">{msg}</p>}

      <div className="mt-5 space-y-2">
        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="gls-admin-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4"
          >
            <div>
              <p className="font-semibold text-white">
                {inv.number || inv.id}
              </p>
              <p className="mt-1 text-xs text-gls-muted">
                {inv.customerEmail || "—"} · {inv.status} ·{" "}
                {new Date(inv.created * 1000).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold text-emerald-300">
                {inv.currency} {inv.amount.toFixed(0)}
              </p>
              {inv.hostedUrl && (
                <a
                  href={inv.hostedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gls-pink hover:underline"
                >
                  Open
                </a>
              )}
              {inv.pdf && (
                <a
                  href={inv.pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gls-sky hover:underline"
                >
                  PDF
                </a>
              )}
              {inv.status === "paid" && (
                <button
                  type="button"
                  disabled={busy === inv.id}
                  onClick={() => void refund(inv.id)}
                  className="rounded-md border border-gls-red/40 px-2.5 py-1 text-xs text-red-200 hover:bg-gls-red/10 disabled:opacity-40"
                >
                  {busy === inv.id ? "…" : "Refund"}
                </button>
              )}
            </div>
          </div>
        ))}
        {!invoices.length && !err && (
          <p className="py-12 text-center text-sm text-gls-muted">
            No invoices yet.
          </p>
        )}
      </div>
    </div>
  );
}

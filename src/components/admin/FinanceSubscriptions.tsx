"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Sub = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  provider: string;
  external_id: string;
  current_period_end: string | null;
  amount_zar_cents: number | null;
  email: string | null;
  display_name: string | null;
  updated_at: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  trialing: "bg-sky-500/15 text-sky-200",
  past_due: "bg-amber-500/15 text-amber-200",
  canceled: "bg-white/10 text-gls-muted",
  unpaid: "bg-gls-red/20 text-red-200",
};

export function FinanceSubscriptions() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/billing?view=subscriptions&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    setSubs(json.subscriptions || []);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (subscriptionId: string) => {
    if (!confirm("Cancel this Stripe subscription at period end?")) return;
    const res = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel_stripe",
        subscriptionId,
        atPeriodEnd: true,
      }),
    });
    const json = await res.json();
    setMsg(res.ok ? "Cancel scheduled at period end" : json.error || "Failed");
    void load();
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="Subscriptions"
        description="Local subscription mirror synced from Stripe webhooks and admin grants."
      />
      <input
        className="gls-admin-input mt-8 max-w-md"
        placeholder="Filter email / status / plan…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {msg && <p className="mt-3 text-sm text-gls-body">{msg}</p>}

      <div className="gls-admin-card mt-5 overflow-x-auto rounded-xl">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-gls-muted">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Period end</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-t border-white/[0.05]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">
                    {s.email || s.display_name || s.user_id.slice(0, 8)}
                  </p>
                  <p className="font-mono text-[10px] text-gls-muted">
                    {s.external_id}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gls-pink">
                  {s.plan}
                  {s.amount_zar_cents
                    ? ` · R${s.amount_zar_cents / 100}`
                    : ""}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`gls-admin-pill ${STATUS_TONE[s.status] || "bg-white/10 text-gls-body"}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gls-muted">{s.provider}</td>
                <td className="px-4 py-3 text-xs text-gls-muted">
                  {s.current_period_end
                    ? new Date(s.current_period_end).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {s.provider === "stripe" &&
                    s.external_id?.startsWith("sub_") && (
                      <button
                        type="button"
                        className="text-xs text-gls-red hover:underline"
                        onClick={() => cancel(s.external_id)}
                      >
                        Cancel
                      </button>
                    )}
                </td>
              </tr>
            ))}
            {!subs.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-gls-muted"
                >
                  No subscriptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

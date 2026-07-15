"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Row = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  status: string;
  external_id?: string;
  current_period_end: string | null;
  amount_zar_cents?: number | null;
  stripe_customer_id: string | null;
};

function CollectionSection({
  title,
  rows,
  tone,
  kind,
  busy,
  onRemind,
  onPortal,
  onCancel,
}: {
  title: string;
  rows: Row[];
  tone: string;
  kind: string;
  busy: string | null;
  onRemind: (userId: string, kind: string) => void;
  onPortal: (customerId: string) => void;
  onCancel: (subscriptionId: string) => void;
}) {
  return (
    <section className="gls-admin-card rounded-xl p-5">
      <h2 className={`text-[10px] font-bold uppercase tracking-[0.28em] ${tone}`}>
        {title} · {rows.length}
      </h2>
      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={`${r.user_id}-${r.status}-${r.current_period_end}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/35 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{r.email || r.display_name || r.user_id}</p>
              <p className="text-[11px] text-gls-muted">
                {r.plan} · {r.status}
                {r.current_period_end ? ` · ends ${new Date(r.current_period_end).toLocaleDateString()}` : ""}
                {r.amount_zar_cents ? ` · R${(r.amount_zar_cents / 100).toFixed(0)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy === r.user_id} onClick={() => onRemind(r.user_id, kind)} className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-gls-body hover:text-white disabled:opacity-40">Remind</button>
              {r.stripe_customer_id && <button type="button" onClick={() => onPortal(r.stripe_customer_id!)} className="rounded-md border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10">Portal</button>}
              {r.external_id && kind === "past_due" && <button type="button" onClick={() => onCancel(r.external_id!)} className="rounded-md border border-gls-red/40 px-3 py-1.5 text-xs text-red-200 hover:bg-gls-red/10">Cancel</button>}
            </div>
          </div>
        ))}
        {!rows.length && <p className="py-10 text-center text-sm text-gls-muted">Queue empty</p>}
      </div>
    </section>
  );
}

export function FinanceCollections() {
  const [pastDue, setPastDue] = useState<Row[]>([]);
  const [renewals, setRenewals] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/billing?view=collections");
    const json = await res.json();
    setPastDue(json.pastDue || []);
    setRenewals(json.renewals || []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const remind = async (userId: string, kind: string) => {
    setBusy(userId);
    setMsg(null);
    const res = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_billing_reminder", userId, kind }),
    });
    const json = await res.json();
    setBusy(null);
    setMsg(res.ok ? "In-app reminder sent" : json.error || "Failed");
  };

  const portal = async (customerId: string) => {
    const res = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "portal_link", customerId }),
    });
    const json = await res.json();
    if (res.ok && json.url) window.open(json.url, "_blank");
    else alert(json.error || "Portal unavailable");
  };

  const cancel = async (subscriptionId: string) => {
    if (!confirm("Cancel at period end?")) return;
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel_stripe",
        subscriptionId,
        atPeriodEnd: true,
      }),
    });
    void load();
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="Collections & renewals"
        description="Dormant legacy Stripe collections view. The launch flow uses manual 30-day Yoco/EFT renewals."
      />
      {msg && <p className="mt-4 text-sm text-gls-body">{msg}</p>}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <CollectionSection
          title="Past due"
          rows={pastDue}
          tone="text-amber-200"
          kind="past_due"
          busy={busy}
          onRemind={(userId, reminderKind) => void remind(userId, reminderKind)}
          onPortal={(customerId) => void portal(customerId)}
          onCancel={(subscriptionId) => void cancel(subscriptionId)}
        />
        <CollectionSection
          title="Renewals ≤7 days"
          rows={renewals}
          tone="text-sky-200"
          kind="renewal"
          busy={busy}
          onRemind={(userId, reminderKind) => void remind(userId, reminderKind)}
          onPortal={(customerId) => void portal(customerId)}
          onCancel={(subscriptionId) => void cancel(subscriptionId)}
        />
      </div>
    </div>
  );
}

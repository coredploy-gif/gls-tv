"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GLS_PLANS } from "@/lib/membership/plans";

type Customer = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  is_premium: boolean;
  trial_ends_at: string | null;
  is_admin_exception: boolean;
  trial_bypassed: boolean;
  stripe_customer_id: string | null;
  max_viewer_profiles: number;
  subscription: {
    status: string;
    external_id: string;
    current_period_end: string | null;
    plan: string;
  } | null;
};

export function FinanceCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("gls_55");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/billing?view=customers&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    setCustomers(json.customers || []);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant_plan", email, plan }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Granted ${plan} to ${email}` : json.error || "Failed");
    if (res.ok) {
      setEmail("");
      void load();
    }
  };

  const revoke = async (userId: string) => {
    if (!confirm("Revoke premium for this account?")) return;
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_premium", userId }),
    });
    void load();
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

  const sync = async (userId: string, customerId: string) => {
    const res = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_stripe", userId, customerId }),
    });
    const json = await res.json();
    setMsg(
      res.ok
        ? json.synced
          ? `Synced → ${json.plan} (${json.status})`
          : json.reason || "No sub"
        : json.error || "Sync failed",
    );
    void load();
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="Customers"
        description="Search accounts, grant paid plans, open Stripe Customer Portal, or sync from Stripe."
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="gls-admin-card h-fit space-y-3 rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
            Grant paid plan
          </p>
          <input
            className="gls-admin-input"
            placeholder="member@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="gls-admin-input"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            {GLS_PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — R{p.priceZar}/mo
              </option>
            ))}
            <option value="exception">Exception (comp)</option>
          </select>
          <button
            type="button"
            disabled={busy || !email.includes("@")}
            onClick={grant}
            className="gls-cta w-full rounded-md px-4 py-2.5 text-sm disabled:opacity-40"
          >
            {busy ? "Granting…" : "Grant plan"}
          </button>
          {msg && <p className="text-xs text-gls-body">{msg}</p>}
        </div>

        <div>
          <input
            className="gls-admin-input mb-4 max-w-md"
            placeholder="Search email / plan / Stripe id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="space-y-2">
            {customers.map((c) => (
              <div
                key={c.id}
                className="gls-admin-card rounded-xl px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {c.email || c.display_name || c.id.slice(0, 8)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="gls-admin-pill bg-gls-pink/15 text-gls-pink">
                        {c.plan}
                      </span>
                      {c.is_premium && (
                        <span className="gls-admin-pill bg-emerald-500/15 text-emerald-300">
                          premium
                        </span>
                      )}
                      {c.is_admin_exception && (
                        <span className="gls-admin-pill bg-sky-500/15 text-sky-200">
                          exception
                        </span>
                      )}
                      {c.subscription && (
                        <span className="gls-admin-pill bg-white/10 text-gls-body">
                          {c.subscription.status}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-gls-muted">
                      {c.max_viewer_profiles} profiles
                      {c.trial_ends_at
                        ? ` · trial ends ${new Date(c.trial_ends_at).toLocaleDateString()}`
                        : ""}
                      {c.stripe_customer_id
                        ? ` · ${c.stripe_customer_id}`
                        : " · no Stripe customer"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.stripe_customer_id && (
                      <>
                        <button
                          type="button"
                          className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-gls-body hover:text-white"
                          onClick={() => portal(c.stripe_customer_id!)}
                        >
                          Portal
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-gls-body hover:text-white"
                          onClick={() => sync(c.id, c.stripe_customer_id!)}
                        >
                          Sync
                        </button>
                      </>
                    )}
                    {c.is_premium && (
                      <button
                        type="button"
                        className="rounded-md border border-gls-red/40 px-2.5 py-1 text-[11px] text-gls-red hover:bg-gls-red/10"
                        onClick={() => revoke(c.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!customers.length && (
              <p className="py-10 text-center text-sm text-gls-muted">
                No customers match.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Customer = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  is_premium: boolean;
  is_admin_exception: boolean;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
};

export default function AdminUsersPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/billing?view=customers&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    setCustomers(json.customers || []);
  }, [q]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const grant = async () => {
    setBusy(true);
    setMsg(null);
    setOk(false);
    const res = await fetch("/api/eadmin/exception-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        plan: "exception",
        bypassTrial: true,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setOk(res.ok);
    setMsg(res.ok ? `Granted exception to ${email}` : json.error || "Failed");
    if (res.ok) void load();
  };

  const remind = async (userId: string) => {
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_billing_reminder",
        userId,
        kind: "admin",
      }),
    });
    setMsg("Reminder sent");
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Membership"
        title="Users & exceptions"
        description="Directory + special access. Paid grants live under Finance → Customers."
        actions={
          <Link
            href="/admin/finance/customers"
            className="text-xs font-semibold text-gls-pink hover:text-gls-pink-soft"
          >
            Finance customers →
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="gls-admin-card relative h-fit overflow-hidden rounded-lg p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gls-red/15 blur-3xl" />
          <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
            Grant exception
          </p>
          <p className="relative mt-2 text-sm text-gls-muted">
            Marks the account as premium exception with trial bypass.
          </p>
          <label className="relative mt-5 block text-xs font-medium text-gls-muted">
            User email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="gls-admin-input mt-1.5"
              placeholder="member@email.com"
            />
          </label>
          <button
            type="button"
            disabled={busy || !email.includes("@")}
            onClick={grant}
            className="gls-cta relative mt-5 w-full rounded-md px-4 py-2.5 text-sm disabled:opacity-40"
          >
            {busy ? "Granting…" : "Grant exception"}
          </button>
          {msg && (
            <p
              className={`relative mt-4 rounded-md px-3 py-2 text-sm ${
                ok
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-gls-red/10 text-red-300"
              }`}
            >
              {msg}
            </p>
          )}
        </div>

        <div>
          <input
            className="gls-admin-input mb-4 max-w-md"
            placeholder="Search members…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="space-y-2">
            {customers.map((c) => (
              <div
                key={c.id}
                className="gls-admin-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {c.email || c.display_name || c.id}
                  </p>
                  <p className="text-[11px] text-gls-muted">
                    {c.plan}
                    {c.is_premium ? " · premium" : ""}
                    {c.is_admin_exception ? " · exception" : ""}
                    {c.trial_ends_at
                      ? ` · trial ${new Date(c.trial_ends_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remind(c.id)}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-gls-body hover:text-white"
                >
                  Remind
                </button>
              </div>
            ))}
            {!customers.length && (
              <p className="py-12 text-center text-sm text-gls-muted">
                No profiles matched
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

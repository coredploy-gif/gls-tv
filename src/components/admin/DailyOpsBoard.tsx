"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type OpsPayload = {
  generatedAt: string;
  checklist: Array<{
    id: string;
    label: string;
    count: number;
    href: string;
    severity: string;
  }>;
  stats: {
    openTickets: number;
    waitingTickets: number;
    pastDue: number;
    renewals7d: number;
    trialsEnding3d: number;
    deadChannels: number;
    unreadReminders: number;
    paid: number;
    mrrZar: number;
  };
  urgentTickets: Array<{
    id: string;
    ticket_number: string;
    subject: string;
    priority: string;
    status: string;
  }>;
  collections: Array<{
    user_id: string;
    email: string | null;
    plan: string;
    status: string;
  }>;
  manualQueue: Array<{
    id: string;
    payment_reference: string;
    member_reference: string;
    plan: string;
    amount_zar_cents: number;
    status: string;
    payment_method: string;
    updated_at: string;
  }>;
  renewals: Array<{
    user_id: string;
    email: string | null;
    plan: string;
    current_period_end: string | null;
  }>;
  trialsEnding: Array<{
    id: string;
    email: string | null;
    trial_ends_at: string | null;
  }>;
  channelHealth: Array<{
    slug: string;
    title: string | null;
    health_status: string | null;
  }>;
  cronRuns: Array<{
    job: string;
    status: string;
    summary: string | null;
    started_at: string;
  }>;
  recentAudit: Array<{
    action: string;
    summary: string | null;
    actor_email: string | null;
    created_at: string;
  }>;
};

const SEV: Record<string, string> = {
  urgent: "border-gls-red/40 bg-gls-red/10 text-red-100",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  info: "border-white/10 bg-white/[0.03] text-gls-body",
};

export function DailyOpsBoard() {
  const [data, setData] = useState<OpsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ops");
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || "Failed to load ops");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (err) return <p className="text-sm text-gls-red">{err}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <div className="gls-buffer-ring" />
      </div>
    );
  }

  const s = data.stats;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Daily run"
        title="Operations"
        description="Morning checklist — payment verification, tickets, trials, streams, and cron health."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gls-body hover:border-white/40 hover:text-white"
          >
            Refresh
          </button>
        }
      />

      <p className="mt-2 text-[11px] text-gls-muted">
        Updated {new Date(data.generatedAt).toLocaleString()} · MRR R
        {s.mrrZar.toLocaleString()} · {s.paid} paid
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.checklist.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className={`gls-admin-card rounded-xl border p-4 transition hover:brightness-110 ${SEV[c.severity] || SEV.info}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-white">{c.label}</p>
              <span className="gls-display text-3xl text-white">{c.count}</span>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-wider opacity-70">
              Open →
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <section className="gls-admin-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
              Urgent tickets
            </h2>
            <Link href="/admin/helpdesk" className="text-xs text-gls-muted hover:text-white">
              All →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {data.urgentTickets.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-gls-red">{t.ticket_number}</p>
                  <p className="truncate text-sm text-white">{t.subject}</p>
                </div>
                <span className="gls-admin-pill bg-gls-red/20 text-red-200">
                  {t.priority}
                </span>
              </li>
            ))}
            {!data.urgentTickets.length && (
              <p className="py-6 text-center text-sm text-gls-muted">No urgent tickets</p>
            )}
          </ul>
        </section>

        <section className="gls-admin-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">
              Payments · verify
            </h2>
            <Link
              href="/admin/finance/payments"
              className="text-xs text-gls-muted hover:text-white"
            >
              Work queue →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {data.manualQueue.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-sm"
              >
                <span className="truncate font-mono text-white">
                  {c.payment_reference}
                </span>
                <span className="text-xs text-amber-200">
                  R{(c.amount_zar_cents / 100).toFixed(0)} · {c.status}
                </span>
              </li>
            ))}
            {!data.manualQueue.length && (
              <p className="py-6 text-center text-sm text-gls-muted">All clear</p>
            )}
          </ul>
        </section>

        <section className="gls-admin-card rounded-xl p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200">
            Trials ending ≤3d
          </h2>
          <ul className="mt-4 space-y-2">
            {data.trialsEnding.slice(0, 6).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-sm"
              >
                <span className="truncate text-white">{t.email || t.id}</span>
                <span className="text-[11px] text-gls-muted">
                  {t.trial_ends_at
                    ? new Date(t.trial_ends_at).toLocaleDateString()
                    : "—"}
                </span>
              </li>
            ))}
            {!data.trialsEnding.length && (
              <p className="py-6 text-center text-sm text-gls-muted">None soon</p>
            )}
          </ul>
          <Link
            href="/admin/finance/reminders"
            className="mt-4 inline-block text-xs font-semibold text-gls-pink hover:text-gls-pink-soft"
          >
            Nudge trials →
          </Link>
        </section>

        <section className="gls-admin-card rounded-xl p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-200">
            Stream health
          </h2>
          <ul className="mt-4 space-y-2">
            {data.channelHealth.slice(0, 6).map((c) => (
              <li
                key={c.slug}
                className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="truncate text-white">{c.title || c.slug}</span>
                  <span
                    className={`ml-2 text-[11px] uppercase ${
                      c.health_status === "dead" ? "text-red-300" : "text-amber-200"
                    }`}
                  >
                    {c.health_status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded border border-red-400/40 px-2 py-1 text-[10px] text-red-200"
                    onClick={() =>
                      void fetch("/api/admin/ops/channel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "quarantine", slug: c.slug }),
                      }).then(() => load())
                    }
                  >
                    Quarantine
                  </button>
                  <button
                    type="button"
                    className="rounded border border-white/20 px-2 py-1 text-[10px] text-gls-muted"
                    onClick={() =>
                      void fetch("/api/admin/ops/channel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "recheck", slug: c.slug }),
                      }).then(() => load())
                    }
                  >
                    Recheck
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gls-mint/40 px-2 py-1 text-[10px] text-gls-mint"
                    onClick={() =>
                      void fetch("/api/admin/ops/channel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "restore", slug: c.slug }),
                      }).then(() => load())
                    }
                  >
                    Restore
                  </button>
                </div>
              </li>
            ))}
            {!data.channelHealth.length && (
              <p className="py-6 text-center text-sm text-gls-muted">Healthy</p>
            )}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="gls-admin-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-muted">
              Cron journal
            </h2>
            <Link href="/admin/audit" className="text-xs text-gls-muted hover:text-white">
              Full audit →
            </Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {data.cronRuns.map((r, i) => (
              <li key={`${r.job}-${r.started_at}-${i}`} className="flex justify-between gap-3">
                <span className="text-white">
                  {r.job}{" "}
                  <span
                    className={
                      r.status === "ok" ? "text-emerald-300" : "text-amber-200"
                    }
                  >
                    {r.status}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-gls-muted">
                  {new Date(r.started_at).toLocaleString()}
                </span>
              </li>
            ))}
            {!data.cronRuns.length && (
              <p className="text-gls-muted">No cron runs recorded yet</p>
            )}
          </ul>
        </section>

        <section className="gls-admin-card rounded-xl p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-muted">
            Recent admin actions
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {data.recentAudit.map((a, i) => (
              <li key={`${a.action}-${a.created_at}-${i}`}>
                <p className="text-white">{a.summary || a.action}</p>
                <p className="text-[11px] text-gls-muted">
                  {a.actor_email || "system"} ·{" "}
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </li>
            ))}
            {!data.recentAudit.length && (
              <p className="text-gls-muted">Audit log empty — actions will land here</p>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

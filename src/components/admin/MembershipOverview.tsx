"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { MembershipBucket } from "@/lib/membership/admin-metrics";
import { MEMBERSHIP_BUCKET_LABELS } from "@/lib/membership/admin-metrics";

type OverviewMember = {
  id: string;
  email: string | null;
  display_name: string | null;
  member_reference: string;
  plan: string;
  is_premium: boolean;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  created_at: string | null;
  payment_count: number;
  bucket: Exclude<MembershipBucket, "all">;
  subscription: {
    status: string | null;
    current_period_end: string | null;
    provider: string | null;
    plan: string | null;
  } | null;
};

type OverviewResponse = {
  generatedAt: string;
  summary: {
    allUsers: number;
    subscribed: number;
    trial: number;
    neverSubscribed: number;
    lapsed: number;
    signups30d: number;
    exceptions: number;
  };
  byPlan: Record<string, number>;
  bucket: MembershipBucket;
  members: OverviewMember[];
  memberTotal: number;
  definitions: Record<string, string>;
};

const BUCKET_CARDS: Array<{
  key: MembershipBucket;
  label: string;
  hint: string;
  tone: string;
  summaryKey: keyof OverviewResponse["summary"];
}> = [
  {
    key: "all",
    label: "All users",
    hint: "Registered profiles",
    tone: "#ff6b6b",
    summaryKey: "allUsers",
  },
  {
    key: "subscribed",
    label: "Subscribed",
    hint: "Active paid membership",
    tone: "#5ee29a",
    summaryKey: "subscribed",
  },
  {
    key: "trial",
    label: "On 14-day trial",
    hint: "Trial window, not paid",
    tone: "#f5c542",
    summaryKey: "trial",
  },
  {
    key: "never_subscribed",
    label: "Never subscribed",
    hint: "No paid receipts on file",
    tone: "#ff8a96",
    summaryKey: "neverSubscribed",
  },
];

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MembershipOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<MembershipBucket>("all");

  const load = useCallback(async (nextBucket: MembershipBucket) => {
    setError(null);
    const res = await fetch(
      `/api/admin/membership-overview?bucket=${nextBucket}&limit=80`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as OverviewResponse & { error?: string };
    if (!res.ok) {
      setError(json.error || "Failed to load membership overview");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch("/api/admin/membership-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "audit_view" }),
      });
      void load(bucket);
    }, 0);
    return () => clearTimeout(timer);
  }, [bucket, load]);

  const conversion = useMemo(() => {
    if (!data?.summary.allUsers) return 0;
    return Math.round(
      (data.summary.subscribed / data.summary.allUsers) * 100,
    );
  }, [data]);

  const exportCsv = (target: MembershipBucket | "overview") => {
    window.location.assign(
      `/api/admin/finance-export?type=membership&bucket=${target}`,
    );
  };

  const openPdf = () => {
    window.open("/admin/finance/membership/print", "_blank", "noopener,noreferrer");
  };

  if (error) {
    return <p className="text-sm text-gls-red">{error}</p>;
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <div className="gls-buffer-ring" />
      </div>
    );
  }

  const nav = (
    <>
      {[
        ["/admin/finance", "Finance"],
        ["/admin/finance/members", "Member ledger"],
        ["/admin/finance/reports", "Revenue reports"],
        ["/admin/users", "Users"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gls-muted hover:text-white"
        >
          {label}
        </Link>
      ))}
    </>
  );

  return (
    <div>
      <AdminPageHeader
        eyebrow="Membership"
        title="User funnel"
        description="Growth snapshot for profiles, active subscribers, live trials, and users who have never paid."
        actions={nav}
      />

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => exportCsv("overview")}
          className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gls-body hover:text-white"
        >
          Export overview CSV
        </button>
        <button
          type="button"
          onClick={() => exportCsv(bucket)}
          className="rounded-md border border-gls-red/40 bg-gls-red/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-100 hover:text-white"
        >
          Export {MEMBERSHIP_BUCKET_LABELS[bucket]} CSV
        </button>
        <button
          type="button"
          onClick={openPdf}
          className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gls-body hover:text-white"
        >
          Download PDF
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {BUCKET_CARDS.map((card) => {
          const active = bucket === card.key;
          const value = data.summary[card.summaryKey];
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setBucket(card.key)}
              className={`gls-admin-card rounded-xl p-5 text-left transition ${
                active ? "ring-1 ring-gls-red/60" : "hover:border-white/20"
              }`}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.28em]"
                style={{ color: card.tone }}
              >
                {card.label}
              </p>
              <p className="gls-display mt-3 text-4xl text-white">{value}</p>
              <p className="mt-1 text-xs text-gls-muted">{card.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="gls-admin-card rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-muted">
            Paid conversion
          </p>
          <p className="gls-display mt-2 text-3xl text-white">{conversion}%</p>
          <p className="mt-1 text-xs text-gls-muted">
            Subscribed ÷ all users
          </p>
        </div>
        <div className="gls-admin-card rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-muted">
            Signups (30d)
          </p>
          <p className="gls-display mt-2 text-3xl text-white">
            {data.summary.signups30d}
          </p>
          <p className="mt-1 text-xs text-gls-muted">New profiles this month</p>
        </div>
        <div className="gls-admin-card rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-muted">
            Lapsed / churned
          </p>
          <p className="gls-display mt-2 text-3xl text-white">
            {data.summary.lapsed}
          </p>
          <p className="mt-1 text-xs text-gls-muted">
            Paid before, not active now
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
            Metric definitions
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["All users", data.definitions.allUsers],
              ["Subscribed", data.definitions.subscribed],
              ["Trial", data.definitions.trial],
              ["Never subscribed", data.definitions.neverSubscribed],
              ["Lapsed", data.definitions.lapsed],
            ].map(([term, definition]) => (
              <div key={term}>
                <dt className="font-semibold text-white">{term}</dt>
                <dd className="mt-0.5 text-gls-muted">{definition}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] text-gls-muted">
            Generated {new Date(data.generatedAt).toLocaleString("en-ZA")}
          </p>
        </section>

        <section className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-gold">
            By plan
          </p>
          <div className="mt-4 space-y-2">
            {Object.entries(data.byPlan)
              .sort((a, b) => b[1] - a[1])
              .map(([plan, count]) => (
                <div
                  key={plan}
                  className="flex items-center justify-between rounded-lg border border-white/[0.07] px-3 py-2.5 text-sm"
                >
                  <span className="font-mono text-gls-body">{plan}</span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section className="gls-admin-card mt-8 overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink-soft">
              {MEMBERSHIP_BUCKET_LABELS[bucket]}
            </p>
            <p className="mt-1 text-sm text-gls-muted">
              Showing {data.members.length} of {data.memberTotal} members
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportCsv(bucket)}
            className="rounded-md border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gls-body hover:text-white"
          >
            Export list
          </button>
        </div>
        <div className="gls-h-scroll">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Member</th>
                <th className="px-4 py-3 font-bold">Plan</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Trial ends</th>
                <th className="px-4 py-3 font-bold">Payments</th>
                <th className="px-4 py-3 font-bold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => {
                const active =
                  member.is_premium &&
                  member.subscription?.status === "active";
                return (
                  <tr
                    key={member.id}
                    className="border-t border-white/[0.06] hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {member.display_name || member.email || "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-gls-muted">
                        {member.member_reference}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gls-body">
                      {member.plan}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          active
                            ? "bg-emerald-500/15 text-emerald-200"
                            : member.trial_ends_at &&
                                new Date(member.trial_ends_at).getTime() > Date.now()
                              ? "bg-amber-500/15 text-amber-100"
                              : "bg-white/10 text-gls-muted"
                        }`}
                      >
                        {active
                          ? "Subscribed"
                          : member.trial_ends_at &&
                              new Date(member.trial_ends_at).getTime() > Date.now()
                            ? "Trial"
                            : member.payment_count > 0
                              ? "Lapsed"
                              : "Free"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gls-muted">
                      {fmtDate(member.trial_ends_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-white">
                      {member.payment_count}
                    </td>
                    <td className="px-4 py-3 text-xs text-gls-muted">
                      {fmtDate(member.created_at)}
                    </td>
                  </tr>
                );
              })}
              {!data.members.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-gls-muted"
                  >
                    No members in this bucket.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

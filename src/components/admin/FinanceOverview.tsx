"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Report = {
  summary: {
    totalRevenueZarCents: number;
    revenue30dZarCents: number;
    receiptCount: number;
    uniquePayingMembers: number;
    activeMembers: number;
    renewals: number;
    renewalRate: number;
    pending: number;
    rejected: number;
    refunded: number;
  };
  byMethod: Record<string, { count: number; cents: number }>;
  receipts: Array<{
    id: string;
    receipt_number: string;
    customer_email: string | null;
    member_reference: string;
    amount_zar_cents: number;
    payment_method: string;
  }>;
};

function money(cents: number) {
  return `R${((cents || 0) / 100).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  })}`;
}

export function FinanceOverview() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/manual-billing?view=reports", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load finance");
      return;
    }
    setData(json);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (error) return <p className="text-sm text-gls-red">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <div className="gls-buffer-ring" />
      </div>
    );
  }
  const s = data.summary;
  const cards = [
    ["Revenue 30d", money(s.revenue30dZarCents), "Verified Yoco + EFT", "#5ee29a"],
    ["Total revenue", money(s.totalRevenueZarCents), `${s.receiptCount} receipts`, "#ff6b9d"],
    ["Active members", String(s.activeMembers), `${s.uniquePayingMembers} paid`, "#7ec8ff"],
    ["Needs review", String(s.pending), "Payment queue", "#f5c542"],
    ["Renewals", String(s.renewals), `${s.renewalRate}% rate`, "#a8c4ff"],
    ["Refunds", String(s.refunded), `${s.rejected} rejected`, "#ff8a96"],
  ];
  const links = [
    ["/admin/finance/payments", "Payment queue", `${s.pending} need workflow`],
    ["/admin/finance/membership", "User funnel", "Trials, subscribers & growth"],
    ["/admin/finance/members", "Member ledger", "GLS references & reactivation"],
    ["/admin/finance/reconciliation", "Reconciliation", "GLS paid vs Yoco links"],
    ["/admin/finance/reports", "Reports", "Revenue, plans, CSV export"],
    ["/admin/finance/receipts", "Receipts", "Print / PDF / refund trail"],
    ["/admin/finance/settings", "Payment settings", "Yoco, EFT and receipt copy"],
    ["/admin/finance/reminders", "Reminders", "Trial and renewal nudges"],
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Revenue"
        title="Finance"
        description="Launch billing in ZAR — Yoco/QR, verified EFT, member references, 30-day reactivation and receipts."
        actions={
          <span className="gls-admin-pill bg-emerald-500/15 text-emerald-200">
            Manual billing live
          </span>
        }
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, hint, tone]) => (
          <div key={label} className="gls-admin-card rounded-xl p-5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{ color: tone }}
            >
              {label}
            </p>
            <p className="gls-display mt-3 text-4xl text-white">{value}</p>
            <p className="mt-1 text-xs text-gls-muted">{hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {links.map(([href, title, desc]) => (
          <Link
            key={href}
            href={href}
            className="gls-admin-card flex items-center justify-between rounded-xl px-5 py-4"
          >
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-gls-muted">{desc}</p>
            </div>
            <span className="text-gls-pink">→</span>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
            Recent receipts
          </p>
          <div className="mt-4 space-y-2">
            {data.receipts.slice(0, 7).map((receipt) => (
              <Link
                key={receipt.id}
                href={`/receipts/${receipt.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.07] px-3 py-2.5 hover:border-gls-pink/30"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-white">
                    {receipt.receipt_number}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gls-muted">
                    {receipt.customer_email || receipt.member_reference} ·{" "}
                    {receipt.payment_method}
                  </p>
                </div>
                <p className="font-semibold text-emerald-200">
                  {money(receipt.amount_zar_cents)}
                </p>
              </Link>
            ))}
            {!data.receipts.length && (
              <p className="py-8 text-center text-sm text-gls-muted">
                No receipts yet. Approve a payment to issue the first.
              </p>
            )}
          </div>
        </section>
        <section className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-gold">
            Payment mix
          </p>
          <div className="mt-4 space-y-2">
            {Object.entries(data.byMethod).map(([method, value]) => (
              <div
                key={method}
                className="flex justify-between rounded-lg border border-white/[0.07] px-3 py-2.5 text-sm"
              >
                <span className="capitalize text-gls-body">{method}</span>
                <span className="font-semibold text-white">
                  {value.count} · {money(value.cents)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

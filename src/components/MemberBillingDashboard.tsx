"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrowseNav } from "@/components/BrowseNav";

type BillingData = {
  member: {
    memberReference: string;
    email: string | null;
    displayName: string | null;
  };
  payments: Array<{
    id: string;
    payment_reference: string;
    plan: string;
    amount_zar_cents: number;
    payment_method: string;
    status: string;
    created_at: string;
    membership_ends_at: string | null;
  }>;
  receipts: Array<{
    id: string;
    receipt_number: string;
    amount_zar_cents: number;
    plan: string;
    issued_at: string;
    membership_ends_at: string;
    refunded_at: string | null;
  }>;
};

function planName(plan: string) {
  if (plan === "gls_65") return "Plus";
  if (plan === "gls_75") return "Family";
  return "Standard";
}

export function MemberBillingDashboard() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing/manual", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not load billing");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <>
      <BrowseNav />
      <main className="min-h-screen bg-gls-black px-4 pb-24 pt-28 text-white sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="gls-eyebrow">Your account</p>
              <h1 className="gls-display mt-2 text-5xl">Membership & receipts</h1>
              <p className="mt-2 text-sm text-gls-muted">
                30-day renewals, payment status and printable receipts.
              </p>
            </div>
            <Link
              href="/pricing"
              className="gls-cta rounded-md px-5 py-2.5 text-sm"
            >
              Renew / choose plan
            </Link>
          </div>

          {error && (
            <p className="mt-8 rounded-xl border border-gls-red/30 bg-gls-red/10 p-4 text-red-200">
              {error}
            </p>
          )}
          {!data && !error && (
            <div className="flex justify-center py-24">
              <div className="gls-buffer-ring" />
            </div>
          )}
          {data && (
            <>
              <div className="gls-glass mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-muted">
                    Permanent member reference
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-gls-pink-soft">
                    {data.member.memberReference}
                  </p>
                  <p className="mt-1 text-xs text-gls-muted">
                    Use this to find your account during future reactivations.
                  </p>
                </div>
                <p className="text-sm text-gls-body">
                  {data.member.email || data.member.displayName}
                </p>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <section className="gls-glass rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-pink-soft">
                    Payment requests
                  </h2>
                  <div className="mt-4 space-y-2">
                    {data.payments.map((payment) => (
                      <Link
                        key={payment.id}
                        href={`/pricing/pay/${payment.id}`}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 hover:border-gls-pink/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-white">
                            {payment.payment_reference}
                          </p>
                          <p className="mt-1 text-[11px] text-gls-muted">
                            {planName(payment.plan)} · {payment.payment_method} ·{" "}
                            {new Date(payment.created_at).toLocaleDateString(
                              "en-ZA",
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">
                            R{(payment.amount_zar_cents / 100).toFixed(0)}
                          </p>
                          <p className="text-[10px] uppercase text-gls-pink-soft">
                            {payment.status.replace("_", " ")}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {!data.payments.length && (
                      <p className="py-10 text-center text-sm text-gls-muted">
                        No payment requests yet.
                      </p>
                    )}
                  </div>
                </section>

                <section className="gls-glass rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
                    Receipts
                  </h2>
                  <div className="mt-4 space-y-2">
                    {data.receipts.map((receipt) => (
                      <Link
                        key={receipt.id}
                        href={`/receipts/${receipt.id}`}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 hover:border-emerald-500/30"
                      >
                        <div>
                          <p className="font-mono text-xs text-white">
                            {receipt.receipt_number}
                          </p>
                          <p className="mt-1 text-[11px] text-gls-muted">
                            {new Date(receipt.issued_at).toLocaleDateString(
                              "en-ZA",
                            )}{" "}
                            · ends{" "}
                            {new Date(
                              receipt.membership_ends_at,
                            ).toLocaleDateString("en-ZA")}
                          </p>
                        </div>
                        <p
                          className={`font-semibold ${
                            receipt.refunded_at
                              ? "text-violet-200 line-through"
                              : "text-emerald-200"
                          }`}
                        >
                          R{(receipt.amount_zar_cents / 100).toFixed(0)}
                        </p>
                      </Link>
                    ))}
                    {!data.receipts.length && (
                      <p className="py-10 text-center text-sm text-gls-muted">
                        Receipts appear after payment verification.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

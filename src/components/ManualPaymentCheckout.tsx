"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlsLogo } from "@/components/GlsLogo";
import {
  buildDebitOrderQuote,
  formatZarFromCents,
  PAYFAST_DEBIT_DAYS,
  type PayfastDebitDay,
} from "@/lib/payfast-debit";

type PayfastCheckout = {
  actionUrl: string;
  fields: Record<string, string>;
};

type Payment = {
  id: string;
  member_reference: string;
  payment_reference: string;
  plan: string;
  amount_zar_cents: number;
  recurring_amount_cents: number | null;
  billing_kind: string;
  debit_day: number | null;
  payment_method: string;
  status: string;
  yoco_payment_url: string | null;
  qrCode: string | null;
  payfast: PayfastCheckout | null;
  proof_reference: string | null;
  submitted_at: string | null;
  membership_ends_at: string | null;
  expires_at: string;
  dunning_fee_cents?: number | null;
  dunning_pause_at?: string | null;
};

type Settings = {
  trading_name: string;
  support_email: string | null;
  yoco_enabled: boolean;
  yoco_ready: boolean;
  payfast_enabled: boolean;
  payfast_ready: boolean;
  eft_enabled: boolean;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: string | null;
  payment_note: string;
};

type Receipt = {
  id: string;
  receipt_number: string;
  payment_request_id: string;
};

type CheckoutMethod = "payfast" | "yoco" | "eft";

const STATUS_STEPS = [
  "pending",
  "proof_submitted",
  "verifying",
  "paid",
] as const;

function planName(plan: string) {
  if (plan === "gls_65") return "Plus";
  if (plan === "gls_75") return "Family";
  return "Standard";
}

function statusLabel(status: string) {
  if (status === "proof_submitted") return "Proof submitted";
  if (status === "paid") return "Activated";
  if (status === "verifying") return "Verifying";
  if (status === "rejected") return "Needs attention";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function defaultMethod(settings: Settings, payment: Payment): CheckoutMethod {
  if (payment.payment_method === "eft") return "eft";
  if (payment.payment_method === "payfast" && settings.payfast_ready)
    return "payfast";
  if (settings.payfast_ready) return "payfast";
  if (payment.payment_method === "yoco" && settings.yoco_ready) return "yoco";
  if (settings.yoco_ready) return "yoco";
  return "eft";
}

function monthlyCentsForPayment(payment: Payment) {
  return payment.recurring_amount_cents ?? payment.amount_zar_cents;
}

function postToPayfast(checkout: PayfastCheckout) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkout.actionUrl;
  form.style.display = "none";
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function ManualPaymentCheckout({ paymentId }: { paymentId: string }) {
  const searchParams = useSearchParams();
  const payfastReturn = searchParams.get("payfast");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [method, setMethod] = useState<CheckoutMethod>("eft");
  const [debitDay, setDebitDay] = useState<PayfastDebitDay>(15);
  const [proofReference, setProofReference] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/billing/manual?id=${paymentId}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not load payment");
      return;
    }
    const nextPayment = (json.payment || null) as Payment | null;
    const nextSettings = (json.settings || null) as Settings | null;
    setPayment(nextPayment);
    setSettings(nextSettings);
    setReceipts(json.receipts || []);
    if (nextPayment && nextSettings) {
      if (
        nextPayment.debit_day &&
        PAYFAST_DEBIT_DAYS.includes(nextPayment.debit_day as PayfastDebitDay)
      ) {
        setDebitDay(nextPayment.debit_day as PayfastDebitDay);
      }
      setMethod((prev) => {
        if (
          (prev === "payfast" && nextSettings.payfast_ready) ||
          (prev === "yoco" && nextSettings.yoco_ready) ||
          (prev === "eft" && nextSettings.eft_enabled)
        ) {
          return prev;
        }
        return defaultMethod(nextSettings, nextPayment);
      });
    }
  }, [paymentId]);

  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 12_000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (payfastReturn === "return") {
      setMessage(
        "Returned from PayFast. We’re confirming payment — membership unlocks automatically and you’ll see it in account notifications.",
      );
    } else if (payfastReturn === "cancel") {
      setMessage(
        "PayFast checkout was canceled. You can try again or pay by EFT with the exact reference.",
      );
    }
  }, [payfastReturn]);

  const receipt = useMemo(
    () => receipts.find((r) => r.payment_request_id === paymentId),
    [receipts, paymentId],
  );

  const copy = async (label: string, value: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1400);
  };

  const debitQuote = useMemo(() => {
    if (!payment) return null;
    return buildDebitOrderQuote({
      monthlyCents: monthlyCentsForPayment(payment),
      debitDay,
    });
  }, [payment, debitDay]);

  const startPayfast = async () => {
    if (!payment) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/billing/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_payfast", paymentId, debitDay }),
    });
    const json = await res.json();
    if (!res.ok || !json.payfast) {
      setBusy(false);
      setError(json.error || "Could not start PayFast checkout");
      return;
    }
    postToPayfast(json.payfast as PayfastCheckout);
  };

  const submit = async () => {
    if (!payment) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/billing/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit_proof",
        paymentId,
        paymentMethod: method,
        proofReference,
        proofNote,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not submit payment");
      return;
    }
    setMessage(
      "Submitted. Watch the notification bell — verification updates are in-app only for now.",
    );
    void load();
  };

  if (error && !payment) {
    return (
      <main className="min-h-screen bg-gls-black px-6 py-12 text-white">
        <div className="mx-auto max-w-xl">
          <GlsLogo size="md" href="/pricing" glass />
          <p className="mt-10 rounded-xl border border-gls-red/30 bg-gls-red/10 p-5 text-red-100">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!payment || !settings) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gls-black">
        <div className="gls-buffer-ring" />
      </main>
    );
  }

  const paid = payment.status === "paid";
  const unavailable = ["canceled", "expired", "refunded"].includes(
    payment.status,
  );
  const currentStep = paid
    ? 3
    : Math.max(
        0,
        STATUS_STEPS.indexOf(
          payment.status as (typeof STATUS_STEPS)[number],
        ),
      );
  const showPayfast = settings.payfast_ready;
  const showYoco = settings.yoco_enabled && settings.yoco_ready;
  const showEft = settings.eft_enabled;
  const displayCents =
    payment.billing_kind === "outstanding"
      ? payment.amount_zar_cents
      : method === "payfast" && debitQuote
        ? debitQuote.amountCents
        : payment.amount_zar_cents;
  const isOutstanding = payment.billing_kind === "outstanding";

  return (
    <main className="min-h-screen bg-gls-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <GlsLogo size="md" href="/pricing" glass />
          <Link
            href="/pricing"
            className="rounded-md border border-white/15 px-4 py-2 text-xs text-gls-body hover:border-white/30 hover:text-white"
          >
            Back to plans
          </Link>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
          <section className="gls-glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gls-pink/20 blur-3xl" />
            <div className="relative">
              <p className="gls-eyebrow">30-day membership</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="gls-display text-5xl">
                    {planName(payment.plan)}
                  </h1>
                  <p className="mt-1 text-sm text-gls-muted">
                    {method === "payfast" && showPayfast
                      ? "Monthly debit order · cancel anytime in account"
                      : "No automatic debit · renew when you choose"}
                  </p>
                  <p className="mt-2 text-xs text-gls-muted">
                    By paying, you accept the{" "}
                    <Link href="/legal#terms" className="text-white underline">
                      Terms
                    </Link>
                    ,{" "}
                    <Link href="/legal#privacy" className="text-white underline">
                      Privacy notice
                    </Link>{" "}
                    and{" "}
                    <Link href="/legal#payments" className="text-white underline">
                      refund/cancellation policy
                    </Link>
                    .
                  </p>
                </div>
                <p className="gls-display text-5xl text-gls-pink-soft">
                  R{(displayCents / 100).toFixed(2)}
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void copy("payment", payment.payment_reference)
                  }
                  className="rounded-xl border border-white/10 bg-black/35 p-4 text-left transition hover:border-gls-pink/40"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gls-muted">
                    Payment reference
                  </p>
                  <p className="mt-2 font-mono text-lg font-semibold text-white">
                    {payment.payment_reference}
                  </p>
                  <p className="mt-1 text-[11px] text-gls-pink-soft">
                    {copied === "payment" ? "Copied" : "Tap to copy"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void copy("member", payment.member_reference)}
                  className="rounded-xl border border-white/10 bg-black/35 p-4 text-left transition hover:border-white/25"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gls-muted">
                    Member reference
                  </p>
                  <p className="mt-2 font-mono text-lg font-semibold text-white">
                    {payment.member_reference}
                  </p>
                  <p className="mt-1 text-[11px] text-gls-muted">
                    {copied === "member" ? "Copied" : "Keep for renewals"}
                  </p>
                </button>
              </div>

              <div className="mt-7">
                <div className="flex justify-between gap-2">
                  {STATUS_STEPS.map((step, index) => (
                    <div key={step} className="min-w-0 flex-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          index <= currentStep
                            ? "bg-gradient-to-r from-gls-red to-gls-pink"
                            : "bg-white/10"
                        }`}
                      />
                      <p
                        className={`mt-2 truncate text-[9px] font-bold uppercase tracking-wider ${
                          index <= currentStep
                            ? "text-white"
                            : "text-gls-muted"
                        }`}
                      >
                        {statusLabel(step)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {paid ? (
                <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <p className="text-lg font-semibold text-emerald-200">
                    Membership active
                  </p>
                  <p className="mt-1 text-sm text-gls-body">
                    Access runs until{" "}
                    {payment.membership_ends_at
                      ? new Date(payment.membership_ends_at).toLocaleDateString(
                          "en-ZA",
                          { dateStyle: "long" },
                        )
                      : "the end of your paid period"}
                    .
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/browse"
                      className="gls-cta rounded-md px-5 py-2.5 text-sm"
                    >
                      Start watching
                    </Link>
                    {receipt && (
                      <Link
                        href={`/receipts/${receipt.id}`}
                        className="rounded-md border border-white/20 px-5 py-2.5 text-sm text-white"
                      >
                        View receipt
                      </Link>
                    )}
                  </div>
                </div>
              ) : unavailable ? (
                <div className="mt-8 rounded-xl border border-gls-red/30 bg-gls-red/10 p-5">
                  <p className="font-semibold text-red-100">
                    This request is {payment.status}.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-3 inline-block text-sm font-semibold text-gls-pink-soft"
                  >
                    Create a new payment →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-8 flex flex-wrap rounded-xl border border-white/10 bg-black/40 p-1">
                    {showPayfast && (
                      <button
                        type="button"
                        onClick={() => setMethod("payfast")}
                        className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                          method === "payfast"
                            ? "bg-white text-black"
                            : "text-gls-muted hover:text-white"
                        }`}
                      >
                        Card (PayFast debit)
                      </button>
                    )}
                    {showYoco && (
                      <button
                        type="button"
                        onClick={() => setMethod("yoco")}
                        disabled={!payment.yoco_payment_url}
                        className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                          method === "yoco"
                            ? "bg-white text-black"
                            : "text-gls-muted hover:text-white"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        QR link (legacy)
                      </button>
                    )}
                    {showEft && (
                      <button
                        type="button"
                        onClick={() => setMethod("eft")}
                        className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                          method === "eft"
                            ? "bg-white text-black"
                            : "text-gls-muted hover:text-white"
                        }`}
                      >
                        EFT
                      </button>
                    )}
                  </div>

                  {method === "payfast" && showPayfast ? (
                    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                      {isOutstanding ? (
                        <>
                          <p className="font-semibold text-white">
                            Pay outstanding for this month
                          </p>
                          <p className="mt-2 text-sm text-gls-body">
                            Your monthly card debit did not succeed. Pay{" "}
                            <span className="font-semibold text-white">
                              {formatZarFromCents(payment.amount_zar_cents)}
                            </span>{" "}
                            now (plan
                            {payment.dunning_fee_cents
                              ? ` + ${formatZarFromCents(payment.dunning_fee_cents)} fee`
                              : " + 3% fee"}
                            ) to keep access. Access pauses on day 5 if still
                            unpaid
                            {payment.dunning_pause_at
                              ? ` (${new Date(payment.dunning_pause_at).toLocaleDateString("en-ZA")})`
                              : ""}
                            .
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void startPayfast()}
                            className="gls-cta mt-5 w-full rounded-md px-5 py-3 text-sm disabled:opacity-40"
                          >
                            {busy
                              ? "Opening PayFast…"
                              : "Click here and pay outstanding"}
                          </button>
                        </>
                      ) : (
                        <>
                      <p className="font-semibold text-white">
                        Monthly debit order via PayFast
                      </p>
                      <p className="mt-2 text-sm text-gls-body">
                        Choose the day each month your card is debited. You pay
                        a prorata amount today for access until that date, then
                        the full plan amount on your chosen day every month.
                      </p>
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gls-muted">
                          Debit day
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {PAYFAST_DEBIT_DAYS.map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setDebitDay(day)}
                              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                                debitDay === day
                                  ? "border-gls-pink bg-gls-pink/15 text-white"
                                  : "border-white/15 text-gls-muted hover:border-white/30 hover:text-white"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                      {debitQuote && (
                        <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-gls-body">
                          <p className="font-semibold text-white">
                            {debitQuote.summary}
                          </p>
                          <p className="mt-1 text-xs text-gls-muted">
                            First full debit on{" "}
                            {new Date(
                              `${debitQuote.billingDateIso}T12:00:00Z`,
                            ).toLocaleDateString("en-ZA", { dateStyle: "long" })}
                            .
                          </p>
                        </div>
                      )}
                      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gls-body">
                        <li>Tap below — you leave GLS for PayFast’s secure page.</li>
                        <li>Add your card and confirm the debit order setup.</li>
                        <li>
                          Membership unlocks when PayFast confirms (watch the
                          notification bell).
                        </li>
                      </ol>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startPayfast()}
                        className="gls-cta mt-5 w-full rounded-md px-5 py-3 text-sm disabled:opacity-40"
                      >
                        {busy
                          ? "Opening PayFast…"
                          : "Add card & start debit order"}
                      </button>
                        </>
                      )}
                      <p className="mt-3 text-xs text-gls-muted">
                        Reference {payment.payment_reference} is attached
                        automatically. Status updates are in-app only for now.
                      </p>
                    </div>
                  ) : method === "yoco" && payment.yoco_payment_url ? (
                    <div className="mt-5 flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
                      {payment.qrCode && (
                        <div className="rounded-2xl bg-white p-3 shadow-2xl">
                          <Image
                            src={payment.qrCode}
                            alt="Scan to pay with payment link"
                            width={220}
                            height={220}
                            unoptimized
                          />
                        </div>
                      )}
                      <p className="mt-4 font-semibold text-white">
                        Scan or open secure payment link
                      </p>
                      <p className="mt-1 text-xs text-gls-muted">
                        The amount and GLS reference are attached to this request.
                      </p>
                      <a
                        href={payment.yoco_payment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="gls-cta mt-4 w-full rounded-md px-5 py-3 text-sm"
                      >
                        Pay R{(payment.amount_zar_cents / 100).toFixed(0)} via payment link
                      </a>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-pink-soft">
                        EFT steps
                      </p>
                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gls-body">
                        <li>Copy the exact payment reference above.</li>
                        <li>Transfer the exact amount to the account below.</li>
                        <li>Submit your bank reference for verification.</li>
                      </ol>
                      {settings.bank_name &&
                      settings.account_holder &&
                      settings.account_number ? (
                        <dl className="mt-4 space-y-3 text-sm">
                          {[
                            ["Bank", settings.bank_name],
                            ["Account holder", settings.account_holder],
                            ["Account number", settings.account_number],
                            ["Branch code", settings.branch_code],
                            ["Account type", settings.account_type],
                            ["Reference", payment.payment_reference],
                          ].map(
                            ([label, value]) =>
                              value && (
                                <div
                                  key={label}
                                  className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-2"
                                >
                                  <dt className="text-gls-muted">{label}</dt>
                                  <dd className="text-right font-mono text-white">
                                    {value}
                                  </dd>
                                </div>
                              ),
                          )}
                        </dl>
                      ) : (
                        <p className="mt-3 text-sm text-amber-100">
                          EFT details are being configured. Use PayFast or
                          contact support.
                        </p>
                      )}
                    </div>
                  )}

                  {method !== "payfast" && (
                    <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-5">
                      <p className="font-semibold text-white">
                        Already paid? Submit for verification
                      </p>
                      <p className="mt-1 text-xs text-gls-muted">
                        We verify against the provider or bank statement. Updates
                        appear in account notifications (in-app).
                      </p>
                      <input
                        className="gls-admin-input mt-4"
                        value={proofReference}
                        onChange={(e) => setProofReference(e.target.value)}
                        placeholder={
                          method === "eft"
                            ? "Bank transaction / proof reference"
                            : "Transaction reference (optional)"
                        }
                      />
                      <textarea
                        className="gls-admin-input mt-2 min-h-[80px]"
                        value={proofNote}
                        onChange={(e) => setProofNote(e.target.value)}
                        placeholder="Payment note (optional)"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submit()}
                        className="mt-3 w-full rounded-md border border-gls-pink/40 bg-gls-pink/10 px-5 py-3 text-sm font-semibold text-white hover:bg-gls-pink/20 disabled:opacity-40"
                      >
                        {busy
                          ? "Submitting…"
                          : "I’ve paid — submit for verification"}
                      </button>
                    </div>
                  )}
                  {message && (
                    <p className="mt-3 text-sm text-emerald-200">{message}</p>
                  )}
                  {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
                </>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="gls-glass rounded-2xl p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-muted">
                Payment status
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${
                    paid
                      ? "bg-emerald-400 shadow-[0_0_16px_#34d399]"
                      : payment.status === "rejected"
                        ? "bg-red-400"
                        : "bg-amber-300 shadow-[0_0_14px_#fcd34d]"
                  }`}
                />
                <p className="text-xl font-semibold text-white">
                  {statusLabel(payment.status)}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gls-body">
                {paid
                  ? "Verified and activated. Your receipt is ready."
                  : payment.status === "proof_submitted" ||
                      payment.status === "verifying"
                    ? "Your payment is being confirmed. Watch the notification bell for unlock."
                    : settings.payment_note}
              </p>
              {!paid && (
                <p className="mt-4 text-xs text-gls-muted">
                  Request expires{" "}
                  {new Date(payment.expires_at).toLocaleDateString("en-ZA", {
                    dateStyle: "medium",
                  })}
                </p>
              )}
            </div>

            <div className="gls-glass rounded-2xl p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-muted">
                What happens next
              </p>
              <ol className="mt-4 space-y-4 text-sm text-gls-body">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gls-pink/15 text-xs text-gls-pink-soft">
                    1
                  </span>
                  {showPayfast
                    ? "Set up a PayFast debit order, or pay once by EFT with the exact reference."
                    : "Pay with PayFast or EFT using the exact reference."}
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gls-pink/15 text-xs text-gls-pink-soft">
                    2
                  </span>
                  Return here (PayFast) or submit your bank reference (EFT).
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gls-pink/15 text-xs text-gls-pink-soft">
                    3
                  </span>
                  We activate 30 days and notify you in-app (notification bell).
                </li>
              </ol>
            </div>

            {settings.support_email && (
              <a
                href={`mailto:${settings.support_email}?subject=${encodeURIComponent(payment.payment_reference)}`}
                className="block rounded-xl border border-white/10 px-5 py-4 text-sm text-gls-muted hover:border-white/25 hover:text-white"
              >
                Need help? Email {settings.support_email}
              </a>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

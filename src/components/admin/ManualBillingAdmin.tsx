"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GLS_PLANS } from "@/lib/membership/plans";

type AdminView = "payments" | "members" | "reports" | "receipts" | "settings";

type Payment = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  member_reference: string;
  payment_reference: string;
  plan: string;
  amount_zar_cents: number;
  payment_method: string;
  status: string;
  billing_kind?: string | null;
  debit_day?: number | null;
  next_billing_at?: string | null;
  dunning_fee_cents?: number | null;
  dunning_pause_at?: string | null;
  dunning_opened_at?: string | null;
  proof_reference: string | null;
  proof_note: string | null;
  external_transaction_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type Member = {
  id: string;
  email: string | null;
  display_name: string | null;
  member_reference: string;
  plan: string;
  is_premium: boolean;
  total_paid_zar_cents: number;
  payment_count: number;
  pending_count: number;
  subscription: {
    status: string;
    current_period_end: string | null;
    provider: string;
    plan: string;
    debit_day?: number | null;
    next_billing_at?: string | null;
    debit_status?: string | null;
    dunning_paused_at?: string | null;
  } | null;
};

type Receipt = {
  id: string;
  receipt_number: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  member_reference: string;
  payment_reference: string;
  plan: string;
  amount_zar_cents: number;
  payment_method: string;
  external_transaction_id: string | null;
  issued_at: string;
  membership_ends_at: string;
  refunded_at: string | null;
};

type Reports = {
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
  byPlan: Record<string, { count: number; cents: number }>;
  byMethod: Record<string, { count: number; cents: number }>;
  monthly: Array<{ month: string; count: number; cents: number }>;
  statusCounts: Record<string, number>;
  receipts: Receipt[];
};

type Settings = {
  trading_name: string;
  support_email: string | null;
  yoco_enabled: boolean;
  payfast_enabled: boolean;
  eft_enabled: boolean;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: string | null;
  payment_note: string;
  receipt_footer: string;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-white/10 text-gls-body",
  proof_submitted: "bg-amber-500/15 text-amber-200",
  verifying: "bg-sky-500/15 text-sky-200",
  paid: "bg-emerald-500/15 text-emerald-200",
  rejected: "bg-red-500/15 text-red-200",
  canceled: "bg-white/10 text-gls-muted",
  expired: "bg-white/10 text-gls-muted",
  refunded: "bg-violet-500/15 text-violet-200",
};

const TITLES: Record<AdminView, { eyebrow: string; title: string; desc: string }> = {
  payments: {
    eyebrow: "Finance desk",
    title: "Payment queue",
    desc: "Match PayFast, Yoco or bank transactions, verify references, activate 30 days, and issue receipts.",
  },
  members: {
    eyebrow: "Finance desk",
    title: "Member ledger",
    desc: "Search permanent GLS references, payment history, renewal state, and lifetime value.",
  },
  reports: {
    eyebrow: "Finance desk",
    title: "Reports",
    desc: "Revenue, payment mix, renewals, queue health, and CSV-ready receipt data.",
  },
  receipts: {
    eyebrow: "Finance desk",
    title: "Receipts",
    desc: "Immutable numbered payment receipts with print/PDF views and refund tracking.",
  },
  settings: {
    eyebrow: "Finance desk",
    title: "Payment settings",
    desc: "Configure Yoco visibility, EFT details, trading name, support, and receipt copy.",
  },
};

function money(cents: number) {
  return `R${((cents || 0) / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function planLabel(plan: string) {
  return GLS_PLANS.find((p) => p.id === plan)?.name || plan;
}

function debitDayLabel(day: number | null | undefined) {
  if (day === 1) return "1st";
  if (day === 15) return "15th";
  if (day === 30) return "30th";
  return null;
}

function formatBillingDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-ZA");
}

export function ManualBillingAdmin({
  view,
  initialMember = "",
}: {
  view: AdminView;
  initialMember?: string;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("eft");
  const [recordIdentity, setRecordIdentity] = useState(initialMember);
  const [recordPlan, setRecordPlan] = useState("gls_55");
  const [recordTxn, setRecordTxn] = useState("");
  const [recordMethod, setRecordMethod] = useState("eft");
  const [settingsForm, setSettingsForm] = useState<Settings | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ view, q, status });
    const res = await fetch(`/api/admin/manual-billing?${params}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load finance data");
      return;
    }
    setData(json);
    if (view === "settings") setSettingsForm(json.settings || null);
  }, [view, q, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const action = async (payload: Record<string, unknown>) => {
    setBusy(String(payload.paymentId || payload.receiptId || payload.action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/manual-billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error || "Action failed");
      return null;
    }
    setMessage(
      payload.action === "approve" || payload.action === "record_payment"
        ? `Activated · ${json.receipt?.receipt_number || "receipt issued"}`
        : "Saved",
    );
    setSelected(null);
    setTransactionId("");
    setAdminNote("");
    void load();
    return json;
  };

  const nav = (
    <div className="flex flex-wrap gap-2">
      {[
        ["payments", "Queue"],
        ["members", "Members"],
        ["reports", "Reports"],
        ["receipts", "Receipts"],
        ["settings", "Settings"],
      ].map(([key, label]) => (
        <Link
          key={key}
          href={`/admin/finance/${key}`}
          className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
            view === key
              ? "bg-white text-black"
              : "border border-white/15 text-gls-muted hover:text-white"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
  const copy = TITLES[view];

  return (
    <div>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.desc}
        actions={nav}
      />
      {message && (
        <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-gls-red/30 bg-gls-red/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {view === "payments" && (
        <PaymentsView
          payments={(data?.payments || []) as Payment[]}
          q={q}
          setQ={setQ}
          status={status}
          setStatus={setStatus}
          selected={selected}
          setSelected={(payment) => {
            setSelected(payment);
            setTransactionId(
              payment?.external_transaction_id ||
                payment?.proof_reference ||
                "",
            );
            setPaymentMethod(payment?.payment_method || "eft");
            setAdminNote(payment?.proof_note || "");
          }}
          busy={busy}
          transactionId={transactionId}
          setTransactionId={setTransactionId}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          adminNote={adminNote}
          setAdminNote={setAdminNote}
          approve={() =>
            selected &&
            void action({
              action: "approve",
              paymentId: selected.id,
              transactionId,
              paymentMethod,
              adminNote,
            })
          }
          syncYoco={() =>
            selected &&
            void action({
              action: "sync_yoco",
              paymentId: selected.id,
            })
          }
          syncPayfast={() =>
            void action({
              action: "sync_payfast",
              ...(selected ? { paymentId: selected.id } : {}),
            })
          }
          setPaymentStatus={(next) =>
            selected &&
            void action({
              action: "set_status",
              paymentId: selected.id,
              status: next,
              adminNote,
            })
          }
          record={{
            identity: recordIdentity,
            setIdentity: setRecordIdentity,
            plan: recordPlan,
            setPlan: setRecordPlan,
            transactionId: recordTxn,
            setTransactionId: setRecordTxn,
            method: recordMethod,
            setMethod: setRecordMethod,
            submit: () =>
              void action({
                action: "record_payment",
                identity: recordIdentity,
                plan: recordPlan,
                transactionId: recordTxn,
                paymentMethod: recordMethod,
              }),
          }}
        />
      )}
      {view === "members" && (
        <MembersView
          members={(data?.members || []) as Member[]}
          q={q}
          setQ={setQ}
          onReactivate={(member) => {
            setRecordIdentity(member.member_reference);
            setRecordPlan(
              ["gls_55", "gls_65", "gls_75"].includes(member.plan)
                ? member.plan
                : "gls_55",
            );
            window.location.assign(
              `/admin/finance/payments?member=${encodeURIComponent(member.member_reference)}`,
            );
          }}
        />
      )}
      {view === "reports" && (
        <ReportsView reports={(data || null) as unknown as Reports | null} />
      )}
      {view === "receipts" && (
        <ReceiptsView
          receipts={(data?.receipts || []) as Receipt[]}
          q={q}
          setQ={setQ}
          busy={busy}
          refund={(receipt) => {
            const refundMethod = prompt(
              `Only continue after money was returned outside GLS TV. Enter refund method for ${receipt.receipt_number}: yoco or eft`,
            );
            if (!refundMethod || !["yoco", "eft"].includes(refundMethod.toLowerCase()))
              return;
            const refundReference = prompt(
              "Enter the completed Yoco/EFT refund transaction reference:",
            );
            if (!refundReference) return;
            const note = prompt("Optional internal refund note:") || "";
            if (
              !confirm(
                "Confirm that the money has already been returned through Yoco or EFT. GLS TV only records the completed external refund.",
              )
            )
              return;
            void action({
              action: "refund",
              receiptId: receipt.id,
              note,
              refundMethod: refundMethod.toLowerCase(),
              refundReference,
              confirmExternalRefund: true,
            });
          }}
        />
      )}
      {view === "settings" && settingsForm && (
        <SettingsView
          settings={settingsForm}
          yocoConfigured={Boolean(data?.yocoConfigured)}
          payfastConfigured={Boolean(data?.payfastConfigured)}
          payfastSandbox={Boolean(data?.payfastSandbox)}
          setSettings={setSettingsForm}
          busy={busy}
          save={() =>
            void action({ action: "update_settings", ...settingsForm })
          }
        />
      )}
      {!data && !error && (
        <div className="flex justify-center py-24">
          <div className="gls-buffer-ring" />
        </div>
      )}
    </div>
  );
}

function PaymentsView({
  payments,
  q,
  setQ,
  status,
  setStatus,
  selected,
  setSelected,
  busy,
  transactionId,
  setTransactionId,
  paymentMethod,
  setPaymentMethod,
  adminNote,
  setAdminNote,
  approve,
  syncYoco,
  syncPayfast,
  setPaymentStatus,
  record,
}: {
  payments: Payment[];
  q: string;
  setQ: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  selected: Payment | null;
  setSelected: (payment: Payment | null) => void;
  busy: string | null;
  transactionId: string;
  setTransactionId: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  adminNote: string;
  setAdminNote: (value: string) => void;
  approve: () => void;
  syncYoco: () => void;
  syncPayfast: () => void;
  setPaymentStatus: (status: string) => void;
  record: {
    identity: string;
    setIdentity: (value: string) => void;
    plan: string;
    setPlan: (value: string) => void;
    transactionId: string;
    setTransactionId: (value: string) => void;
    method: string;
    setMethod: (value: string) => void;
    submit: () => void;
  };
}) {
  const [showRecord, setShowRecord] = useState(false);
  const queueCount = payments.filter((p) =>
    ["proof_submitted", "verifying"].includes(p.status),
  ).length;
  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Needs verification", queueCount, "#f5c542"],
          ["Visible rows", payments.length, "#7ec8ff"],
          [
            "Value in view",
            money(payments.reduce((sum, p) => sum + p.amount_zar_cents, 0)),
            "#5ee29a",
          ],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="gls-admin-card rounded-xl p-4">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: String(color) }}
            >
              {label}
            </p>
            <p className="gls-display mt-2 text-3xl text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="gls-admin-card mt-5 flex flex-wrap gap-2 rounded-xl p-3">
        <input
          className="gls-admin-input min-w-[220px] flex-1"
          placeholder="Search GLS ref, email, bank/Yoco transaction…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="gls-admin-input w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {[
            "all",
            "pending",
            "proof_submitted",
            "verifying",
            "paid",
            "rejected",
            "refunded",
          ].map((value) => (
            <option key={value} value={value}>
              {value.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowRecord((value) => !value)}
          className="gls-cta rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide"
        >
          + Record bank payment
        </button>
      </div>

      {showRecord && (
        <div className="gls-admin-card mt-3 grid gap-3 rounded-xl p-5 lg:grid-cols-5">
          <label className="lg:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-gls-muted">
              Email or member reference
            </span>
            <input
              className="gls-admin-input mt-1"
              value={record.identity}
              onChange={(e) => record.setIdentity(e.target.value)}
              placeholder="GLS-… or member@email.com"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-wider text-gls-muted">
              Plan
            </span>
            <select
              className="gls-admin-input mt-1"
              value={record.plan}
              onChange={(e) => record.setPlan(e.target.value)}
            >
              {GLS_PLANS.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · R{plan.priceZar}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-wider text-gls-muted">
              Method
            </span>
            <select
              className="gls-admin-input mt-1"
              value={record.method}
              onChange={(e) => record.setMethod(e.target.value)}
            >
              <option value="eft">EFT</option>
              <option value="payfast">PayFast</option>
              <option value="yoco">Yoco</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-wider text-gls-muted">
              Transaction ID
            </span>
            <input
              className="gls-admin-input mt-1"
              value={record.transactionId}
              onChange={(e) => record.setTransactionId(e.target.value)}
              placeholder="Bank/PayFast/Yoco ID"
            />
          </label>
          <button
            type="button"
            disabled={
              !record.identity ||
              busy !== null ||
              ((record.method === "eft" ||
                record.method === "yoco" ||
                record.method === "payfast") &&
                !record.transactionId.trim())
            }
            onClick={record.submit}
            className="gls-cta rounded-md px-4 py-2 text-sm disabled:opacity-40 lg:col-start-5"
          >
            Record + activate
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {payments.map((payment) => (
          <button
            type="button"
            key={payment.id}
            onClick={() => setSelected(payment)}
            className="gls-admin-card flex w-full flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:border-gls-pink/30"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-semibold text-white">
                  {payment.payment_reference}
                </p>
                <span
                  className={`gls-admin-pill ${STATUS_TONE[payment.status] || STATUS_TONE.pending}`}
                >
                  {payment.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-gls-muted">
                {payment.email || payment.display_name || payment.user_id} ·{" "}
                {planLabel(payment.plan)} · {payment.payment_method}
                {payment.billing_kind === "debit_order"
                  ? ` · debit${debitDayLabel(payment.debit_day) ? ` ${debitDayLabel(payment.debit_day)}` : ""}`
                  : ""}
                {payment.billing_kind === "outstanding"
                  ? ` · outstanding${payment.dunning_fee_cents ? ` (+${money(payment.dunning_fee_cents)} fee)` : " +3%"}`
                  : ""}
                {payment.billing_kind === "outstanding" && payment.dunning_pause_at
                  ? ` · pause ${formatBillingDate(payment.dunning_pause_at)}`
                  : ""}
                {payment.next_billing_at
                  ? ` · next ${formatBillingDate(payment.next_billing_at)}`
                  : ""}
                {payment.proof_reference
                  ? ` · proof ${payment.proof_reference}`
                  : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-emerald-200">
                {money(payment.amount_zar_cents)}
              </p>
              <p className="text-[10px] text-gls-muted">
                {new Date(payment.updated_at).toLocaleString("en-ZA")}
              </p>
            </div>
          </button>
        ))}
        {!payments.length && (
          <div className="gls-admin-card rounded-xl py-16 text-center text-sm text-gls-muted">
            No payment requests matched.
          </div>
        )}
      </div>

      {selected && (
        <div
          className="gls-admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="gls-admin-modal max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-gls-pink-soft">
                  {selected.payment_reference}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selected.email || selected.display_name || "Member payment"}
                </h2>
                <p className="mt-1 text-xs text-gls-muted">
                  {selected.member_reference} · {planLabel(selected.plan)} ·{" "}
                  {money(selected.amount_zar_cents)}
                  {selected.billing_kind === "debit_order" && (
                    <>
                      {" "}
                      · debit order
                      {debitDayLabel(selected.debit_day)
                        ? ` · day ${debitDayLabel(selected.debit_day)}`
                        : ""}
                      {selected.next_billing_at
                        ? ` · next ${formatBillingDate(selected.next_billing_at)}`
                        : ""}
                    </>
                  )}
                  {selected.billing_kind === "outstanding" && (
                    <>
                      {" "}
                      · outstanding
                      {selected.dunning_fee_cents
                        ? ` · fee ${money(selected.dunning_fee_cents)}`
                        : " · +3% fee"}
                      {selected.dunning_pause_at
                        ? ` · pause ${formatBillingDate(selected.dunning_pause_at)}`
                        : ""}
                    </>
                  )}
                </p>
              </div>
              <span
                className={`gls-admin-pill ${STATUS_TONE[selected.status] || ""}`}
              >
                {selected.status}
              </span>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/35 p-4 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                Member submission
              </p>
              <p className="mt-2 text-white">
                Proof: {selected.proof_reference || "No reference entered"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-gls-body">
                {selected.proof_note || "No note"}
              </p>
            </div>

            {!["paid", "refunded"].includes(selected.status) ? (
              <div className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] uppercase tracking-wider text-gls-muted">
                      Verified payment method
                    </span>
                    <select
                      className="gls-admin-input mt-1"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="eft">EFT</option>
                      <option value="payfast">PayFast</option>
                      <option value="yoco">Yoco</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-[10px] uppercase tracking-wider text-gls-muted">
                      External transaction ID
                    </span>
                    <input
                      className="gls-admin-input mt-1"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Required for reconciliation"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-gls-muted">
                    Admin note
                  </span>
                  <textarea
                    className="gls-admin-input mt-1 min-h-[80px]"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy !== null || !transactionId.trim()}
                  onClick={approve}
                  className="gls-cta w-full rounded-md px-5 py-3 text-sm disabled:opacity-40"
                >
                  Verify + activate 30 days + issue receipt
                </button>
                {selected.payment_method === "yoco" && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={syncYoco}
                    className="w-full rounded-md border border-violet-500/35 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 disabled:opacity-40"
                  >
                    Check Yoco status + auto-activate
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={syncPayfast}
                  className="w-full rounded-md border border-emerald-500/35 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-40"
                >
                  {selected.payment_method === "payfast"
                    ? "Sync this PayFast COMPLETE → activate"
                    : "Sync stuck PayFast COMPLETE → activate"}
                </button>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("verifying")}
                    className="rounded-md border border-sky-500/30 px-3 py-2 text-xs text-sky-200"
                  >
                    Mark verifying
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("rejected")}
                    className="rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-200"
                  >
                    Reject / unmatched
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-md border border-white/15 px-3 py-2 text-xs text-gls-body"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-5 w-full rounded-md border border-white/15 px-4 py-2 text-sm text-gls-body"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MembersView({
  members,
  q,
  setQ,
  onReactivate,
}: {
  members: Member[];
  q: string;
  setQ: (value: string) => void;
  onReactivate: (member: Member) => void;
}) {
  return (
    <>
      <input
        className="gls-admin-input mt-8 max-w-xl"
        placeholder="Search email, name, GLS reference, provider…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-5 space-y-2">
        {members.map((member) => {
          const activeUntil = member.subscription?.current_period_end;
          const nextDebit =
            member.subscription?.next_billing_at ||
            null;
          const debitDay = member.subscription?.debit_day;
          const active =
            member.is_premium && member.subscription?.status === "active";
          return (
            <div
              key={member.id}
              className="gls-admin-card flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-white">
                    {member.email || member.display_name || member.id}
                  </p>
                  <span
                    className={`gls-admin-pill ${
                      active
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/10 text-gls-muted"
                    }`}
                  >
                    {active ? "active" : "inactive"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-gls-pink-soft">
                  {member.member_reference}
                </p>
                <p className="mt-1 text-[11px] text-gls-muted">
                  {planLabel(member.plan)} · {member.subscription?.provider || "no provider"}
                  {activeUntil
                    ? ` · ends ${new Date(activeUntil).toLocaleDateString("en-ZA")}`
                    : ""}
                  {debitDayLabel(debitDay)
                    ? ` · debit ${debitDayLabel(debitDay)}`
                    : ""}
                  {nextDebit
                    ? ` · next debit ${formatBillingDate(nextDebit)}`
                    : ""}
                  {member.subscription?.debit_status &&
                  member.subscription.debit_status !== "active"
                    ? ` · ${member.subscription.debit_status}`
                    : ""}
                  {member.subscription?.dunning_paused_at
                    ? ` · paused ${formatBillingDate(member.subscription.dunning_paused_at)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-lg font-semibold text-emerald-200">
                    {money(member.total_paid_zar_cents)}
                  </p>
                  <p className="text-[10px] text-gls-muted">
                    {member.payment_count} payments · {member.pending_count} pending
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReactivate(member)}
                  className="rounded-md border border-gls-pink/30 px-3 py-2 text-xs text-gls-pink-soft hover:bg-gls-pink/10"
                >
                  Reactivate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ReportsView({ reports }: { reports: Reports | null }) {
  const maxMonthly = Math.max(
    1,
    ...(reports?.monthly || []).map((row) => row.cents),
  );
  const exportCsv = () => {
    if (!reports) return;
    const lines = [
      [
        "Receipt",
        "Issued",
        "Member",
        "Email",
        "Plan",
        "Method",
        "Amount ZAR",
        "Payment reference",
        "Transaction ID",
      ],
      ...reports.receipts.map((r) => [
        r.receipt_number,
        r.issued_at,
        r.member_reference,
        r.customer_email || "",
        r.plan,
        r.payment_method,
        (r.amount_zar_cents / 100).toFixed(2),
        r.payment_reference,
        r.external_transaction_id || "",
      ]),
    ];
    const csv = lines
      .map((line) =>
        line
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gls-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (!reports?.summary) return null;
  const s = reports.summary;
  return (
    <>
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gls-body hover:text-white"
        >
          Export CSV
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Revenue 30d", money(s.revenue30dZarCents), "Paid receipts"],
          ["Total revenue", money(s.totalRevenueZarCents), "All recorded"],
          ["Paying members", s.uniquePayingMembers, `${s.activeMembers} active`],
          [
            "Returning-payer rate",
            `${s.renewalRate}%`,
            `${s.renewals} repeat receipts; share of payers with 2+ receipts`,
          ],
          ["Receipts", s.receiptCount, "Non-refunded"],
          ["Pending", s.pending, "Needs workflow"],
          ["Rejected", s.rejected, "Unmatched"],
          ["Refunded", s.refunded, "Recorded refunds"],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="gls-admin-card rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gls-pink-soft">
              {label}
            </p>
            <p className="gls-display mt-2 text-4xl text-white">{value}</p>
            <p className="mt-1 text-xs text-gls-muted">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-gold">
            Monthly revenue
          </p>
          <div className="mt-5 space-y-3">
            {reports.monthly.map((row) => (
              <div key={row.month}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gls-muted">{row.month}</span>
                  <span className="text-white">
                    {money(row.cents)} · {row.count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gls-red to-gls-pink"
                    style={{ width: `${Math.max(4, (row.cents / maxMonthly) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!reports.monthly.length && (
              <p className="text-sm text-gls-muted">No paid receipts yet.</p>
            )}
          </div>
        </section>

        <section className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
            Payment mix
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-white">By method</p>
              <div className="mt-3 space-y-2">
                {Object.entries(reports.byMethod).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
                  >
                    <span className="capitalize text-gls-body">{key}</span>
                    <span className="text-white">
                      {value.count} · {money(value.cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">By plan</p>
              <div className="mt-3 space-y-2">
                {Object.entries(reports.byPlan).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
                  >
                    <span className="text-gls-body">{planLabel(key)}</span>
                    <span className="text-white">
                      {value.count} · {money(value.cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ReceiptsView({
  receipts,
  q,
  setQ,
  busy,
  refund,
}: {
  receipts: Receipt[];
  q: string;
  setQ: (value: string) => void;
  busy: string | null;
  refund: (receipt: Receipt) => void;
}) {
  return (
    <>
      <input
        className="gls-admin-input mt-8 max-w-xl"
        placeholder="Search receipt, GLS reference, email, transaction…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="gls-admin-card mt-5 overflow-x-auto rounded-xl">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
            <tr>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Plan / method</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="border-t border-white/[0.05]">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-white">
                    {receipt.receipt_number}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-gls-muted">
                    {receipt.payment_reference}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white">
                    {receipt.customer_email ||
                      receipt.customer_name ||
                      receipt.member_reference}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-gls-pink-soft">
                    {receipt.member_reference}
                  </p>
                </td>
                <td className="px-4 py-3 text-gls-body">
                  {planLabel(receipt.plan)} · {receipt.payment_method}
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-200">
                  {money(receipt.amount_zar_cents)}
                  {receipt.refunded_at && (
                    <span className="ml-2 gls-admin-pill bg-violet-500/15 text-violet-200">
                      refunded
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gls-muted">
                  {new Date(receipt.issued_at).toLocaleString("en-ZA")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/receipts/${receipt.id}`}
                      target="_blank"
                      className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white"
                    >
                      Open
                    </Link>
                    {!receipt.refunded_at && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => refund(receipt)}
                        className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-200 disabled:opacity-40"
                      >
                        Record refund
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsView({
  settings,
  yocoConfigured,
  payfastConfigured,
  payfastSandbox,
  setSettings,
  busy,
  save,
}: {
  settings: Settings;
  yocoConfigured: boolean;
  payfastConfigured: boolean;
  payfastSandbox: boolean;
  setSettings: (settings: Settings) => void;
  busy: string | null;
  save: () => void;
}) {
  const field = (
    key: keyof Settings,
    label: string,
    placeholder = "",
    multiline = false,
  ) => (
    <label className={multiline ? "sm:col-span-2" : ""}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
        {label}
      </span>
      {multiline ? (
        <textarea
          className="gls-admin-input mt-1 min-h-[90px]"
          value={String(settings[key] || "")}
          onChange={(e) =>
            setSettings({ ...settings, [key]: e.target.value })
          }
          placeholder={placeholder}
        />
      ) : (
        <input
          className="gls-admin-input mt-1"
          value={String(settings[key] || "")}
          onChange={(e) =>
            setSettings({ ...settings, [key]: e.target.value })
          }
          placeholder={placeholder}
        />
      )}
    </label>
  );
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="gls-admin-card grid gap-4 rounded-xl p-6 sm:grid-cols-2">
        {field("trading_name", "Trading name", "GLS TV")}
        {field("support_email", "Support email", "support@example.com")}
        {field("bank_name", "Bank name")}
        {field("account_holder", "Account holder")}
        {field("account_number", "Account number")}
        {field("branch_code", "Branch code")}
        {field("account_type", "Account type")}
        <div />
        {field(
          "payment_note",
          "Payment instructions",
          "Use the exact GLS reference…",
          true,
        )}
        {field(
          "receipt_footer",
          "Receipt footer",
          "Thank you…",
          true,
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={save}
          className="gls-cta rounded-md px-5 py-3 text-sm disabled:opacity-40 sm:col-span-2"
        >
          Save payment settings
        </button>
      </div>

      <aside className="space-y-4">
        <div className="gls-admin-card rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gls-pink-soft">
            Payment methods
          </p>
          <div className="mt-4 rounded-lg border border-white/10 px-3 py-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-white">
                  PayFast
                </span>
                <span className="text-[11px] text-gls-muted">
                  {payfastConfigured
                    ? payfastSandbox
                      ? "Configured (sandbox)"
                      : "Configured (live)"
                    : "Add PAYFAST_MERCHANT_ID + KEY on server"}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.payfast_enabled !== false}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payfast_enabled: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-pink-500"
              />
            </label>
            <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-gls-muted">
              <li>
                Sign up at{" "}
                <span className="text-white/70">sandbox.payfast.co.za</span>{" "}
                (Individual / Sole Trader is fine).
              </li>
              <li>
                Copy Merchant ID, Merchant Key, and Salt Passphrase into Vercel
                env:{" "}
                <span className="text-white/70">
                  PAYFAST_MERCHANT_ID / KEY / PASSPHRASE
                </span>
                , set{" "}
                <span className="text-white/70">PAYFAST_SANDBOX=true</span>,
                redeploy.
              </li>
              <li>
                ITN notify URL:{" "}
                <span className="text-white/70">
                  https://glstv.site/api/payfast/itn
                </span>
              </li>
              <li>
                Enable PayFast here → Save → member Pricing → Card (PayFast)
                sandbox payment → membership unlocks via in-app notification.
              </li>
            </ol>
            {!payfastConfigured && (
              <p className="mt-2 text-[11px] text-amber-200/90">
                Toggle stays off until keys are on the server. EFT still works
                without PayFast.
              </p>
            )}
          </div>
          <label className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-3">
            <span>
              <span className="block text-sm font-semibold text-white">Yoco</span>
              <span className="text-[11px] text-gls-muted">
                {yocoConfigured
                  ? "Secret key configured"
                  : "Add YOCO_SECRET_KEY on server"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.yoco_enabled}
              onChange={(e) =>
                setSettings({ ...settings, yoco_enabled: e.target.checked })
              }
              className="h-4 w-4 accent-pink-500"
            />
          </label>
          <label className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-3">
            <span>
              <span className="block text-sm font-semibold text-white">EFT</span>
              <span className="text-[11px] text-gls-muted">
                Show bank details to signed-in members
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.eft_enabled}
              onChange={(e) =>
                setSettings({ ...settings, eft_enabled: e.target.checked })
              }
              className="h-4 w-4 accent-pink-500"
            />
          </label>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          <p className="font-semibold">Launch safety</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
            Verify bank transactions before manual approval. PayFast ITN
            activates automatically when signature + amount match. Status
            updates are in-app notifications only (no email until Resend).
          </p>
        </div>
      </aside>
    </div>
  );
}

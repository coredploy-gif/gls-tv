/** Light in-house finance ledger helpers (pure, testable). */

export const LEDGER_ACCOUNTS = [
  "membership_revenue",
  "decline_fee",
  "refund",
  "uncollected",
] as const;

export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];
export type LedgerDirection = "credit" | "debit";
export type AgingBucket = "0-2" | "3-4" | "5+";

export type ReconcileIssue =
  | "paid_missing_ledger"
  | "ledger_missing_receipt"
  | "payfast_complete_stuck"
  | "amount_mismatch";

export function isLedgerAccount(value: string): value is LedgerAccount {
  return (LEDGER_ACCOUNTS as readonly string[]).includes(value);
}

/** Whole calendar days elapsed since an ISO timestamp (UTC date parts). */
export function daysSince(isoDate: string, now: Date = new Date()): number {
  const opened = new Date(isoDate);
  if (Number.isNaN(opened.getTime())) return 0;
  const a = Date.UTC(
    opened.getUTCFullYear(),
    opened.getUTCMonth(),
    opened.getUTCDate(),
  );
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (b < a) return 0;
  return Math.floor((b - a) / 86_400_000);
}

/** AR aging bucket for outstanding / past_due / paused dunning. */
export function agingBucket(daysOpen: number): AgingBucket {
  if (daysOpen <= 2) return "0-2";
  if (daysOpen <= 4) return "3-4";
  return "5+";
}

/** Split outstanding payment into plan revenue and decline fee portions. */
export function splitOutstandingAmount(
  totalCents: number,
  feeCents: number | null | undefined,
): { revenueCents: number; feeCents: number } {
  const fee = Math.max(0, Math.min(totalCents, feeCents ?? 0));
  return { revenueCents: Math.max(0, totalCents - fee), feeCents: fee };
}

export type BookkeeperRowInput = {
  paidAt: string;
  paymentReference: string;
  memberReference: string;
  plan: string;
  amountZarCents: number;
  feeCents: number;
  pfPaymentId: string | null;
  billingKind: string | null;
  receiptNumber: string;
};

/** One CSV row for the monthly bookkeeper export. */
export function bookkeeperCsvRow(input: BookkeeperRowInput): unknown[] {
  return [
    input.paidAt.slice(0, 10),
    input.paymentReference,
    input.memberReference,
    input.plan,
    (input.amountZarCents / 100).toFixed(2),
    (input.feeCents / 100).toFixed(2),
    input.pfPaymentId || "",
    input.billingKind || "once",
    input.receiptNumber,
  ];
}

export const BOOKKEEPER_CSV_HEADERS = [
  "date",
  "ref",
  "member",
  "plan",
  "amount",
  "fee",
  "payfast_id",
  "billing_kind",
  "receipt_number",
] as const;

export type ReconcilePaidRow = {
  id: string;
  status: string;
  payment_method: string;
  payfast_status: string | null;
  amount_zar_cents: number;
  pf_payment_id: string | null;
};

export type ReconcileLedgerRow = {
  payment_request_id: string | null;
  amount_zar_cents: number;
};

/** Classify paid rows missing ledger coverage or stuck PayFast COMPLETE. */
export function classifyReconcileIssues(
  paid: ReconcilePaidRow[],
  ledgerByPayment: Map<string, number>,
  receiptByPayment: Set<string>,
): Array<{ paymentId: string; issue: ReconcileIssue; detail: string }> {
  const issues: Array<{ paymentId: string; issue: ReconcileIssue; detail: string }> =
    [];

  for (const row of paid) {
    if (row.status !== "paid") continue;

    const ledgerTotal = ledgerByPayment.get(row.id) || 0;
    if (ledgerTotal <= 0) {
      issues.push({
        paymentId: row.id,
        issue: "paid_missing_ledger",
        detail: "Paid payment has no ledger credits",
      });
    } else if (Math.abs(ledgerTotal - row.amount_zar_cents) > 1) {
      issues.push({
        paymentId: row.id,
        issue: "amount_mismatch",
        detail: `Ledger ${ledgerTotal} vs payment ${row.amount_zar_cents}`,
      });
    }

    if (!receiptByPayment.has(row.id)) {
      issues.push({
        paymentId: row.id,
        issue: "ledger_missing_receipt",
        detail: "Paid payment has no receipt",
      });
    }

    if (
      row.payment_method === "payfast" &&
      String(row.payfast_status || "").toLowerCase() === "complete" &&
      row.status !== "paid"
    ) {
      issues.push({
        paymentId: row.id,
        issue: "payfast_complete_stuck",
        detail: "PayFast COMPLETE but not activated",
      });
    }
  }

  return issues;
}

/** Summarise daybook credits minus debits per account (ZAR cents). */
export function daybookNetByAccount(
  entries: Array<{ account: string; direction: LedgerDirection; amount_zar_cents: number }>,
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const entry of entries) {
    const sign = entry.direction === "credit" ? 1 : -1;
    net[entry.account] = (net[entry.account] || 0) + sign * entry.amount_zar_cents;
  }
  return net;
}

import { describe, expect, it } from "vitest";
import {
  agingBucket,
  bookkeeperCsvRow,
  classifyReconcileIssues,
  daybookNetByAccount,
  daysSince,
  splitOutstandingAmount,
} from "@/lib/finance/ledger";

describe("daysSince", () => {
  it("counts whole UTC calendar days", () => {
    const now = new Date(Date.UTC(2026, 6, 17, 15, 0, 0));
    expect(daysSince("2026-07-15T08:00:00.000Z", now)).toBe(2);
  });

  it("returns 0 for future dates", () => {
    const now = new Date(Date.UTC(2026, 6, 10));
    expect(daysSince("2026-07-15T00:00:00.000Z", now)).toBe(0);
  });
});

describe("agingBucket", () => {
  it("maps dunning day ranges", () => {
    expect(agingBucket(0)).toBe("0-2");
    expect(agingBucket(2)).toBe("0-2");
    expect(agingBucket(3)).toBe("3-4");
    expect(agingBucket(4)).toBe("3-4");
    expect(agingBucket(5)).toBe("5+");
    expect(agingBucket(30)).toBe("5+");
  });
});

describe("splitOutstandingAmount", () => {
  it("splits plan and fee", () => {
    expect(splitOutstandingAmount(4635, 135)).toEqual({
      revenueCents: 4500,
      feeCents: 135,
    });
  });

  it("clamps fee to total", () => {
    expect(splitOutstandingAmount(100, 500)).toEqual({
      revenueCents: 0,
      feeCents: 100,
    });
  });
});

describe("bookkeeperCsvRow", () => {
  it("formats export columns", () => {
    const row = bookkeeperCsvRow({
      paidAt: "2026-07-17T10:00:00.000Z",
      paymentReference: "GLS-ABC-001",
      memberReference: "GLS-12345678",
      plan: "gls_55",
      amountZarCents: 4635,
      feeCents: 135,
      pfPaymentId: "pf-99",
      billingKind: "outstanding",
      receiptNumber: "GLS-RCT-2026-000001",
    });
    expect(row).toEqual([
      "2026-07-17",
      "GLS-ABC-001",
      "GLS-12345678",
      "gls_55",
      "46.35",
      "1.35",
      "pf-99",
      "outstanding",
      "GLS-RCT-2026-000001",
    ]);
  });
});

describe("daybookNetByAccount", () => {
  it("nets credits and debits", () => {
    const net = daybookNetByAccount([
      { account: "membership_revenue", direction: "credit", amount_zar_cents: 4500 },
      { account: "membership_revenue", direction: "credit", amount_zar_cents: 5500 },
      { account: "refund", direction: "debit", amount_zar_cents: 4500 },
    ]);
    expect(net.membership_revenue).toBe(10000);
    expect(net.refund).toBe(-4500);
  });
});

describe("classifyReconcileIssues", () => {
  it("flags missing ledger and amount mismatch", () => {
    const paid = [
      {
        id: "p1",
        status: "paid",
        payment_method: "payfast",
        payfast_status: "complete",
        amount_zar_cents: 4500,
        pf_payment_id: "pf1",
      },
      {
        id: "p2",
        status: "paid",
        payment_method: "eft",
        payfast_status: null,
        amount_zar_cents: 5500,
        pf_payment_id: null,
      },
    ];
    const ledger = new Map([
      ["p2", 5000],
    ]);
    const receipts = new Set(["p1", "p2"]);
    const issues = classifyReconcileIssues(paid, ledger, receipts);
    expect(issues.some((i) => i.paymentId === "p1" && i.issue === "paid_missing_ledger")).toBe(
      true,
    );
    expect(issues.some((i) => i.paymentId === "p2" && i.issue === "amount_mismatch")).toBe(
      true,
    );
  });
});

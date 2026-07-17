import { describe, expect, it } from "vitest";
import {
  buildDebitOrderQuote,
  declineFeeCents,
  dunningSchedule,
  inclusiveDaySpan,
  nextDebitDate,
  outstandingCents,
  parsePayfastDebitDay,
  prorataCents,
} from "@/lib/payfast-debit";

describe("nextDebitDate", () => {
  it("picks later day in same month", () => {
    const from = new Date(Date.UTC(2026, 6, 10)); // Jul 10
    const next = nextDebitDate(from, 15);
    expect(next.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("rolls to next month when on/after debit day", () => {
    const from = new Date(Date.UTC(2026, 6, 30)); // Jul 30
    const next = nextDebitDate(from, 30);
    expect(next.toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("clamps 30 in February", () => {
    const from = new Date(Date.UTC(2026, 1, 10)); // Feb 10 2026
    const next = nextDebitDate(from, 30);
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("prorataCents", () => {
  it("prorates across days until billing date", () => {
    const from = new Date(Date.UTC(2026, 6, 10));
    const until = new Date(Date.UTC(2026, 6, 15));
    // 5 calendar days exclusive of until → 4 cover days? inclusiveSpan 10..15 = 6, minus 1 = 5
    const cents = prorataCents(4500, from, until);
    expect(cents).toBe(Math.max(100, Math.round((4500 * 5) / 31)));
  });

  it("never goes below R1", () => {
    const from = new Date(Date.UTC(2026, 6, 29));
    const until = new Date(Date.UTC(2026, 6, 30));
    expect(prorataCents(4500, from, until)).toBeGreaterThanOrEqual(100);
  });
});

describe("buildDebitOrderQuote", () => {
  it("returns summary and iso billing date", () => {
    const q = buildDebitOrderQuote({
      monthlyCents: 4500,
      debitDay: 1,
      from: new Date(Date.UTC(2026, 6, 17)),
    });
    expect(q.billingDateIso).toBe("2026-08-01");
    expect(q.recurringCents).toBe(4500);
    expect(q.amountCents).toBeGreaterThanOrEqual(100);
    expect(q.summary).toContain("every month");
  });
});

describe("parsePayfastDebitDay", () => {
  it("accepts 1, 15, 30", () => {
    expect(parsePayfastDebitDay(15)).toBe(15);
    expect(parsePayfastDebitDay("30")).toBe(30);
    expect(parsePayfastDebitDay(7)).toBeNull();
  });
});

describe("inclusiveDaySpan", () => {
  it("counts inclusive", () => {
    expect(
      inclusiveDaySpan(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 1)),
      ),
    ).toBe(1);
  });
});

describe("declineFeeCents / outstandingCents", () => {
  it("adds 3% for Standard R45", () => {
    expect(declineFeeCents(4500)).toBe(135);
    expect(outstandingCents(4500)).toBe(4635);
  });

  it("adds 3% for Plus R55 and Family R65", () => {
    expect(declineFeeCents(5500)).toBe(165);
    expect(outstandingCents(5500)).toBe(5665);
    expect(declineFeeCents(6500)).toBe(195);
    expect(outstandingCents(6500)).toBe(6695);
  });

  it("uses min fee of 1 cent", () => {
    expect(declineFeeCents(1)).toBe(1);
  });
});

describe("dunningSchedule", () => {
  it("sets remind +3d and pause +5d", () => {
    const from = new Date(Date.UTC(2026, 6, 10, 12, 0, 0));
    const s = dunningSchedule(from);
    expect(s.remind3At.toISOString().slice(0, 10)).toBe("2026-07-13");
    expect(s.pauseAt.toISOString().slice(0, 10)).toBe("2026-07-15");
  });
});

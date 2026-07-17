/** Debit days members can choose for PayFast monthly subscriptions. */
export const PAYFAST_DEBIT_DAYS = [1, 15, 30] as const;
export type PayfastDebitDay = (typeof PAYFAST_DEBIT_DAYS)[number];

export function isPayfastDebitDay(value: unknown): value is PayfastDebitDay {
  return (
    typeof value === "number" &&
    (PAYFAST_DEBIT_DAYS as readonly number[]).includes(value)
  );
}

export function parsePayfastDebitDay(raw: unknown): PayfastDebitDay | null {
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  if (!Number.isInteger(n)) return null;
  return isPayfastDebitDay(n) ? n : null;
}

function utcYmd(d: Date): { y: number; m: number; day: number } {
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}

function daysInMonthUtc(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function clampDayInMonth(y: number, m: number, day: number): number {
  return Math.min(day, daysInMonthUtc(y, m));
}

function atUtcNoon(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m, day, 12, 0, 0));
}

/**
 * Next calendar occurrence of debit day on/after `from` (UTC date parts).
 * If `from` is already that debit day, returns next month's occurrence
 * (first full cycle starts after the initial prorata period).
 */
export function nextDebitDate(from: Date, debitDay: PayfastDebitDay): Date {
  const { y, m, day } = utcYmd(from);
  const thisMonthDay = clampDayInMonth(y, m, debitDay);
  if (day < thisMonthDay) {
    return atUtcNoon(y, m, thisMonthDay);
  }
  // today is debit day or past it → next month
  const nm = m === 11 ? 0 : m + 1;
  const ny = m === 11 ? y + 1 : y;
  return atUtcNoon(ny, nm, clampDayInMonth(ny, nm, debitDay));
}

/** Inclusive calendar days from `from` date to `until` date (UTC). */
export function inclusiveDaySpan(from: Date, until: Date): number {
  const a = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const b = Date.UTC(
    until.getUTCFullYear(),
    until.getUTCMonth(),
    until.getUTCDate(),
  );
  if (b < a) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/**
 * Prorata of monthly cents for days from `from` through day before `until`
 * (access until billing_date; charge covers that window).
 * Min R1.00 when at least one day.
 */
export function prorataCents(
  monthlyCents: number,
  from: Date,
  until: Date,
): number {
  if (monthlyCents <= 0) return 0;
  const days = Math.max(0, inclusiveDaySpan(from, until) - 1);
  // days until billing_date exclusive of billing day itself
  const coverDays = Math.max(days, 0);
  if (coverDays <= 0) {
    // Same-day edge: charge min or small stub — use 1 day of month
    const dim = daysInMonthUtc(from.getUTCFullYear(), from.getUTCMonth());
    return Math.max(100, Math.round(monthlyCents / dim));
  }
  const dim = daysInMonthUtc(from.getUTCFullYear(), from.getUTCMonth());
  const cents = Math.round((monthlyCents * coverDays) / dim);
  return Math.max(100, cents);
}

export function formatZarFromCents(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

export function debitDayLabel(day: PayfastDebitDay): string {
  if (day === 1) return "1st";
  if (day === 15) return "15th";
  return "30th";
}

export function buildDebitOrderQuote(input: {
  monthlyCents: number;
  debitDay: PayfastDebitDay;
  from?: Date;
}) {
  const from = input.from || new Date();
  const billingDate = nextDebitDate(from, input.debitDay);
  const amountCents = prorataCents(input.monthlyCents, from, billingDate);
  const coverDays = Math.max(0, inclusiveDaySpan(from, billingDate) - 1);
  return {
    debitDay: input.debitDay,
    billingDate,
    billingDateIso: billingDate.toISOString().slice(0, 10),
    amountCents,
    recurringCents: input.monthlyCents,
    coverDays: coverDays || 1,
    summary: `${formatZarFromCents(amountCents)} now (${coverDays || 1} day${(coverDays || 1) === 1 ? "" : "s"}) · then ${formatZarFromCents(input.monthlyCents)} on the ${debitDayLabel(input.debitDay)} every month`,
  };
}

/** Decline fee: 3% of monthly plan, min R0.01. */
export const DEBIT_DECLINE_FEE_RATE = 0.03;
export const DUNNING_REMIND_DAYS = 3;
export const DUNNING_PAUSE_DAYS = 5;

export function declineFeeCents(monthlyCents: number): number {
  if (monthlyCents <= 0) return 0;
  return Math.max(1, Math.round(monthlyCents * DEBIT_DECLINE_FEE_RATE));
}

/** Full month + 3% decline fee. */
export function outstandingCents(monthlyCents: number): number {
  if (monthlyCents <= 0) return 0;
  return monthlyCents + declineFeeCents(monthlyCents);
}

export function dunningSchedule(from: Date = new Date()) {
  const opened = new Date(from.getTime());
  const remind3 = new Date(from.getTime() + DUNNING_REMIND_DAYS * 86_400_000);
  const pause = new Date(from.getTime() + DUNNING_PAUSE_DAYS * 86_400_000);
  return {
    openedAt: opened,
    remind3At: remind3,
    pauseAt: pause,
  };
}

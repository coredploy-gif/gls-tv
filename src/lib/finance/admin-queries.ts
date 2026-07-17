import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agingBucket,
  classifyReconcileIssues,
  daybookNetByAccount,
  daysSince,
  type AgingBucket,
} from "@/lib/finance/ledger";

type Service = SupabaseClient;

function dateRangeFilter(from: string | null, to: string | null) {
  const start = from ? `${from}T00:00:00.000Z` : null;
  const end = to ? `${to}T23:59:59.999Z` : null;
  return { start, end };
}

export async function fetchDaybook(
  service: Service,
  from: string | null,
  to: string | null,
) {
  const { start, end } = dateRangeFilter(from, to);
  let query = service
    .from("finance_ledger_entries")
    .select("*")
    .order("entry_at", { ascending: true })
    .limit(5000);
  if (start) query = query.gte("entry_at", start);
  if (end) query = query.lte("entry_at", end);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const entries = data || [];
  const byDay: Record<
    string,
    {
      entries: typeof entries;
      netByAccount: Record<string, number>;
      creditTotal: number;
      debitTotal: number;
    }
  > = {};
  for (const entry of entries) {
    const day = String(entry.entry_at).slice(0, 10);
    byDay[day] ||= {
      entries: [],
      netByAccount: {},
      creditTotal: 0,
      debitTotal: 0,
    };
    byDay[day].entries.push(entry);
    if (entry.direction === "credit") {
      byDay[day].creditTotal += entry.amount_zar_cents;
    } else {
      byDay[day].debitTotal += entry.amount_zar_cents;
    }
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].netByAccount = daybookNetByAccount(byDay[day].entries);
  }
  return {
    entries,
    days: Object.entries(byDay)
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    netByAccount: daybookNetByAccount(entries),
    creditTotal: entries
      .filter((e) => e.direction === "credit")
      .reduce((s, e) => s + e.amount_zar_cents, 0),
    debitTotal: entries
      .filter((e) => e.direction === "debit")
      .reduce((s, e) => s + e.amount_zar_cents, 0),
  };
}

export async function fetchArAging(service: Service) {
  const { data: openOutstanding, error } = await service
    .from("manual_payment_requests")
    .select(
      "id, user_id, member_reference, payment_reference, plan, amount_zar_cents, dunning_fee_cents, dunning_opened_at, dunning_pause_at, dunning_paused_at, status, billing_kind, created_at",
    )
    .eq("billing_kind", "outstanding")
    .in("status", ["pending", "verifying", "proof_submitted"])
    .order("dunning_opened_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const userIds = [...new Set((openOutstanding || []).map((r) => r.user_id))];
  const { data: subs } = userIds.length
    ? await service
        .from("subscriptions")
        .select("user_id, debit_status, dunning_paused_at")
        .in("user_id", userIds)
    : { data: [] };
  const subMap = new Map((subs || []).map((s) => [s.user_id, s]));

  const { data: profiles } = userIds.length
    ? await service
        .from("profiles")
        .select("id, email, display_name, member_reference")
        .in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const buckets: Record<
    AgingBucket,
    Array<{
      id: string;
      user_id: string;
      member_reference: string;
      email: string | null;
      payment_reference: string;
      amount_zar_cents: number;
      days_open: number;
      bucket: AgingBucket;
      debit_status: string | null;
      dunning_opened_at: string | null;
    }>
  > = { "0-2": [], "3-4": [], "5+": [] };

  for (const row of openOutstanding || []) {
    const openedAt =
      row.dunning_opened_at || row.created_at || new Date().toISOString();
    const daysOpen = daysSince(openedAt);
    const bucket = agingBucket(daysOpen);
    const profile = profileMap.get(row.user_id);
    const sub = subMap.get(row.user_id);
    buckets[bucket].push({
      id: row.id,
      user_id: row.user_id,
      member_reference: row.member_reference,
      email: profile?.email || profile?.display_name || null,
      payment_reference: row.payment_reference,
      amount_zar_cents: row.amount_zar_cents,
      days_open: daysOpen,
      bucket,
      debit_status: sub?.debit_status || null,
      dunning_opened_at: row.dunning_opened_at,
    });
  }

  const summary = {
    totalOpen: (openOutstanding || []).length,
    totalCents: (openOutstanding || []).reduce(
      (s, r) => s + (r.amount_zar_cents || 0),
      0,
    ),
    bucket0_2: buckets["0-2"].length,
    bucket3_4: buckets["3-4"].length,
    bucket5plus: buckets["5+"].length,
    pastDue: (subs || []).filter((s) => s.debit_status === "past_due").length,
    paused: (subs || []).filter(
      (s) => s.debit_status === "paused" || s.dunning_paused_at,
    ).length,
  };

  return { summary, buckets, rows: Object.values(buckets).flat() };
}

export async function fetchMemberStatement(
  service: Service,
  memberQuery: string,
) {
  const q = memberQuery.trim().toLowerCase();
  if (!q) throw new Error("Member reference or email required");

  const { data: profiles } = await service
    .from("profiles")
    .select("id, email, display_name, member_reference, plan, is_premium")
    .limit(2000);
  const profile = (profiles || []).find(
    (p) =>
      String(p.member_reference || "").toLowerCase() === q ||
      String(p.email || "").toLowerCase() === q ||
      String(p.id).toLowerCase() === q,
  );
  if (!profile) throw new Error("Member not found");

  const [{ data: ledger }, { data: receipts }, { data: payments }, { data: sub }] =
    await Promise.all([
      service
        .from("finance_ledger_entries")
        .select("*")
        .eq("user_id", profile.id)
        .order("entry_at", { ascending: false })
        .limit(500),
      service
        .from("payment_receipts")
        .select("*")
        .eq("user_id", profile.id)
        .order("issued_at", { ascending: false })
        .limit(200),
      service
        .from("manual_payment_requests")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(200),
      service
        .from("subscriptions")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  const paidTotal = (receipts || [])
    .filter((r) => !r.refunded_at)
    .reduce((s, r) => s + (r.amount_zar_cents || 0), 0);

  return {
    profile,
    subscription: sub,
    ledger: ledger || [],
    receipts: receipts || [],
    payments: payments || [],
    summary: {
      paidTotalCents: paidTotal,
      receiptCount: (receipts || []).filter((r) => !r.refunded_at).length,
      openOutstanding: (payments || []).filter(
        (p) =>
          p.billing_kind === "outstanding" &&
          ["pending", "verifying", "proof_submitted"].includes(p.status),
      ).length,
      ledgerNetByAccount: daybookNetByAccount(ledger || []),
    },
  };
}

export async function fetchReconcileSummary(service: Service) {
  const [{ data: paidRecent }, { data: stuckPayfast }, { data: ledger }, { data: receipts }] =
    await Promise.all([
      service
        .from("manual_payment_requests")
        .select(
          "id, status, payment_method, payfast_status, amount_zar_cents, pf_payment_id, payment_reference, paid_at",
        )
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(300),
      service
        .from("manual_payment_requests")
        .select(
          "id, payment_reference, pf_payment_id, payfast_status, status, amount_zar_cents",
        )
        .eq("payment_method", "payfast")
        .in("status", ["pending", "proof_submitted", "verifying"])
        .ilike("payfast_status", "complete")
        .limit(50),
      service
        .from("finance_ledger_entries")
        .select("payment_request_id, amount_zar_cents, account, direction")
        .in("account", ["membership_revenue", "decline_fee"])
        .eq("direction", "credit")
        .limit(5000),
      service
        .from("payment_receipts")
        .select("payment_request_id")
        .limit(5000),
    ]);

  const ledgerByPayment = new Map<string, number>();
  for (const row of ledger || []) {
    if (!row.payment_request_id) continue;
    ledgerByPayment.set(
      row.payment_request_id,
      (ledgerByPayment.get(row.payment_request_id) || 0) +
        row.amount_zar_cents,
    );
  }
  const receiptByPayment = new Set(
    (receipts || []).map((r) => r.payment_request_id).filter(Boolean),
  );

  const issues = classifyReconcileIssues(
    paidRecent || [],
    ledgerByPayment,
    receiptByPayment,
  );

  for (const row of stuckPayfast || []) {
    issues.push({
      paymentId: row.id,
      issue: "payfast_complete_stuck",
      detail: `${row.payment_reference}: PayFast COMPLETE awaiting activation`,
    });
  }

  return {
    summary: {
      paidScanned: (paidRecent || []).length,
      stuckPayfast: (stuckPayfast || []).length,
      issueCount: issues.length,
      missingLedger: issues.filter((i) => i.issue === "paid_missing_ledger")
        .length,
      amountMismatch: issues.filter((i) => i.issue === "amount_mismatch").length,
      missingReceipt: issues.filter((i) => i.issue === "ledger_missing_receipt")
        .length,
      payfastStuck: issues.filter((i) => i.issue === "payfast_complete_stuck")
        .length,
    },
    stuckPayfast: stuckPayfast || [],
    issues: issues.slice(0, 100),
  };
}

import "server-only";

import { createServiceClient } from "@/lib/eadmin";
import { memberReferenceFor } from "@/lib/manual-billing";
import {
  hasEverPaid,
  isLapsedMember,
  isNeverSubscribed,
  isPaidSubscriptionActive,
  isTrialActive,
  membershipBucketFor,
  type MembershipBucket,
  type MembershipProfileRow,
  type MembershipSubscriptionRow,
} from "@/lib/membership/admin-metrics";

export type MembershipMemberRow = MembershipProfileRow & {
  member_reference: string;
  created_at: string | null;
  trial_started_at: string | null;
  subscription: MembershipSubscriptionRow | null;
  payment_count: number;
  bucket: Exclude<MembershipBucket, "all">;
};

export type MembershipOverviewData = {
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
  members: MembershipMemberRow[];
};

const PROFILE_SELECT =
  "id, email, display_name, member_reference, plan, is_premium, trial_ends_at, trial_started_at, trial_bypassed, is_admin_exception, created_at";

async function fetchAllProfiles(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
) {
  const rows: MembershipProfileRow[] = [];
  const pageSize = 1000;
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await service
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = (data || []) as MembershipProfileRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function fetchSubscriptions(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  userIds: string[],
) {
  const map = new Map<string, MembershipSubscriptionRow>();
  if (!userIds.length) return map;
  const chunkSize = 500;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const { data, error } = await service
      .from("subscriptions")
      .select("user_id, status, current_period_end, provider, plan")
      .in("user_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      map.set(row.user_id, row as MembershipSubscriptionRow);
    }
  }
  return map;
}

async function fetchPaymentCounts(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
) {
  const counts = new Map<string, number>();
  const pageSize = 5000;
  for (let page = 0; page < 20; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await service
      .from("payment_receipts")
      .select("user_id")
      .is("refunded_at", null)
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = data || [];
    for (const row of batch) {
      counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
    }
    if (batch.length < pageSize) break;
  }
  return counts;
}

export async function loadMembershipOverview(): Promise<MembershipOverviewData> {
  const service = createServiceClient();
  if (!service) throw new Error("No service role");

  const profiles = await fetchAllProfiles(service);
  const userIds = profiles.map((p) => p.id);
  const [subscriptionMap, paymentCounts] = await Promise.all([
    fetchSubscriptions(service, userIds),
    fetchPaymentCounts(service),
  ]);

  const now = Date.now();
  const signups30dCutoff = now - 30 * 86_400_000;
  const byPlan: Record<string, number> = {};
  let subscribed = 0;
  let trial = 0;
  let neverSubscribed = 0;
  let lapsed = 0;
  let exceptions = 0;
  let signups30d = 0;

  const members: MembershipMemberRow[] = profiles.map((profile) => {
    const subscription = subscriptionMap.get(profile.id) || null;
    const payment_count = paymentCounts.get(profile.id) || 0;
    const plan = String(profile.plan || "trial");
    byPlan[plan] = (byPlan[plan] || 0) + 1;

    if (
      profile.is_admin_exception ||
      profile.trial_bypassed ||
      plan === "exception" ||
      plan === "admin"
    ) {
      exceptions += 1;
    }
    if (profile.created_at && new Date(profile.created_at).getTime() >= signups30dCutoff) {
      signups30d += 1;
    }
    if (isPaidSubscriptionActive(profile, subscription, now)) subscribed += 1;
    if (isTrialActive(profile, subscription, now)) trial += 1;
    if (isNeverSubscribed(payment_count)) neverSubscribed += 1;
    if (isLapsedMember(profile, subscription, payment_count, now)) lapsed += 1;

    return {
      ...profile,
      member_reference: profile.member_reference || memberReferenceFor(profile.id),
      created_at: profile.created_at || null,
      trial_started_at: profile.trial_started_at || null,
      subscription,
      payment_count,
      bucket: membershipBucketFor(profile, subscription, payment_count, now),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      allUsers: profiles.length,
      subscribed,
      trial,
      neverSubscribed,
      lapsed,
      signups30d,
      exceptions,
    },
    byPlan,
    members,
  };
}

export function filterMembersByBucket(
  members: MembershipMemberRow[],
  bucket: MembershipBucket,
) {
  if (bucket === "all") return members;
  if (bucket === "subscribed") {
    return members.filter((m) =>
      isPaidSubscriptionActive(m, m.subscription, Date.now()),
    );
  }
  if (bucket === "trial") {
    return members.filter((m) => isTrialActive(m, m.subscription, Date.now()));
  }
  if (bucket === "never_subscribed") {
    return members.filter((m) => !hasEverPaid(m.payment_count));
  }
  return members.filter((m) =>
    isLapsedMember(m, m.subscription, m.payment_count, Date.now()),
  );
}

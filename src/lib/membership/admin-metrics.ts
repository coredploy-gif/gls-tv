import type { AccountProfile, AccountSubscription } from "@/lib/membership/account";

export type MembershipBucket =
  | "all"
  | "subscribed"
  | "trial"
  | "never_subscribed"
  | "lapsed";

export type MembershipProfileRow = Pick<
  AccountProfile,
  | "id"
  | "email"
  | "display_name"
  | "plan"
  | "is_premium"
  | "trial_ends_at"
  | "trial_bypassed"
  | "is_admin_exception"
> & {
  member_reference?: string | null;
  trial_started_at?: string | null;
  created_at?: string | null;
};

export type MembershipSubscriptionRow = AccountSubscription & {
  user_id?: string;
  provider?: string | null;
  plan?: string | null;
};

/** Active paid membership — matches `accountHasAccess` subscription branch. */
export function isPaidSubscriptionActive(
  profile: Pick<MembershipProfileRow, "is_premium">,
  subscription: Pick<
    MembershipSubscriptionRow,
    "status" | "current_period_end"
  > | null | undefined,
  now = Date.now(),
) {
  return Boolean(
    profile.is_premium &&
      subscription?.status === "active" &&
      subscription.current_period_end &&
      new Date(subscription.current_period_end).getTime() > now,
  );
}

/** Active 14-day trial — in trial window and not currently subscribed. */
export function isTrialActive(
  profile: Pick<
    MembershipProfileRow,
    "trial_ends_at" | "is_premium" | "trial_bypassed" | "is_admin_exception" | "plan"
  >,
  subscription: Pick<
    MembershipSubscriptionRow,
    "status" | "current_period_end"
  > | null | undefined,
  now = Date.now(),
) {
  if (isPaidSubscriptionActive(profile, subscription, now)) return false;
  if (!profile.trial_ends_at) return false;
  return new Date(profile.trial_ends_at).getTime() > now;
}

export function hasEverPaid(paymentCount: number) {
  return paymentCount > 0;
}

export function isNeverSubscribed(paymentCount: number) {
  return paymentCount === 0;
}

export function isLapsedMember(
  profile: MembershipProfileRow,
  subscription: Pick<
    MembershipSubscriptionRow,
    "status" | "current_period_end"
  > | null | undefined,
  paymentCount: number,
  now = Date.now(),
) {
  return (
    hasEverPaid(paymentCount) &&
    !isPaidSubscriptionActive(profile, subscription, now) &&
    !isTrialActive(profile, subscription, now)
  );
}

export function membershipBucketFor(
  profile: MembershipProfileRow,
  subscription: MembershipSubscriptionRow | null | undefined,
  paymentCount: number,
  now = Date.now(),
): Exclude<MembershipBucket, "all"> {
  if (isPaidSubscriptionActive(profile, subscription, now)) return "subscribed";
  if (isTrialActive(profile, subscription, now)) return "trial";
  if (isNeverSubscribed(paymentCount)) return "never_subscribed";
  return "lapsed";
}

export const MEMBERSHIP_BUCKET_LABELS: Record<MembershipBucket, string> = {
  all: "All users",
  subscribed: "Subscribed users",
  trial: "On 14-day trial",
  never_subscribed: "Never subscribed",
  lapsed: "Lapsed (paid before)",
};

export const MEMBERSHIP_METRIC_DEFINITIONS = {
  allUsers:
    "Total registered profiles in GLS TV (every auth account with a profile row).",
  subscribed:
    "Currently premium with an active subscription and valid membership period (`is_premium`, subscription status `active`, `current_period_end` in the future). Matches runtime access checks.",
  trial:
    "Currently inside the 14-day trial window (`trial_ends_at` in the future) and not an active paid subscriber.",
  neverSubscribed:
    "No non-refunded payment receipts on record — trial-only accounts or users who never activated a paid plan.",
  lapsed:
    "Paid at least once before but not currently subscribed or in an active trial window.",
} as const;

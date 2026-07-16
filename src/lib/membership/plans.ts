export type GlsPlanId =
  | "trial"
  | "gls_55"
  | "gls_65"
  | "gls_75"
  | "exception"
  | "admin";

export type PlanTier = {
  id: GlsPlanId;
  name: string;
  priceZar: number | null;
  /** Adult viewer profiles (Kids tile is always included separately). */
  adultProfiles: number;
  includesKids: boolean;
  badge: string;
};

/** R45 / R55 / R65 — adult slots + Kids. Plan IDs kept for existing memberships. */
export const GLS_PLANS: PlanTier[] = [
  {
    id: "gls_55",
    name: "Standard",
    priceZar: 45,
    adultProfiles: 2,
    includesKids: true,
    badge: "2 profiles + Kids",
  },
  {
    id: "gls_65",
    name: "Plus",
    priceZar: 55,
    adultProfiles: 3,
    includesKids: true,
    badge: "3 profiles + Kids",
  },
  {
    id: "gls_75",
    name: "Family",
    priceZar: 65,
    adultProfiles: 4,
    includesKids: true,
    badge: "4 profiles + Kids",
  },
];

export const TRIAL_DAYS = 14;

export function adultLimitForPlan(plan: GlsPlanId | string | null | undefined) {
  switch (plan) {
    case "gls_55":
      return 2;
    case "gls_65":
      return 3;
    case "gls_75":
    case "exception":
    case "admin":
      return 4;
    case "trial":
    default:
      return 2;
  }
}

export function maxViewerSlots(plan: GlsPlanId | string | null | undefined) {
  // adults + dedicated Kids profile
  return adultLimitForPlan(plan) + 1;
}

export const ACTIVE_VIEWER_COOKIE = "gls_viewer_profile";
/** HttpOnly opaque token for simultaneous adult/kids stream slots. */
export const VIEWER_SESSION_COOKIE = "gls_viewer_session";
export const DEVICE_ID_KEY = "gls-tv-device-id-v1";

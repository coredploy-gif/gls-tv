/**
 * What GLS TV collects from members (keep lean).
 * Cards never touch our servers — Stripe Checkout / Billing only.
 */

export const MEMBER_DATA_COLLECT = {
  /** Required at register */
  register: [
    "Email (login + verification link)",
    "Password (hashed by Supabase Auth — we never store plaintext)",
  ],
  /** Soft / optional during profile setup */
  profile: [
    "Display name on viewer profiles (Who’s watching)",
    "Avatar choice (from our catalog)",
    "Kids profile flag",
  ],
  /** When they upgrade after trial — handled by Stripe, not stored as card numbers */
  billingViaStripe: [
    "Name on card (Stripe)",
    "Card number / expiry / CVC (Stripe only — PCI)",
    "Billing country / postal code if Stripe asks (tax / fraud)",
    "Stripe customer id + subscription id (stored by us)",
  ],
  /** Anti-abuse for one free trial per device */
  device: [
    "Anonymous device id (localStorage UUID, hashed server-side)",
    "IP hash (not raw IP long-term) for trial lock",
  ],
  /** We do NOT collect */
  never: [
    "Full street address (unless Stripe Tax later requires)",
    "ID / passport numbers",
    "Card PAN / CVV on our database",
    "Contacts, photos, or unrelated device data",
  ],
} as const;

export const MEMBER_FLOW_COPY = {
  trialFirst:
    "Register with email → verify → 14-day free trial → Who’s watching → watch.",
  cardLater:
    "Before trial ends (or anytime), add a card securely via Stripe. Debit starts on your chosen plan (R55 / R65 / R75). We never see full card numbers.",
  adminExempt:
    "Owner admin accounts bypass trial clocks and device locks.",
} as const;

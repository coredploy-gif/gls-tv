/**
 * What GLS TV collects from members (keep lean).
 * GLS TV uses manual 30-day renewals through Yoco payment links or verified EFT.
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
  /** When they renew after trial */
  billing: [
    "GLS member and payment reference",
    "Chosen 30-day plan and amount",
    "Yoco payment-link identifiers/status or EFT transaction reference",
    "Payment proof note, verification result, receipt and refund record",
  ],
  /** Anti-abuse for one free trial per device */
  device: [
    "Anonymous device id (localStorage UUID, hashed server-side)",
    "IP hash (not raw IP long-term) for trial lock",
    "Hashed device id + browser label for simultaneous adult/Kids stream limits",
    "HttpOnly stream session token tied to the selected viewer profile",
  ],
  /** We do NOT collect */
  never: [
    "Full street address",
    "ID / passport numbers",
    "Card PAN / CVV",
    "Contacts, photos, or unrelated device data",
  ],
} as const;

export const MEMBER_FLOW_COPY = {
  trialFirst:
    "Register with email → verify → 14-day free trial → Who’s watching → watch.",
  renewLater:
    "Before trial ends (or anytime), choose a 30-day R45 / R55 / R65 membership and pay through a Yoco payment link or verified EFT. There is no automatic debit.",
  adminExempt:
    "Owner admin accounts bypass trial clocks and device locks.",
} as const;

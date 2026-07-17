/** Shared helpers for TV QR / device-code sign-in. */

/** Unambiguous alphabet (no 0/O, 1/I/L). */
export const TV_LOGIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const TV_LOGIN_TTL_MS = 10 * 60 * 1000;
export const TV_LOGIN_POLL_MS = 2500;

export type TvLoginStatus =
  | "pending"
  | "approved"
  | "consumed"
  | "expired"
  | "canceled";

export function normalizeUserCode(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  if (cleaned.length !== 8) return "";
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export function isValidUserCode(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && normalizeUserCode(code) === code;
}

export function formatUserCodeDisplay(code: string): string {
  const normalized = normalizeUserCode(code);
  return normalized || code.trim().toUpperCase();
}

/** Cryptographically random XXXX-XXXX display code. */
export function generateUserCode(randomBytes: Uint8Array): string {
  if (randomBytes.length < 8) {
    throw new Error("Need at least 8 random bytes for user code");
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += TV_LOGIN_ALPHABET[randomBytes[i]! % TV_LOGIN_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function generateDeviceSecret(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function tvPairPath(userCode: string): string {
  const code = normalizeUserCode(userCode);
  return `/auth/tv-pair?code=${encodeURIComponent(code)}`;
}

export function resolveTvLoginStatus(row: {
  status: string;
  expires_at: string;
}): TvLoginStatus {
  if (row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  if (
    row.status === "pending" ||
    row.status === "approved" ||
    row.status === "consumed" ||
    row.status === "expired" ||
    row.status === "canceled"
  ) {
    return row.status;
  }
  return "expired";
}

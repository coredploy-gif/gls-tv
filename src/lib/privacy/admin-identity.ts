/**
 * Owner/bootstrap identity — never show personal name or email to members.
 * Keep real addresses only in EADMIN_EMAILS (server env) and audit logs.
 */

/** Public-facing staff label — never the owner’s personal name or email. */
export const PUBLIC_STAFF_LABEL = "GLS Support";

/** Admin-console label for the bootstrap owner (not shown to members). */
export const OWNER_ADMIN_LABEL = "Cassim";

function eadminEmailSet() {
  return new Set(
    (process.env.EADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Strip owner/bootstrap admin identity from anything members (or the public) can see.
 * Keep real email only in server-only admin tools / audit logs.
 */
export function isProtectedAdminIdentity(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return eadminEmailSet().has(email.trim().toLowerCase());
}

/** Safe author label for helpdesk / chat payloads members can read. */
export function publicMessageAuthorLabel(input: {
  authorType: string;
  authorEmail?: string | null;
}): string | null {
  if (input.authorType === "agent" || input.authorType === "system") {
    return PUBLIC_STAFF_LABEL;
  }
  if (isProtectedAdminIdentity(input.authorEmail)) {
    return PUBLIC_STAFF_LABEL;
  }
  return null;
}

/** Leaderboard / public display name — never email local-part for admins. */
export function publicPlayerDisplayName(input: {
  email?: string | null;
  displayName?: string | null;
  fallback?: string;
}): string {
  if (isProtectedAdminIdentity(input.email)) {
    return PUBLIC_STAFF_LABEL;
  }
  const name = (input.displayName || "").trim();
  if (name && !looksLikeEmail(name)) return name.slice(0, 80);
  return input.fallback || "Player";
}

function looksLikeEmail(value: string) {
  return value.includes("@");
}

/** Redact email fields in objects returned to non-admin clients. */
export function redactProtectedEmail(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  if (isProtectedAdminIdentity(email)) return null;
  return email;
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Server-only emergency bootstrap owners. Normal access is database-backed. */
export function eadminEmails(): string[] {
  const fromEnv = (process.env.EADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(fromEnv)];
}

export function isEadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return eadminEmails().includes(email.trim().toLowerCase());
}

export function createServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  )
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Safe diagnostic for admin UI — never returns the key. */
export function serviceRoleStatus() {
  const url = Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim());
  const key = Boolean(
    (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      ""
    ).trim(),
  );
  return {
    ok: url && key,
    hasUrl: url,
    hasServiceRoleKey: key,
    hint: !key
      ? "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role), then restart next dev."
      : !url
        ? "NEXT_PUBLIC_SUPABASE_URL is missing."
        : null,
  };
}

export type StreamSeedRow = {
  slug: string;
  title: string;
  url: string;
  categories: string[];
  countries: string[];
  poster: string;
  backdrop: string;
  is_active: boolean;
  updated_at?: string;
};

export function normalizeSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function isHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/eadmin";

export type FeatureFlagKey =
  | "payments"
  | "playlist_imports"
  | "hls_proxy"
  | "catalog_publish"
  | "signups"
  | "oauth_google"
  | "oauth_apple";

/** Flags that must stay off until an admin explicitly enables them. */
const FAIL_CLOSED_FLAGS = new Set<FeatureFlagKey>([
  "oauth_google",
  "oauth_apple",
]);

export async function isFeatureEnabled(
  key: FeatureFlagKey,
  client: SupabaseClient | null = createServiceClient(),
) {
  // A fresh local database may not yet have the operations migration. Keep
  // localhost usable while preserving the explicit, fail-closed control in
  // every deployed environment. OAuth providers always default off.
  const allowLocalFallback =
    process.env.NODE_ENV !== "production" && !FAIL_CLOSED_FLAGS.has(key);
  if (!client) return allowLocalFallback;
  const { data, error } = await client
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return allowLocalFallback;
  return data.enabled === true;
}

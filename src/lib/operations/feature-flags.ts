import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/eadmin";

export type FeatureFlagKey =
  | "payments"
  | "playlist_imports"
  | "hls_proxy"
  | "catalog_publish"
  | "signups";

export async function isFeatureEnabled(
  key: FeatureFlagKey,
  client: SupabaseClient | null = createServiceClient(),
) {
  // A fresh local database may not yet have the operations migration. Keep
  // localhost usable while preserving the explicit, fail-closed control in
  // every deployed environment.
  const allowLocalFallback = process.env.NODE_ENV !== "production";
  if (!client) return allowLocalFallback;
  const { data, error } = await client
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return allowLocalFallback;
  return data.enabled === true;
}

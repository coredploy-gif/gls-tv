import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/eadmin";

export type FeatureFlagKey =
  | "payments"
  | "playlist_imports"
  | "hls_proxy"
  | "catalog_publish";

export async function isFeatureEnabled(
  key: FeatureFlagKey,
  client: SupabaseClient | null = createServiceClient(),
) {
  if (!client) return false;
  const { data, error } = await client
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  return !error && data?.enabled === true;
}

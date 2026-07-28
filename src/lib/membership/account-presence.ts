import type { SupabaseClient } from "@supabase/supabase-js";

/** Mark the signed-in account as recently active (admin Online), with or without a device session. */
export async function touchAccountPresence(
  service: SupabaseClient,
  userId: string,
  opts?: { streaming?: boolean },
) {
  const now = new Date().toISOString();
  const patch: { last_seen_at: string; last_stream_at?: string } = {
    last_seen_at: now,
  };
  if (opts?.streaming) {
    patch.last_stream_at = now;
  }
  const { error } = await service.from("profiles").update(patch).eq("id", userId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, at: now };
}

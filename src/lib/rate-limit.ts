import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/eadmin";

export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function hashRateKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Durable sliding-window counter via api_rate_limits (service role).
 * Returns true if the request is allowed.
 */
export async function consumeRateLimit(opts: {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const service = createServiceClient();
  if (!service) {
    // Fail closed for public spam surfaces when service role is missing.
    return { allowed: false, remaining: 0 };
  }

  const keyHash = hashRateKey(opts.key);
  const windowMs = Math.max(1_000, opts.windowMs);
  const windowStart = new Date(
    Math.floor(Date.now() / windowMs) * windowMs,
  ).toISOString();

  const { data: existing } = await service
    .from("api_rate_limits")
    .select("hit_count")
    .eq("bucket", opts.bucket)
    .eq("key_hash", keyHash)
    .eq("window_started_at", windowStart)
    .maybeSingle();

  const hits = (existing?.hit_count as number | undefined) || 0;
  if (hits >= opts.limit) {
    return { allowed: false, remaining: 0 };
  }

  const next = hits + 1;
  const { error } = await service.from("api_rate_limits").upsert(
    {
      bucket: opts.bucket,
      key_hash: keyHash,
      window_started_at: windowStart,
      hit_count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bucket,key_hash,window_started_at" },
  );

  if (error) {
    // Fail closed on write errors for public endpoints.
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: Math.max(0, opts.limit - next) };
}

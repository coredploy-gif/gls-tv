import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Health sweep for channel_sources.
 * Auth: Authorization: Bearer <CRON_SECRET>  (set secret in Supabase)
 * Schedule: every 10–15 minutes via Supabase cron / external ping.
 *
 * Check is lightweight: GET playlist with 2.5s timeout.
 * healthy = 2xx + #EXTM3U; degraded = slow/ok-ish; dead = fail.
 * Then rollup_channel_health() picks best mirror.
 */

const TIMEOUT_MS = 2500;
const BATCH = 40;

type SourceRow = {
  id: string;
  channel_id: string;
  url: string;
  priority: number;
  fail_count: number;
};

async function pingPlaylist(url: string): Promise<{
  ok: boolean;
  latency: number;
  status: number;
}> {
  const started = Date.now();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "GLS-TV-Health/1.0",
        Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
      },
    });
    const text = await res.text();
    const latency = Date.now() - started;
    const ok =
      res.ok && /#EXTM3U/i.test(text) && latency <= TIMEOUT_MS;
    return { ok, latency, status: res.status };
  } catch {
    return { ok: false, latency: Date.now() - started, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const auth = req.headers.get("Authorization") || "";
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const okAuth = auth === `Bearer ${cronSecret}`;

  if (!okAuth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data: sources, error } = await sb
    .from("channel_sources")
    .select("id, channel_id, url, priority, fail_count")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (sources || []) as SourceRow[];
  const channelIds = new Set<string>();
  let healthy = 0;
  let dead = 0;

  for (const row of rows) {
    const result = await pingPlaylist(row.url);
    const now = new Date().toISOString();
    channelIds.add(row.channel_id);

    if (result.ok) {
      healthy += 1;
      await sb
        .from("channel_sources")
        .update({
          health_status: result.latency > 1800 ? "degraded" : "healthy",
          latency_ms: result.latency,
          last_checked_at: now,
          last_ok_at: now,
          fail_count: 0,
          updated_at: now,
        })
        .eq("id", row.id);
    } else {
      dead += 1;
      const fails = (row.fail_count || 0) + 1;
      await sb
        .from("channel_sources")
        .update({
          health_status: fails >= 2 ? "dead" : "degraded",
          latency_ms: result.latency,
          last_checked_at: now,
          fail_count: fails,
          updated_at: now,
        })
        .eq("id", row.id);
    }
  }

  for (const id of channelIds) {
    await sb.rpc("rollup_channel_health", { p_channel_id: id });
  }

  return Response.json({
    ok: true,
    checked: rows.length,
    healthy,
    dead,
    channels_updated: channelIds.size,
    at: new Date().toISOString(),
  });
});

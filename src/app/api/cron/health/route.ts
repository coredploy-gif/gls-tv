import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Local/Vercel cron backup for health-sweep Edge Function.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    req.nextUrl.searchParams.get("secret") === secret
  );
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const edge =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
      ".supabase.co",
      ".supabase.co/functions/v1/health-sweep",
    ) || "";

  // Prefer invoking Edge Function so one code path owns health
  if (edge && process.env.CRON_SECRET) {
    try {
      const res = await fetch(edge, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      const json = await res.json();
      return NextResponse.json({ via: "edge", ...json }, { status: res.status });
    } catch (e) {
      console.warn("edge invoke failed", e);
    }
  }

  // Fallback: light local sweep with service role
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      {
        error:
          "Set CRON_SECRET + Edge Function, or SUPABASE_SERVICE_ROLE_KEY for local sweep",
      },
      { status: 500 },
    );
  }

  const sb = createClient(url, key);
  const { data: sources, error } = await sb
    .from("channel_sources")
    .select("id, channel_id, url, fail_count")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let healthy = 0;
  let dead = 0;
  const channels = new Set<string>();

  for (const row of sources || []) {
    channels.add(row.channel_id);
    const started = Date.now();
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2500);
      const res = await fetch(row.url, {
        signal: ac.signal,
        headers: { "User-Agent": "GLS-TV-Health/1.0" },
        redirect: "follow",
      });
      const text = await res.text();
      clearTimeout(t);
      const latency = Date.now() - started;
      const ok = res.ok && /#EXTM3U/i.test(text);
      if (ok) {
        healthy += 1;
        await sb
          .from("channel_sources")
          .update({
            health_status: latency > 1800 ? "degraded" : "healthy",
            latency_ms: latency,
            last_checked_at: new Date().toISOString(),
            last_ok_at: new Date().toISOString(),
            fail_count: 0,
          })
          .eq("id", row.id);
      } else {
        dead += 1;
        const fails = (row.fail_count || 0) + 1;
        await sb
          .from("channel_sources")
          .update({
            health_status: fails >= 2 ? "dead" : "degraded",
            latency_ms: latency,
            last_checked_at: new Date().toISOString(),
            fail_count: fails,
          })
          .eq("id", row.id);
      }
    } catch {
      dead += 1;
      await sb
        .from("channel_sources")
        .update({
          health_status: "dead",
          last_checked_at: new Date().toISOString(),
          fail_count: (row.fail_count || 0) + 1,
        })
        .eq("id", row.id);
    }
  }

  for (const id of channels) {
    await sb.rpc("rollup_channel_health", { p_channel_id: id });
  }

  const { recordCronRun } = await import("@/lib/admin/audit");
  await recordCronRun(
    sb,
    "health",
    dead > 0 ? "partial" : "ok",
    `checked=${sources?.length || 0} healthy=${healthy} dead=${dead}`,
    { healthy, dead, checked: sources?.length || 0 },
  );

  return NextResponse.json({
    via: "local",
    checked: sources?.length || 0,
    healthy,
    dead,
  });
}

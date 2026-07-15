import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Heal cron entrypoint.
 * Protect with CRON_SECRET:
 *   Authorization: Bearer <CRON_SECRET>
 *   or ?secret=<CRON_SECRET>
 *
 * Local / Vercel Cron / Windows Task Scheduler can hit this.
 * On serverless hosts, prefer running `npm run heal` in CI and committing JSON.
 */
export async function GET(req: NextRequest) {
  return runHeal(req);
}

export async function POST(req: NextRequest) {
  return runHeal(req);
}

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Dev convenience: allow without secret only in development
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

async function runHeal(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const script = path.join(process.cwd(), "scripts", "heal-playable.mjs");
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      hint: "Run without dry=1 to execute npm heal, or use `npm run heal` locally.",
    });
  }

  // Prefer spawning local heal when filesystem is writable (local / long-running Node)
  const result = await new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (err) =>
      resolve({ code: 1, stdout: "", stderr: String(err) }),
    );
  });

  let report: unknown = null;
  try {
    const fs = await import("fs");
    const reportPath = path.join(
      process.cwd(),
      "src",
      "data",
      "generated",
      "heal-report.json",
    );
    if (fs.existsSync(reportPath)) {
      report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    }
  } catch {
    /* ignore */
  }

  try {
    const { createServiceClient } = await import("@/lib/eadmin");
    const { recordCronRun } = await import("@/lib/admin/audit");
    const service = createServiceClient();
    if (service) {
      await recordCronRun(
        service,
        "heal",
        result.code === 0 ? "ok" : "error",
        result.code === 0 ? "heal completed" : `exit ${result.code}`,
        { code: result.code },
      );
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: result.code === 0,
    code: result.code,
    report,
    tail: result.stdout.slice(-2000),
    stderr: result.stderr.slice(-1000),
  });
}

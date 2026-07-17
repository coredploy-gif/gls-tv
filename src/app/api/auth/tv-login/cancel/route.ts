import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** TV cancels an in-progress pairing session. */
export async function POST(req: NextRequest) {
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "TV sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }

  let body: { secret?: string };
  try {
    body = (await req.json()) as { secret?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const secret = body.secret?.trim() || "";
  if (secret.length < 32) {
    return NextResponse.json({ error: "Invalid device secret." }, { status: 400 });
  }

  const ip = clientIp(req);
  const rate = await consumeRateLimit({
    bucket: "tv_login_cancel",
    key: ip,
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { data, error } = await service
    .from("tv_device_logins")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      session_token_hash: null,
    })
    .eq("device_secret", secret)
    .in("status", ["pending", "approved"])
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not cancel pairing." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, canceled: Boolean(data) });
}

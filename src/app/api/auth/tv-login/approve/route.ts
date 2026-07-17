import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import {
  isValidUserCode,
  normalizeUserCode,
  resolveTvLoginStatus,
} from "@/lib/auth/tv-login";

export const runtime = "nodejs";

/** Phone confirms pairing after the user is signed in. */
export async function POST(req: NextRequest) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { error: "Sign in on your phone first, then confirm pairing." },
      { status: 401 },
    );
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "TV pairing is temporarily unavailable." },
      { status: 503 },
    );
  }

  const ip = clientIp(req);
  const rate = await consumeRateLimit({
    bucket: "tv_login_approve",
    key: `${user.id}:${ip}`,
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many confirmations. Please wait and try again." },
      { status: 429 },
    );
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userCode = normalizeUserCode(body.code || "");
  if (!isValidUserCode(userCode)) {
    return NextResponse.json(
      { error: "Enter the 8-character code shown on your TV." },
      { status: 400 },
    );
  }

  const { data: row, error } = await service
    .from("tv_device_logins")
    .select("id, status, expires_at")
    .eq("user_code", userCode)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json(
      { error: "Code not found or already used. Check the TV screen." },
      { status: 404 },
    );
  }

  const status = resolveTvLoginStatus(row);
  if (status === "expired") {
    await service
      .from("tv_device_logins")
      .update({ status: "expired" })
      .eq("id", row.id)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "This code expired. Start again on the TV." },
      { status: 410 },
    );
  }

  if (status !== "pending" && status !== "approved") {
    return NextResponse.json(
      { error: "This code is no longer available." },
      { status: 409 },
    );
  }

  // Already approved by this same user — idempotent success
  if (status === "approved") {
    return NextResponse.json({ ok: true, status: "approved" });
  }

  const { data: linkData, error: linkErr } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("[tv-login/approve] generateLink", linkErr?.message);
    return NextResponse.json(
      { error: "Could not authorize the TV. Please try again." },
      { status: 500 },
    );
  }

  const { data: updated, error: updateErr } = await service
    .from("tv_device_logins")
    .update({
      status: "approved",
      user_id: user.id,
      session_token_hash: tokenHash,
      approved_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: "This code was claimed by another device. Start again on the TV." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: "approved" });
}

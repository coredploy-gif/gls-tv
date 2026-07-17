import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { resolveTvLoginStatus } from "@/lib/auth/tv-login";

export const runtime = "nodejs";

/**
 * TV polls with device_secret until the phone approves.
 * On first approved poll, returns a one-time token_hash for verifyOtp and marks consumed.
 */
export async function GET(req: NextRequest) {
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "TV sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }

  const secret = req.nextUrl.searchParams.get("secret")?.trim() || "";
  if (secret.length < 32) {
    return NextResponse.json({ error: "Invalid device secret." }, { status: 400 });
  }

  const ip = clientIp(req);
  const rate = await consumeRateLimit({
    bucket: "tv_login_poll",
    key: `${ip}:${secret.slice(0, 16)}`,
    limit: 120,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many polls." }, { status: 429 });
  }

  const { data: row, error } = await service
    .from("tv_device_logins")
    .select(
      "id, status, expires_at, session_token_hash, user_id, approved_at",
    )
    .eq("device_secret", secret)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Pairing session not found." }, { status: 404 });
  }

  const status = resolveTvLoginStatus(row);

  if (status === "expired" && row.status === "pending") {
    await service
      .from("tv_device_logins")
      .update({ status: "expired" })
      .eq("id", row.id)
      .eq("status", "pending");
  }

  if (status === "pending" || status === "expired" || status === "canceled") {
    return NextResponse.json({ status, expiresAt: row.expires_at });
  }

  if (status === "consumed") {
    return NextResponse.json({
      status: "consumed",
      message: "This code was already used. Start again on the TV.",
    });
  }

  // status === approved — hand over one-time session token
  const tokenHash = row.session_token_hash as string | null;
  if (!tokenHash || !row.user_id) {
    return NextResponse.json(
      { error: "Pairing incomplete. Ask the phone to confirm again." },
      { status: 409 },
    );
  }

  const { data: userData, error: userErr } = await service.auth.admin.getUserById(
    row.user_id as string,
  );
  if (userErr || !userData.user?.email) {
    return NextResponse.json(
      { error: "Could not load the linked account." },
      { status: 500 },
    );
  }

  const { data: claimed, error: claimErr } = await service
    .from("tv_device_logins")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      session_token_hash: null,
    })
    .eq("id", row.id)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    return NextResponse.json({
      status: "consumed",
      message: "This code was already used. Start again on the TV.",
    });
  }

  return NextResponse.json({
    status: "ready",
    tokenHash,
    email: userData.user.email,
    expiresAt: row.expires_at,
  });
}

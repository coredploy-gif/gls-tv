import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { createServiceClient } from "@/lib/eadmin";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import {
  generateDeviceSecret,
  generateUserCode,
  TV_LOGIN_TTL_MS,
  tvPairPath,
} from "@/lib/auth/tv-login";

export const runtime = "nodejs";

async function uniqueUserCode(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const userCode = generateUserCode(bytes);
    const { data } = await service
      .from("tv_device_logins")
      .select("id")
      .eq("user_code", userCode)
      .in("status", ["pending", "approved"])
      .maybeSingle();
    if (!data) return userCode;
  }
  throw new Error("Could not allocate a unique TV login code");
}

/** Start a TV device pairing session (QR + short code). */
export async function POST(req: NextRequest) {
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "TV sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }

  const ip = clientIp(req);
  const rate = await consumeRateLimit({
    bucket: "tv_login_start",
    key: ip,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many pairing attempts. Please wait and try again." },
      { status: 429 },
    );
  }

  try {
    const userCode = await uniqueUserCode(service);
    const deviceSecret = generateDeviceSecret();
    const expiresAt = new Date(Date.now() + TV_LOGIN_TTL_MS).toISOString();
    const pairPath = tvPairPath(userCode);
    const origin = siteUrl(req.nextUrl.origin);
    const pairUrl = `${origin}${pairPath}`;

    const { error } = await service.from("tv_device_logins").insert({
      user_code: userCode,
      device_secret: deviceSecret,
      status: "pending",
      expires_at: expiresAt,
      user_agent: req.headers.get("user-agent")?.slice(0, 400) || null,
      ip_hash: ip === "unknown" ? null : ip.slice(0, 64),
    });

    if (error) {
      console.error("[tv-login/start]", error.message);
      return NextResponse.json(
        { error: "Could not start TV pairing." },
        { status: 500 },
      );
    }

    const qrDataUrl = await QRCode.toDataURL(pairUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 420,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    });

    return NextResponse.json({
      userCode,
      deviceSecret,
      expiresAt,
      pairUrl,
      qrDataUrl,
      pollMs: 2500,
    });
  } catch (err) {
    console.error("[tv-login/start]", err);
    return NextResponse.json(
      { error: "Could not start TV pairing." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { clientIp, consumeRateLimit, hashRateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9()\s-]{7,24}$/;

export async function POST(req: NextRequest) {
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "Contact service temporarily unavailable" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot — bots fill hidden fields
  if (String(body.website || body.company || "").trim()) {
    return NextResponse.json({
      ok: true,
      message: "GLS will get back to you as soon as possible.",
    });
  }

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone || body.contactNumber || "")
    .trim()
    .slice(0, 40);
  const message = String(body.message || "").trim().slice(0, 4000);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "Enter a valid contact number (7–24 digits)" },
      { status: 400 },
    );
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: "Message must be at least 10 characters" },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  const emailLimit = await consumeRateLimit({
    bucket: "contact_email",
    key: `email:${email}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  const ipLimit = await consumeRateLimit({
    bucket: "contact_ip",
    key: `ip:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!emailLimit.allowed || !ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please try again later." },
      { status: 429 },
    );
  }

  const { error } = await service.from("contact_enquiries").insert({
    name: name || "Guest",
    email,
    phone,
    message,
    status: "new",
    ip_hash: hashRateKey(ip),
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "GLS will get back to you as soon as possible.",
  });
}

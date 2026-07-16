import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const TICKET_TTL_SECONDS = 4 * 60 * 60;

function signingSecret() {
  return (
    process.env.HLS_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function sessionBinding(sessionToken: string | null) {
  return createHash("sha256")
    .update(sessionToken || "eadmin-no-viewer-session")
    .digest("base64url");
}

function payload(
  channelId: string,
  target: string,
  expiresAt: number,
  sessionToken: string | null,
) {
  return [
    "gls-hls-v1",
    channelId,
    target,
    String(expiresAt),
    sessionBinding(sessionToken),
  ].join("\n");
}

export function issueHlsTicket(
  channelId: string,
  target: string,
  sessionToken: string | null,
  now = Date.now(),
) {
  const secret = signingSecret();
  if (!secret) return null;
  const expiresAt = Math.floor(now / 1000) + TICKET_TTL_SECONDS;
  const signature = createHmac("sha256", secret)
    .update(payload(channelId, target, expiresAt, sessionToken))
    .digest("base64url");
  return { expiresAt, signature };
}

export function verifyHlsTicket(
  channelId: string,
  target: string,
  expiresAt: number,
  signature: string,
  sessionToken: string | null,
  now = Date.now(),
) {
  const secret = signingSecret();
  if (
    !secret ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < Math.floor(now / 1000) ||
    expiresAt > Math.floor(now / 1000) + TICKET_TTL_SECONDS + 60 ||
    !signature
  ) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(payload(channelId, target, expiresAt, sessionToken))
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

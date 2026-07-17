import { createHash, timingSafeEqual } from "crypto";

/** PHP-compatible urlencode: spaces as +, hex uppercase. */
export function pfUrlEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) =>
      `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

export function payfastConfigured() {
  return Boolean(
    process.env.PAYFAST_MERCHANT_ID?.trim() &&
      process.env.PAYFAST_MERCHANT_KEY?.trim(),
  );
}

export function payfastSandbox() {
  const raw = (process.env.PAYFAST_SANDBOX || "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function payfastHost() {
  return payfastSandbox() ? "sandbox.payfast.co.za" : "www.payfast.co.za";
}

export function payfastProcessUrl() {
  return `https://${payfastHost()}/eng/process`;
}

export function payfastValidateUrl() {
  return `https://${payfastHost()}/eng/query/validate`;
}

export function payfastCredentials() {
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID?.trim() || "",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY?.trim() || "",
    passphrase: process.env.PAYFAST_PASSPHRASE?.trim() || "",
  };
}

/**
 * Signature for checkout form fields.
 * Order must match attribute order (not alphabetical).
 */
export function generatePayfastSignature(
  data: Record<string, string>,
  passphrase?: string | null,
) {
  const pairs: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "signature") continue;
    if (val === "" || val == null) continue;
    pairs.push(`${key}=${pfUrlEncode(String(val))}`);
  }
  let paramString = pairs.join("&");
  const pass = passphrase?.trim();
  if (pass) {
    paramString += `&passphrase=${pfUrlEncode(pass)}`;
  }
  return createHash("md5").update(paramString).digest("hex");
}

/**
 * ITN signature: concatenate pairs in received order (excluding signature).
 */
export function verifyPayfastItnSignature(
  orderedEntries: Array<[string, string]>,
  receivedSignature: string,
  passphrase?: string | null,
) {
  const pairs: string[] = [];
  for (const [key, val] of orderedEntries) {
    if (key === "signature") continue;
    pairs.push(`${key}=${pfUrlEncode(val)}`);
  }
  let paramString = pairs.join("&");
  const pass = passphrase?.trim();
  if (pass) {
    paramString += `&passphrase=${pfUrlEncode(pass)}`;
  }
  const expected = createHash("md5").update(paramString).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(receivedSignature.trim().toLowerCase());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function siteOrigin(fallbackOrigin?: string | null) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return "https://gls-tv.vercel.app";
}

export type PayfastCheckoutFields = Record<string, string>;

export function buildPayfastCheckout(input: {
  paymentId: string;
  paymentReference: string;
  amountCents: number;
  itemName: string;
  email?: string | null;
  nameFirst?: string | null;
  nameLast?: string | null;
  origin?: string | null;
  subscription?: {
    billingDateIso: string;
    recurringAmountCents: number;
  };
}): { actionUrl: string; fields: PayfastCheckoutFields } | null {
  if (!payfastConfigured()) return null;
  const { merchantId, merchantKey, passphrase } = payfastCredentials();
  const origin = siteOrigin(input.origin);
  const amount = (input.amountCents / 100).toFixed(2);
  const fields: PayfastCheckoutFields = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${origin}/pricing/pay/${input.paymentId}?payfast=return`,
    cancel_url: `${origin}/pricing/pay/${input.paymentId}?payfast=cancel`,
    notify_url: `${origin}/api/payfast/itn`,
  };
  const first = (input.nameFirst || "").trim().slice(0, 100);
  const last = (input.nameLast || "").trim().slice(0, 100);
  const email = (input.email || "").trim().slice(0, 100);
  if (first) fields.name_first = first;
  if (last) fields.name_last = last;
  if (email) fields.email_address = email;
  fields.m_payment_id = input.paymentReference.slice(0, 100);
  fields.amount = amount;
  fields.item_name = input.itemName.slice(0, 100);
  if (input.subscription) {
    fields.subscription_type = "1";
    fields.billing_date = input.subscription.billingDateIso;
    fields.recurring_amount = (
      input.subscription.recurringAmountCents / 100
    ).toFixed(2);
    fields.frequency = "3";
    fields.cycles = "0";
  }
  fields.signature = generatePayfastSignature(fields, passphrase || null);
  return { actionUrl: payfastProcessUrl(), fields };
}

/** Confirm ITN payload with PayFast (server-to-server). */
export async function confirmPayfastItn(paramString: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(payfastValidateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: paramString,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = (await response.text()).trim().toUpperCase();
    return text === "VALID";
  } finally {
    clearTimeout(timeout);
  }
}

export function parsePayfastFormBody(rawBody: string): {
  data: Record<string, string>;
  ordered: Array<[string, string]>;
  paramString: string;
} {
  const ordered: Array<[string, string]> = [];
  const data: Record<string, string> = {};
  const params = new URLSearchParams(rawBody);
  for (const [key, value] of params.entries()) {
    ordered.push([key, value]);
    data[key] = value;
  }
  const pairs: string[] = [];
  for (const [key, val] of ordered) {
    if (key === "signature") continue;
    pairs.push(`${key}=${pfUrlEncode(val)}`);
  }
  return { data, ordered, paramString: pairs.join("&") };
}

/** Official PayFast ITN source ranges (developers.payfast.co.za). */
const PAYFAST_ITN_CIDRS = [
  "197.97.145.144/28",
  "41.74.179.192/27",
  "102.216.36.0/28",
  "102.216.36.128/28",
  "144.126.193.139/32",
] as const;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const ipN = ipv4ToInt(ip);
  const baseN = ipv4ToInt(base || "");
  if (ipN == null || baseN == null) return false;
  const bits = Number(bitsRaw ?? 32);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

/** Client IP for ITN (honours first X-Forwarded-For hop on Vercel). */
export function payfastRequestIp(req: {
  headers: { get(name: string): string | null };
}): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Optional ITN IP gate. Set PAYFAST_SKIP_IP_CHECK=true if a proxy strips the
 * real source (signature + server validate still apply).
 */
export function isPayfastItnIpAllowed(ip: string | null): boolean {
  const skip = (process.env.PAYFAST_SKIP_IP_CHECK || "")
    .trim()
    .toLowerCase();
  if (skip === "1" || skip === "true" || skip === "yes") return true;
  if (!ip) return payfastSandbox(); // sandbox ITNs can be flaky behind CDNs
  return PAYFAST_ITN_CIDRS.some((cidr) => ipInCidr(ip, cidr));
}


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

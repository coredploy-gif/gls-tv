import { createHash } from "crypto";
import { TRIAL_DAYS } from "@/lib/membership/plans";

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  return hashToken(`gls-ip:${ip.trim()}`);
}

export function hashDevice(deviceId: string) {
  return hashToken(`gls-device:${deviceId.trim()}`);
}

export function trialBlockUntil(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

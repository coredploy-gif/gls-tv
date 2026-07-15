import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adultLimitForPlan,
  VIEWER_SESSION_COOKIE,
} from "@/lib/membership/plans";
import { hashDevice } from "@/lib/membership/device";

export { VIEWER_SESSION_COOKIE };
/** Idle sessions stop counting toward simultaneous slots after this. */
export const VIEWER_SESSION_TTL_MS = 30 * 60_000;

export type ViewerAudience = "adult" | "kids";

export type ViewerDeviceSession = {
  id: string;
  user_id: string;
  viewer_profile_id: string;
  session_token: string;
  device_hash: string;
  device_label: string | null;
  audience: ViewerAudience;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  revoked_at: string | null;
  viewer_name?: string | null;
  is_current?: boolean;
};

export function kidsLimitForPlan(_plan?: string | null) {
  return 1;
}

export function deviceLabelFromUserAgent(ua: string | null | undefined) {
  const value = (ua || "").trim();
  if (!value) return "Unknown device";
  const browser =
    /Edg\//i.test(value)
      ? "Edge"
      : /Chrome\//i.test(value) && !/Chromium/i.test(value)
        ? "Chrome"
        : /Firefox\//i.test(value)
          ? "Firefox"
          : /Safari\//i.test(value) && !/Chrome/i.test(value)
            ? "Safari"
            : /SamsungBrowser/i.test(value)
              ? "Samsung Internet"
              : "Browser";
  const os =
    /Windows NT/i.test(value)
      ? "Windows"
      : /Android/i.test(value)
        ? "Android"
        : /iPhone|iPad|iPod/i.test(value)
          ? "iOS"
          : /Mac OS X/i.test(value)
            ? "Mac"
            : /Linux/i.test(value)
              ? "Linux"
              : "Device";
  return `${browser} · ${os}`;
}

function activeSinceIso() {
  return new Date(Date.now() - VIEWER_SESSION_TTL_MS).toISOString();
}

export async function listActiveViewerSessions(
  service: SupabaseClient,
  userId: string,
) {
  const { data, error } = await service
    .from("viewer_device_sessions")
    .select(
      "id, user_id, viewer_profile_id, session_token, device_hash, device_label, audience, user_agent, last_active_at, created_at, revoked_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gte("last_active_at", activeSinceIso())
    .order("last_active_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ViewerDeviceSession[];
}

export async function listManagedViewerSessions(
  service: SupabaseClient,
  userId: string,
  currentToken?: string | null,
) {
  const { data, error } = await service
    .from("viewer_device_sessions")
    .select(
      "id, user_id, viewer_profile_id, session_token, device_hash, device_label, audience, user_agent, last_active_at, created_at, revoked_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);

  const rows = (data || []) as ViewerDeviceSession[];
  const viewerIds = [...new Set(rows.map((row) => row.viewer_profile_id))];
  const { data: viewers } = viewerIds.length
    ? await service
        .from("viewer_profiles")
        .select("id, name, is_kids")
        .in("id", viewerIds)
    : { data: [] as Array<{ id: string; name: string; is_kids: boolean }> };

  const names = new Map((viewers || []).map((v) => [v.id, v.name]));
  return rows.map((row) => ({
    ...row,
    viewer_name: names.get(row.viewer_profile_id) || null,
    is_current: Boolean(currentToken && row.session_token === currentToken),
    active:
      !row.revoked_at &&
      new Date(row.last_active_at).getTime() >= Date.now() - VIEWER_SESSION_TTL_MS,
  }));
}

export async function claimViewerDeviceSession(input: {
  service: SupabaseClient;
  userId: string;
  plan: string | null | undefined;
  viewerProfileId: string;
  isKids: boolean;
  deviceId: string;
  userAgent?: string | null;
  existingToken?: string | null;
}) {
  const audience: ViewerAudience = input.isKids ? "kids" : "adult";
  const deviceHash = hashDevice(input.deviceId || input.userId);
  const label = deviceLabelFromUserAgent(input.userAgent);
  const adultLimit = adultLimitForPlan(input.plan);
  const kidsLimit = kidsLimitForPlan(input.plan);
  const now = new Date().toISOString();

  const { data: existingForDevice } = await input.service
    .from("viewer_device_sessions")
    .select("*")
    .eq("user_id", input.userId)
    .eq("device_hash", deviceHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (existingForDevice) {
    if (existingForDevice.audience !== audience) {
      const active = await listActiveViewerSessions(input.service, input.userId);
      const adultCount = active.filter(
        (row) => row.audience === "adult" && row.id !== existingForDevice.id,
      ).length;
      const kidsCount = active.filter(
        (row) => row.audience === "kids" && row.id !== existingForDevice.id,
      ).length;
      if (
        (audience === "adult" && adultCount >= adultLimit) ||
        (audience === "kids" && kidsCount >= kidsLimit)
      ) {
        const kind = audience === "kids" ? "Kids" : "adult";
        const limit = audience === "kids" ? kidsLimit : adultLimit;
        return {
          ok: false as const,
          code: "DEVICE_LIMIT" as const,
          error: `All ${limit} ${kind} stream${limit === 1 ? "" : "s"} are already in use. Sign out a device in Account settings, then try again.`,
          adultLimit,
          kidsLimit,
          adultActive: adultCount,
          kidsActive: kidsCount,
        };
      }
    }
    const { data: updated, error } = await input.service
      .from("viewer_device_sessions")
      .update({
        viewer_profile_id: input.viewerProfileId,
        audience,
        device_label: label,
        user_agent: input.userAgent || null,
        last_active_at: now,
      })
      .eq("id", existingForDevice.id)
      .eq("user_id", input.userId)
      .is("revoked_at", null)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return {
      ok: true as const,
      session: updated as ViewerDeviceSession,
      reusedDevice: true,
    };
  }

  const active = await listActiveViewerSessions(input.service, input.userId);
  const adultCount = active.filter((row) => row.audience === "adult").length;
  const kidsCount = active.filter((row) => row.audience === "kids").length;
  const atAdultCap = audience === "adult" && adultCount >= adultLimit;
  const atKidsCap = audience === "kids" && kidsCount >= kidsLimit;

  if (atAdultCap || atKidsCap) {
    const kind = audience === "kids" ? "Kids" : "adult";
    const limit = audience === "kids" ? kidsLimit : adultLimit;
    return {
      ok: false as const,
      code: "DEVICE_LIMIT" as const,
      error: `All ${limit} ${kind} stream${limit === 1 ? "" : "s"} are already in use. Sign out a device in Account settings, then try again.`,
      adultLimit,
      kidsLimit,
      adultActive: adultCount,
      kidsActive: kidsCount,
    };
  }

  const sessionToken = randomBytes(32).toString("hex");
  const { data: created, error } = await input.service
    .from("viewer_device_sessions")
    .insert({
      user_id: input.userId,
      viewer_profile_id: input.viewerProfileId,
      session_token: sessionToken,
      device_hash: deviceHash,
      device_label: label,
      audience,
      user_agent: input.userAgent || null,
      last_active_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return {
        ok: false as const,
        code: "DEVICE_LIMIT" as const,
        error:
          "This device could not claim a stream slot. Sign out another device in Account settings, then try again.",
      };
    }
    return { ok: false as const, error: error.message };
  }

  if (input.existingToken) {
    await input.service
      .from("viewer_device_sessions")
      .update({ revoked_at: now })
      .eq("user_id", input.userId)
      .eq("session_token", input.existingToken)
      .is("revoked_at", null)
      .neq("id", created.id);
  }

  return {
    ok: true as const,
    session: created as ViewerDeviceSession,
    reusedDevice: false,
  };
}

export async function touchViewerDeviceSession(
  service: SupabaseClient,
  userId: string,
  sessionToken: string,
) {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("viewer_device_sessions")
    .update({ last_active_at: now })
    .eq("user_id", userId)
    .eq("session_token", sessionToken)
    .is("revoked_at", null)
    .gte("last_active_at", activeSinceIso())
    .select("id, viewer_profile_id, audience, last_active_at")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Session expired or signed out" };
  return { ok: true as const, session: data };
}

export async function validateViewerDeviceSession(
  service: SupabaseClient,
  userId: string,
  sessionToken: string | null | undefined,
  viewerProfileId?: string | null,
) {
  if (!sessionToken) return { ok: false as const, reason: "missing_session" as const };
  const { data, error } = await service
    .from("viewer_device_sessions")
    .select("id, viewer_profile_id, audience, last_active_at")
    .eq("user_id", userId)
    .eq("session_token", sessionToken)
    .is("revoked_at", null)
    .gte("last_active_at", activeSinceIso())
    .maybeSingle();
  if (error || !data) return { ok: false as const, reason: "invalid_session" as const };
  if (viewerProfileId && data.viewer_profile_id !== viewerProfileId) {
    return { ok: false as const, reason: "viewer_mismatch" as const };
  }
  return { ok: true as const, session: data };
}

export async function revokeViewerDeviceSession(
  service: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("viewer_device_sessions")
    .update({ revoked_at: now })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Device already signed out" };
  return { ok: true as const };
}

export async function revokeAllViewerDeviceSessions(
  service: SupabaseClient,
  userId: string,
) {
  const now = new Date().toISOString();
  const { error } = await service
    .from("viewer_device_sessions")
    .update({ revoked_at: now })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

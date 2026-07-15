import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { VIEWER_SESSION_COOKIE } from "@/lib/membership/plans";
import {
  listManagedViewerSessions,
  revokeAllViewerDeviceSessions,
  revokeViewerDeviceSession,
} from "@/lib/membership/viewer-sessions";
import { adultLimitForPlan } from "@/lib/membership/plans";
import { kidsLimitForPlan } from "@/lib/membership/viewer-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function context() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return { auth, user, service: createServiceClient() };
}

export async function GET(req: NextRequest) {
  const { auth, user, service } = await context();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Account service unavailable" }, { status: 503 });

  const currentToken = req.cookies.get(VIEWER_SESSION_COOKIE)?.value || null;
  const [
    profile,
    preferences,
    deletion,
    { data: sessionData },
    devices,
  ] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, email, member_reference, plan, account_status, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    service
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("account_deletion_requests")
      .select("id, status, requested_at, execute_after, cancelled_at, completed_at")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    auth.auth.getSession(),
    listManagedViewerSessions(service, user.id, currentToken),
  ]);

  const plan = profile.data?.plan || "trial";

  return NextResponse.json({
    account: {
      id: user.id,
      email: user.email,
      emailConfirmedAt: user.email_confirmed_at,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      profile: profile.data,
    },
    preferences: preferences.data || {
      sports: true,
      activity: true,
      product: true,
      email_nonessential: false,
    },
    deletion: deletion.data,
    sessions: {
      current: sessionData.session
        ? {
            expiresAt: sessionData.session.expires_at,
            assuranceLevel:
              sessionData.session.user.aud === "authenticated" ? "authenticated" : "unknown",
          }
        : null,
      deviceListAvailable: true,
      adultLimit: adultLimitForPlan(plan),
      kidsLimit: kidsLimitForPlan(plan),
      note: "Your plan allows simultaneous streams matching adult and Kids profiles. Sign out a device below to free a slot.",
      devices: devices.map((device) => ({
        id: device.id,
        label: device.device_label || "Device",
        audience: device.audience,
        viewerName: device.viewer_name,
        lastActiveAt: device.last_active_at,
        createdAt: device.created_at,
        isCurrent: Boolean(device.is_current),
        active: Boolean(device.active),
      })),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const { auth, user, service } = await context();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Account service unavailable" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");

  if (action === "profile") {
    const displayName = String(body.displayName || "").trim().slice(0, 80);
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Display name is too short" }, { status: 400 });
    }
    const { error } = await auth.rpc("update_own_profile_display_name", {
      p_display_name: displayName,
    });
    return error
      ? NextResponse.json({ error: "Profile could not be updated" }, { status: 400 })
      : NextResponse.json({ ok: true });
  }

  if (action === "preferences") {
    const row = {
      user_id: user.id,
      sports: body.sports !== false,
      activity: body.activity !== false,
      product: body.product !== false,
      email_nonessential: body.emailNonessential === true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await service.from("notification_preferences").upsert(row);
    return error
      ? NextResponse.json({ error: "Preferences could not be saved" }, { status: 500 })
      : NextResponse.json({ ok: true });
  }

  if (action === "password") {
    const currentPassword = String(body.currentPassword || "");
    const password = String(body.password || "");
    if (!user.email || currentPassword.length < 1 || password.length < 8) {
      return NextResponse.json({ error: "Current password and a new 8+ character password are required" }, { status: 400 });
    }
    const verified = await auth.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verified.error) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    const { error } = await auth.auth.updateUser({ password });
    return error
      ? NextResponse.json({ error: "Password could not be changed" }, { status: 400 })
      : NextResponse.json({ ok: true });
  }

  if (action === "email") {
    const email = String(body.email || "").trim().toLowerCase();
    const currentPassword = String(body.currentPassword || "");
    if (!user.email || !email.includes("@") || !currentPassword) {
      return NextResponse.json({ error: "New email and current password are required" }, { status: 400 });
    }
    const verified = await auth.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verified.error) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    const { error } = await auth.auth.updateUser({ email });
    return error
      ? NextResponse.json({ error: "Email change could not be requested" }, { status: 400 })
      : NextResponse.json({ ok: true, confirmationRequired: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { auth, user, service } = await context();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Account service unavailable" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");

  if (action === "revoke_all") {
    await revokeAllViewerDeviceSessions(service, user.id);
    const { error } = await auth.auth.signOut({ scope: "global" });
    const res = error
      ? NextResponse.json({ error: "Sessions could not be revoked" }, { status: 500 })
      : NextResponse.json({ ok: true });
    if (!error) {
      res.cookies.set(VIEWER_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      res.cookies.set("gls_viewer_profile", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  }

  if (action === "revoke_device") {
    const sessionId = String(body.sessionId || "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const currentToken = req.cookies.get(VIEWER_SESSION_COOKIE)?.value || null;
    const { data: before } = await service
      .from("viewer_device_sessions")
      .select("session_token")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();
    const result = await revokeViewerDeviceSession(service, user.id, sessionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const res = NextResponse.json({ ok: true });
    if (before?.session_token && before.session_token === currentToken) {
      res.cookies.set(VIEWER_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      res.cookies.set("gls_viewer_profile", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  }

  if (action === "request_deletion") {
    const confirmation = String(body.confirmation || "");
    const currentPassword = String(body.currentPassword || "");
    if (confirmation !== "DELETE MY ACCOUNT" || !user.email || !currentPassword) {
      return NextResponse.json({ error: "Exact confirmation and current password are required" }, { status: 400 });
    }
    const verified = await auth.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verified.error) return NextResponse.json({ error: "Recent reauthentication failed" }, { status: 403 });
    const executeAfter = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data, error } = await service
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        confirmation_phrase_verified: true,
        execute_after: executeAfter,
      })
      .select("id, status, execute_after")
      .single();
    if (error) return NextResponse.json({ error: "A deletion request is already pending" }, { status: 409 });
    await service
      .from("profiles")
      .update({ account_status: "deletion_pending" })
      .eq("id", user.id);
    return NextResponse.json({ ok: true, deletion: data });
  }

  if (action === "cancel_deletion") {
    const { error } = await service
      .from("account_deletion_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "cooling_off");
    if (!error) {
      await service.from("profiles").update({ account_status: "active" }).eq("id", user.id);
    }
    return error
      ? NextResponse.json({ error: "Deletion could not be cancelled" }, { status: 500 })
      : NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

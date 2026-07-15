import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import {
  ensureDefaultViewers,
  getAccountEntitlement,
  getAccountProfile,
  listAvatarCatalog,
  listViewerProfiles,
} from "@/lib/membership/account";
import {
  ACTIVE_VIEWER_COOKIE,
  VIEWER_SESSION_COOKIE,
  adultLimitForPlan,
  maxViewerSlots,
} from "@/lib/membership/plans";
import {
  claimViewerDeviceSession,
  kidsLimitForPlan,
} from "@/lib/membership/viewer-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieOptions(maxAge: number, httpOnly = false) {
  return {
    path: "/",
    maxAge,
    sameSite: "lax" as const,
    httpOnly,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let viewers = await listViewerProfiles(user.id);
  if (!viewers.length) {
    viewers = await ensureDefaultViewers(user.id, user.email);
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);
  const account = entitlement.account;
  const avatars = await listAvatarCatalog();

  return NextResponse.json({
    viewers,
    avatars,
    plan: account?.plan || "trial",
    adultLimit: adultLimitForPlan(account?.plan),
    maxSlots: maxViewerSlots(account?.plan),
    access: entitlement.allowed,
    trialEndsAt: account?.trial_ends_at,
  });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    deviceId?: string;
    viewerId?: string;
    name?: string;
    avatar_id?: string;
    is_kids?: boolean;
  };

  const action = body.action || "list";

  // Select profile → claim a simultaneous stream slot, then client hard-navigates
  if (action === "select") {
    const viewerId = (body.viewerId || "").trim();
    const deviceId = (body.deviceId || "").trim() || user.id;
    if (!viewerId) {
      return NextResponse.json({ error: "viewerId required" }, { status: 400 });
    }
    const viewers = await listViewerProfiles(user.id);
    const viewer = viewers.find((v) => v.id === viewerId);
    if (!viewer) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const entitlement = await getAccountEntitlement(user.id, user.email);
    if (!entitlement.allowed) {
      const res = NextResponse.json(
        { error: "No active trial or subscription" },
        { status: 403 },
      );
      res.cookies.set(ACTIVE_VIEWER_COOKIE, "", cookieOptions(0));
      res.cookies.set(VIEWER_SESSION_COOKIE, "", cookieOptions(0, true));
      return res;
    }

    const service = createServiceClient();
    if (!service) {
      return NextResponse.json(
        { error: "Device sessions are not configured" },
        { status: 503 },
      );
    }

    const claim = await claimViewerDeviceSession({
      service,
      userId: user.id,
      plan: entitlement.account?.plan,
      viewerProfileId: viewer.id,
      isKids: Boolean(viewer.is_kids),
      deviceId,
      userAgent: req.headers.get("user-agent"),
      existingToken: req.cookies.get(VIEWER_SESSION_COOKIE)?.value || null,
    });

    if (!claim.ok) {
      const status = claim.code === "DEVICE_LIMIT" ? 409 : 500;
      return NextResponse.json(
        {
          error: claim.error,
          code: claim.code || "SESSION_ERROR",
          adultLimit: claim.adultLimit ?? adultLimitForPlan(entitlement.account?.plan),
          kidsLimit: claim.kidsLimit ?? kidsLimitForPlan(entitlement.account?.plan),
          adultActive: claim.adultActive,
          kidsActive: claim.kidsActive,
          manageUrl: "/account#devices",
        },
        { status },
      );
    }

    const redirectTo = viewer.is_kids ? "/kids" : "/browse";
    const res = NextResponse.json({
      ok: true,
      redirectTo,
      viewerId: viewer.id,
      deviceLabel: claim.session.device_label,
    });
    res.cookies.set(
      ACTIVE_VIEWER_COOKIE,
      viewer.id,
      cookieOptions(60 * 60 * 24 * 365),
    );
    res.cookies.set(
      VIEWER_SESSION_COOKIE,
      claim.session.session_token,
      cookieOptions(60 * 60 * 24 * 30, true),
    );
    return res;
  }

  if (action === "create" || action === "update" || action === "delete") {
    const account = await getAccountProfile(user.id);
    const service = createServiceClient() || sb;

    if (action === "delete") {
      const viewerId = (body.viewerId || "").trim();
      const viewers = await listViewerProfiles(user.id);
      const target = viewers.find((v) => v.id === viewerId);
      if (!target) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (viewers.length <= 1) {
        return NextResponse.json(
          { error: "Keep at least one profile" },
          { status: 400 },
        );
      }
      const { error } = await service
        .from("viewer_profiles")
        .delete()
        .eq("id", viewerId)
        .eq("user_id", user.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const next = await listViewerProfiles(user.id);
      return NextResponse.json({ ok: true, viewers: next });
    }

    const name = (body.name || "").trim().slice(0, 40);
    const avatar_id = (body.avatar_id || "avatar-01").trim();
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    if (action === "create") {
      const viewers = await listViewerProfiles(user.id);
      const adults = viewers.filter((v) => !v.is_kids).length;
      const kids = viewers.filter((v) => v.is_kids).length;
      const wantKids = Boolean(body.is_kids);

      if (wantKids && kids >= 1) {
        return NextResponse.json(
          { error: "Kids profile already exists" },
          { status: 400 },
        );
      }
      if (!wantKids && adults >= adultLimitForPlan(account?.plan)) {
        return NextResponse.json(
          {
            error: `Your plan allows ${adultLimitForPlan(account?.plan)} adult profiles. Upgrade for more.`,
          },
          { status: 400 },
        );
      }

      const { data, error } = await service
        .from("viewer_profiles")
        .insert({
          user_id: user.id,
          name,
          avatar_id,
          is_kids: wantKids,
          sort_order: wantKids ? 99 : adults,
        })
        .select("id, user_id, name, avatar_id, is_kids, sort_order")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const next = await listViewerProfiles(user.id);
      return NextResponse.json({ ok: true, viewer: data, viewers: next });
    }

    // update
    const viewerId = (body.viewerId || "").trim();
    if (!viewerId) {
      return NextResponse.json({ error: "viewerId required" }, { status: 400 });
    }
    const { error } = await service
      .from("viewer_profiles")
      .update({
        name,
        avatar_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viewerId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const next = await listViewerProfiles(user.id);
    return NextResponse.json({ ok: true, viewers: next });
  }

  // Default: list + trial claim (same as before)
  const { claimTrialForDevice } = await import("@/lib/membership/account");
  const deviceId = (body.deviceId || "").trim() || user.id;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const claim = await claimTrialForDevice({
    userId: user.id,
    email: user.email ?? null,
    deviceId,
    ip,
  });

  const entitlement = await getAccountEntitlement(user.id, user.email);
  const account = entitlement.account;
  let viewers = await listViewerProfiles(user.id);
  if (!viewers.length) {
    viewers = await ensureDefaultViewers(user.id, user.email);
  }

  if (!claim.ok) {
    return NextResponse.json({
      access: false,
      reason: claim.reason,
      blockedUntil: claim.blockedUntil,
      viewers: [],
      plan: account?.plan,
      trialEndsAt: account?.trial_ends_at,
    });
  }

  return NextResponse.json({
    access: entitlement.allowed,
    reason: entitlement.allowed
      ? undefined
      : "Your free trial has ended. Choose a plan to keep watching.",
    viewers,
    plan: account?.plan,
    trialEndsAt: account?.trial_ends_at,
    adultLimit: adultLimitForPlan(account?.plan),
    maxSlots: maxViewerSlots(account?.plan),
  });
}

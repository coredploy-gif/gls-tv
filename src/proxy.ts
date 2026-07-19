import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_VIEWER_COOKIE, VIEWER_SESSION_COOKIE } from "@/lib/membership/plans";
import {
  pathNeedsAuth,
  pathNeedsEntitlement,
  pathSkipsViewerGate,
  profilesGateHref,
} from "@/lib/membership/access-paths";
import { isEadminEmail } from "@/lib/eadmin";
import { operationalLog } from "@/lib/operations/logger";

const AUTH_PUBLIC = ["/auth", "/pricing", "/legal", "/faq", "/api"];

function requestPathWithSearch(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function redirectToProfiles(
  request: NextRequest,
  opts?: { reason?: string; clearViewer?: boolean; clearSession?: boolean },
) {
  const gate = profilesGateHref(requestPathWithSearch(request), {
    reason: opts?.reason,
  });
  const redirect = request.nextUrl.clone();
  const qIndex = gate.indexOf("?");
  redirect.pathname = qIndex >= 0 ? gate.slice(0, qIndex) : gate;
  redirect.search = qIndex >= 0 ? gate.slice(qIndex) : "";
  const res = NextResponse.redirect(redirect);
  if (opts?.clearViewer) {
    res.cookies.set(ACTIVE_VIEWER_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  if (opts?.clearSession) {
    res.cookies.set(VIEWER_SESSION_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}

export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);

  // The HLS route performs its own full authorization. Avoid repeating
  // Supabase auth, entitlement, and viewer-session queries for every manifest,
  // key, and media segment request.
  if (request.nextUrl.pathname === "/api/hls") {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.headers.set("x-request-id", requestId);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const isPublicAuthSurface = AUTH_PUBLIC.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  const needsAuth = pathNeedsAuth(path);
  const skipViewerGate = pathSkipsViewerGate(path);
  const needsEntitlement = pathNeedsEntitlement(path);

  if (needsAuth && !user && !isApi) {
    operationalLog("warn", "proxy.access_denied", { requestId, path, reason: "authentication_required" });
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/auth";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && needsEntitlement && !isEadminEmail(user.email)) {
    const viewerId = request.cookies.get(ACTIVE_VIEWER_COOKIE)?.value || null;
    const [profileResult, subscriptionResult, viewerResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "plan, trial_ends_at, trial_bypassed, is_admin_exception, is_premium, account_status",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
      viewerId
        ? supabase
            .from("viewer_profiles")
            .select("id")
            .eq("id", viewerId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const profile = profileResult.data;
    const subscription = subscriptionResult.data;
    const now = Date.now();
    const exception =
      profile?.trial_bypassed ||
      profile?.is_admin_exception ||
      profile?.plan === "exception" ||
      profile?.plan === "admin";
    const trialActive =
      Boolean(profile?.trial_ends_at) &&
      new Date(profile!.trial_ends_at!).getTime() > now;
    const paidActive =
      profile?.is_premium === true &&
      subscription?.status === "active" &&
      Boolean(subscription.current_period_end) &&
      new Date(subscription.current_period_end!).getTime() > now;
    const lookupFailed = Boolean(profileResult.error || subscriptionResult.error);
    const suspended = profile?.account_status && profile.account_status !== "active";

    if (lookupFailed || !profile || suspended || (!exception && !trialActive && !paidActive)) {
      operationalLog("warn", "proxy.entitlement_denied", {
        requestId,
        path,
        reason: suspended ? "account_suspended" : lookupFailed ? "lookup_failed" : "entitlement_expired",
        userId: user.id,
      });
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/pricing";
      redirect.searchParams.set(
        "access",
        lookupFailed ? "unavailable" : "expired",
      );
      const denied = NextResponse.redirect(redirect);
      denied.cookies.set(ACTIVE_VIEWER_COOKIE, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return denied;
    }

    if (viewerId && (viewerResult.error || !viewerResult.data)) {
      return redirectToProfiles(request, {
        clearViewer: true,
        clearSession: true,
      });
    }

    const sessionToken = request.cookies.get(VIEWER_SESSION_COOKIE)?.value;
    if (viewerId && !sessionToken) {
      return redirectToProfiles(request, {
        reason: "device",
        clearViewer: true,
      });
    }

    if (viewerId && sessionToken) {
      const { data: deviceSession } = await supabase
        .from("viewer_device_sessions")
        .select("id, viewer_profile_id, last_active_at")
        .eq("user_id", user.id)
        .eq("session_token", sessionToken)
        .is("revoked_at", null)
        .maybeSingle();
      const fresh =
        deviceSession &&
        deviceSession.viewer_profile_id === viewerId &&
        new Date(deviceSession.last_active_at).getTime() >
          Date.now() - 30 * 60_000;
      if (!fresh) {
        return redirectToProfiles(request, {
          reason: "device",
          clearViewer: true,
          clearSession: true,
        });
      }
    }
  }

  // Signed-in users hitting browse/watch without a viewer profile → Who's watching
  if (
    user &&
    !isPublicAuthSurface &&
    !skipViewerGate &&
    needsAuth &&
    !request.cookies.get(ACTIVE_VIEWER_COOKIE)?.value
  ) {
    return redirectToProfiles(request);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Skip static assets, Next internals, and the service worker.
     * (Browsers request /sw.js; running auth proxy on it is wasteful.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon\\.svg|avatars/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico|txt|map)$).*)",
  ],
};

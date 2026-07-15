import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_VIEWER_COOKIE, VIEWER_SESSION_COOKIE } from "@/lib/membership/plans";
import { isEadminEmail } from "@/lib/eadmin";
import { operationalLog } from "@/lib/operations/logger";

const PROTECTED_PREFIXES = [
  "/browse",
  "/watch",
  "/kids",
  "/profiles",
  "/playlists",
  "/search",
  "/sports",
  "/news",
  "/movies",
  "/series",
  "/live",
  "/food",
  "/asia",
  "/africa",
  "/mylist",
  "/my-list",
  "/account",
  "/billing",
  "/receipts",
  "/notifications",
  "/support",
  "/admin",
  "/eadmin",
];

/** Auth required but no viewer-profile gate (admin / auth surfaces). */
const SKIP_VIEWER_GATE = [
  "/admin",
  "/eadmin",
  "/profiles",
  "/auth",
  "/billing",
  "/receipts",
  "/pricing",
  "/account",
  "/notifications",
  "/support",
];

const AUTH_PUBLIC = ["/auth", "/pricing", "/legal", "/api"];

const ENTITLEMENT_PREFIXES = [
  "/browse",
  "/watch",
  "/kids",
  "/playlists",
  "/search",
  "/sports",
  "/news",
  "/movies",
  "/series",
  "/live",
  "/food",
  "/asia",
  "/africa",
  "/mylist",
  "/my-list",
];

export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);

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
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (needsAuth && !user && !isApi) {
    operationalLog("warn", "proxy.access_denied", { requestId, path, reason: "authentication_required" });
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/auth";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  const skipViewerGate = SKIP_VIEWER_GATE.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  const needsEntitlement = ENTITLEMENT_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
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
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/profiles";
      redirect.search = "";
      const staleViewer = NextResponse.redirect(redirect);
      staleViewer.cookies.set(ACTIVE_VIEWER_COOKIE, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      staleViewer.cookies.set(VIEWER_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return staleViewer;
    }

    const sessionToken = request.cookies.get(VIEWER_SESSION_COOKIE)?.value;
    if (viewerId && !sessionToken) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/profiles";
      redirect.searchParams.set("reason", "device");
      const missingSession = NextResponse.redirect(redirect);
      missingSession.cookies.set(ACTIVE_VIEWER_COOKIE, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return missingSession;
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
        const redirect = request.nextUrl.clone();
        redirect.pathname = "/profiles";
        redirect.searchParams.set("reason", "device");
        const expiredSession = NextResponse.redirect(redirect);
        expiredSession.cookies.set(ACTIVE_VIEWER_COOKIE, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        expiredSession.cookies.set(VIEWER_SESSION_COOKIE, "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        return expiredSession;
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
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/profiles";
    redirect.search = "";
    return NextResponse.redirect(redirect);
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

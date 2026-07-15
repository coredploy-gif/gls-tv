import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_VIEWER_COOKIE } from "@/lib/membership/plans";

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
];

const AUTH_PUBLIC = ["/auth", "/pricing", "/legal", "/api"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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
          request: { headers: request.headers },
        });
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
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/auth";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  const skipViewerGate = SKIP_VIEWER_GATE.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

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

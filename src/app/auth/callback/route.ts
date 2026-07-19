import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import {
  pathNeedsViewer,
  profilesGateHref,
} from "@/lib/membership/access-paths";

/** Supabase email confirm / magic-link / OAuth callback */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const intended = safeNextPath(searchParams.get("next"));
  const next = pathNeedsViewer(intended.split("?")[0] || intended)
    ? profilesGateHref(intended)
    : intended;

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, origin));
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Supabase email confirm / magic-link callback */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/profiles";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/profiles"}`);
}

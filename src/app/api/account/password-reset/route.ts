import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: unknown };
  const email = String(body.email || "").trim().toLowerCase();
  if (email.includes("@")) {
    const auth = await createClient();
    const origin = siteUrl(req.nextUrl.origin);
    await auth.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/account/recover`,
    });
  }
  return NextResponse.json({
    ok: true,
    message: "If that address has an account, a recovery link has been sent.",
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Open the valid recovery link first" }, { status: 401 });
  const body = (await req.json()) as { password?: unknown };
  const password = String(body.password || "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters" }, { status: 400 });
  }
  const { error } = await auth.auth.updateUser({ password });
  return error
    ? NextResponse.json({ error: "Password could not be updated" }, { status: 400 })
    : NextResponse.json({ ok: true });
}

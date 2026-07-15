import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEadminEmail, serviceRoleStatus } from "@/lib/eadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin env health — no secrets returned. */
export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isEadminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = serviceRoleStatus();
  return NextResponse.json({
    ...status,
    yocoConfigured: Boolean(process.env.YOCO_SECRET_KEY?.trim()),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  });
}

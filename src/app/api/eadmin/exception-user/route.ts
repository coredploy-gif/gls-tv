import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import { maxViewerSlots } from "@/lib/membership/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Eadmin: grant trial bypass / exception to a user by email. */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isEadminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    email?: string;
    plan?: string;
    bypassTrial?: boolean;
  };
  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const { data: listed } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const target = listed?.users?.find(
    (u) => (u.email || "").toLowerCase() === email,
  );
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plan = body.plan || "exception";
  const { error } = await service
    .from("profiles")
    .update({
      plan,
      trial_bypassed: body.bypassTrial !== false,
      is_admin_exception: true,
      is_premium: true,
      max_viewer_profiles: maxViewerSlots(plan),
      email,
    })
    .eq("id", target.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId: target.id,
    email,
    plan,
  });
}

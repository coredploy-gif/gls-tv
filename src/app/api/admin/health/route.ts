import { NextResponse } from "next/server";
import { serviceRoleStatus } from "@/lib/eadmin";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin env health — no secrets returned. */
export async function GET() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "ops.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = serviceRoleStatus();
  return NextResponse.json({
    ...status,
    yocoConfigured: Boolean(process.env.YOCO_SECRET_KEY?.trim()),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  });
}

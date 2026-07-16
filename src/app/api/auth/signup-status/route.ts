import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";

/** Public signup freeze check for AuthPanel. */
export async function GET() {
  const allowed = await isFeatureEnabled("signups");
  return NextResponse.json({
    allowed,
    message: allowed
      ? null
      : "New account creation is temporarily paused. Please try again later or contact support.",
  });
}

import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";

/** Public OAuth button visibility for AuthPanel (no secrets). */
export async function GET() {
  const google = await isFeatureEnabled("oauth_google");
  return NextResponse.json({ google });
}

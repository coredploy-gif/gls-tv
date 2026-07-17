import { NextResponse } from "next/server";
import { getCopyMap } from "@/lib/copy-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public merged copy map (fallbacks + DB overrides). */
export async function GET() {
  const map = await getCopyMap();
  return NextResponse.json({ copy: map });
}

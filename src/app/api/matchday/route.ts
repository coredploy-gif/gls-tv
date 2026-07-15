import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MATCHDAY_TZ, getTodaysMatches } from "@/lib/matchday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

function safeTz(raw: string | null): string {
  if (!raw) return DEFAULT_MATCHDAY_TZ;
  try {
    // Throws RangeError for invalid IANA zones
    Intl.DateTimeFormat(undefined, { timeZone: raw });
    return raw;
  } catch {
    return DEFAULT_MATCHDAY_TZ;
  }
}

export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get("day") || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") || "48");
  const timeZone = safeTz(req.nextUrl.searchParams.get("tz"));
  const data = await getTodaysMatches({
    day,
    limit: Number.isFinite(limit) ? limit : 48,
    timeZone,
  });
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
    },
  });
}

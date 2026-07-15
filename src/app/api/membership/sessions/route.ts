import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import { VIEWER_SESSION_COOKIE } from "@/lib/membership/plans";
import {
  touchViewerDeviceSession,
  validateViewerDeviceSession,
} from "@/lib/membership/viewer-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const token = req.cookies.get(VIEWER_SESSION_COOKIE)?.value || null;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action || "heartbeat";

  if (action === "heartbeat" || action === "validate") {
    if (action === "heartbeat") {
      const touched = await touchViewerDeviceSession(service, user.id, token || "");
      if (!touched.ok) {
        const res = NextResponse.json(
          { ok: false, error: touched.error, code: "SESSION_EXPIRED" },
          { status: 409 },
        );
        res.cookies.set(VIEWER_SESSION_COOKIE, "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        return res;
      }
      return NextResponse.json({ ok: true, session: touched.session });
    }

    const validated = await validateViewerDeviceSession(service, user.id, token);
    if (!validated.ok) {
      return NextResponse.json(
        { ok: false, code: validated.reason },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, session: validated.session });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

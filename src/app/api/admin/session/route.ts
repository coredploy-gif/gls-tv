import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin/access";

export async function GET() {
  const access = await getAdminAccess();

  return NextResponse.json(
    {
      isAdmin: Boolean(access),
      roles: access?.roles ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

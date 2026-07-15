import { createClient } from "@/lib/supabase/server";
import { ACTIVE_VIEWER_COOKIE } from "@/lib/membership/plans";
import { listViewerProfiles } from "@/lib/membership/account";
import { cookies } from "next/headers";

export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ viewer: null });
  }

  const jar = await cookies();
  const viewerId = jar.get(ACTIVE_VIEWER_COOKIE)?.value;
  if (!viewerId) {
    return Response.json({ viewer: null, needsPick: true });
  }

  const viewers = await listViewerProfiles(user.id);
  const viewer = viewers.find((v) => v.id === viewerId) || null;

  return Response.json({
    viewer,
    viewers: viewers.map((v) => ({
      id: v.id,
      name: v.name,
      avatar_url: v.avatar_url,
      is_kids: v.is_kids,
    })),
  });
}

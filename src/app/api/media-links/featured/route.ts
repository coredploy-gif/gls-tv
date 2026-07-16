import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";

/** Published admin-curated links for members (separate from licensed catalog). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ links: [], entitled: false });
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);

  const { data, error } = await supabase
    .from("admin_media_links")
    .select(
      "id, url, title, format, category, thumbnail_url, embed_url, video_id, is_published, notes, created_at",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(48);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    links: data ?? [],
    entitled: entitlement.allowed,
  });
}

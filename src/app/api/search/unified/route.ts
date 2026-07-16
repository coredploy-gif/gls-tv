import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({
      catalog: [],
      playlists: [],
      links: [],
      staff: [],
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const like = `%${q.replace(/[%_]/g, "")}%`;

  const catalogPromise = supabase
    .from("channels")
    .select("slug, title, categories, countries, poster, health_status")
    .or(`title.ilike.${like},slug.ilike.${like}`)
    .limit(24);

  let playlists: Array<{ id: string; title: string; href: string }> = [];
  let links: Array<{
    id: string;
    title: string;
    format: string;
    category: string;
    href: string;
  }> = [];
  let staff: Array<{
    id: string;
    title: string;
    format: string;
    category: string;
    href: string;
  }> = [];

  if (user) {
    const entitlement = await getAccountEntitlement(user.id, user.email);
    if (entitlement.allowed) {
      const [pl, ml, feat] = await Promise.all([
        supabase
          .from("user_playlist_channels")
          .select("id, title, group_title")
          .eq("user_id", user.id)
          .ilike("title", like)
          .limit(20),
        supabase
          .from("user_media_links")
          .select("id, title, format, category")
          .eq("user_id", user.id)
          .or(`title.ilike.${like},category.ilike.${like}`)
          .limit(20),
        supabase
          .from("admin_media_links")
          .select("id, title, format, category")
          .eq("is_published", true)
          .or(`title.ilike.${like},category.ilike.${like}`)
          .limit(12),
      ]);
      playlists = (pl.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        href: `/watch/mine/${row.id}`,
      }));
      links = (ml.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        format: row.format,
        category: row.category,
        href: `/library/watch/${row.id}`,
      }));
      staff = (feat.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        format: row.format,
        category: row.category,
        href: `/library/featured/${row.id}`,
      }));
    }
  }

  const { data: catalogRows } = await catalogPromise;

  return NextResponse.json({
    q,
    catalog: (catalogRows || []).map((row) => ({
      slug: row.slug,
      title: row.title,
      categories: row.categories || [],
      countries: row.countries || [],
      poster: row.poster || null,
      health: row.health_status || null,
      href: `/watch/${row.slug}`,
      source: "catalog" as const,
    })),
    playlists,
    links,
    staff,
  });
}

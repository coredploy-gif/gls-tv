import { NextResponse } from "next/server";
import { searchDbCatalog } from "@/lib/db-catalog";

/**
 * Search / browse the full seeded catalog (iptv-org index in Supabase).
 * Paginated — never returns the entire ~13k list.
 * Filters: q, country (ISO), category, offset, limit
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const country = searchParams.get("country") || "";
  const category = searchParams.get("category") || "";
  const limit = Number(searchParams.get("limit") || "48");
  const offset = Number(searchParams.get("offset") || "0");
  // Name search spans all regions; bare browse stays on the full iptv-org index
  const regionParam = searchParams.get("region");
  const region =
    regionParam === "all"
      ? undefined
      : regionParam || (q.trim() ? undefined : "iptv-org");

  const channels = await searchDbCatalog({
    q,
    country,
    category,
    limit,
    offset,
    region,
  });

  return NextResponse.json({
    count: channels.length,
    offset,
    country: country || null,
    category: category || null,
    channels: channels.map((c) => ({
      slug: c.slug,
      title: c.title,
      categories: c.categories,
      countries: c.countries,
      poster: c.poster,
      hasStream: Boolean(c.sources[0]?.url),
    })),
  });
}

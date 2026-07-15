import { NextResponse } from "next/server";
import { listSeedCatalogItems } from "@/lib/stream-seeds-catalog";

/** Public list of active eadmin seeds for Sports merge. */
export async function GET() {
  const items = await listSeedCatalogItems();
  return NextResponse.json({
    channels: items.map((c) => ({
      slug: c.slug,
      title: c.title,
      url: c.sources[0]?.url || "",
      categories: c.categories,
      countries: c.countries,
      poster: c.poster,
      backdrop: c.backdrop,
      hasStream: Boolean(c.sources[0]?.url),
    })),
  });
}

import type { CatalogItem } from "@/data/types";
import { createClient } from "@supabase/supabase-js";

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const FALLBACK_ART =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1600&h=2400&q=92";

type DbChannel = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  countries: string[] | null;
  categories: string[] | null;
  languages: string[] | null;
  poster: string | null;
  backdrop: string | null;
  license: string | null;
  is_live: boolean | null;
  featured: boolean | null;
  source_url: string | null;
  source_quality: string | null;
  source_format: string | null;
  active_source_url: string | null;
  health_status: string | null;
};

export function catalogFromDbChannel(ch: DbChannel): CatalogItem | null {
  const url = (ch.active_source_url || ch.source_url || "").trim();
  const cats = ch.categories || ["General"];
  const linearPay =
    cats.includes("LinearPay") ||
    cats.includes("Rights") ||
    cats.includes("Unavailable");
  // Linear pay tiles stay visible for discovery even when HLS is intentionally empty
  if (!url && !linearPay) return null;
  const rightsBlocked = linearPay || ch.health_status === "dead";
  return {
    id: ch.id,
    slug: ch.slug,
    title: ch.title,
    type: "live",
    description:
      ch.description ||
      (linearPay
        ? `${ch.title} — linear pay-TV channel. Use the official licensed provider.`
        : "iptv-org catalog stream."),
    countries: ch.countries?.length ? ch.countries : ["world"],
    categories: [
      ...new Set([
        ...cats.filter((c) => c !== "Unavailable"),
        "IptvOrg",
        linearPay ? "LinearPay" : null,
        ch.health_status === "healthy"
          ? "Playable"
          : linearPay
            ? null
            : "ProxyOk",
      ].filter(Boolean) as string[]),
    ],
    languages: ch.languages || [],
    poster: ch.poster || FALLBACK_ART,
    backdrop: ch.backdrop || FALLBACK_ART,
    license: (ch.license as CatalogItem["license"]) || "open_stream",
    isLive: ch.is_live !== false,
    featured: Boolean(ch.featured),
    sources:
      rightsBlocked || !url
        ? []
        : [
            {
              url,
              quality: ch.source_quality || "Auto",
              format: (ch.source_format as "hls" | "mp4") || "hls",
              priority: 20,
              label: "iptv-org-db",
            },
          ],
  };
}

/** Resolve a channel from Supabase (full iptv-org seed). */
export async function getDbCatalogItem(
  slug: string,
): Promise<CatalogItem | null> {
  try {
    const sb = anon();
    if (!sb) return null;
    const { data } = await sb
      .from("channels")
      .select(
        "id, slug, title, description, countries, categories, languages, poster, backdrop, license, is_live, featured, source_url, source_quality, source_format, active_source_url, health_status",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    return catalogFromDbChannel(data as DbChannel);
  } catch {
    return null;
  }
}

function expandSearchTerms(q: string): string[] {
  const raw = q.trim();
  if (!raw) return [];
  const terms = new Set<string>([raw]);
  const compact = raw.replace(/[\s_-]+/g, "");
  if (compact) terms.add(compact);
  const ascii = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss");
  if (ascii && ascii !== raw) terms.add(ascii);
  const asciiCompact = ascii.replace(/[\s_-]+/g, "");
  if (asciiCompact) terms.add(asciiCompact);
  if (/mexico|m[eé]xico/i.test(raw)) {
    terms.add("México");
    terms.add("Mexico");
    terms.add("m-xico");
  }
  if (/euro/i.test(raw)) {
    terms.add("Euronews");
    terms.add("Euro");
  }
  if (/^tsn\s*\d/i.test(raw) || /^fs\s*\d/i.test(raw) || /^espn\s*\d/i.test(raw)) {
    terms.add(raw.replace(/([a-zA-Z]+)(\d)/i, "$1 $2"));
    terms.add(raw.replace(/\s+/g, ""));
  }
  if (/duck/i.test(raw)) {
    terms.add("ducktv");
    terms.add("duck tv");
  }
  if (/vivo/i.test(raw)) {
    terms.add("Vivo TV");
    terms.add("vivotv");
  }
  if (/survivor/i.test(raw)) {
    terms.add("Survivor México");
    terms.add("Survivor");
  }
  return [...terms].filter(Boolean);
}

function orPartsForWord(word: string, includeDesc = false): string[] {
  const parts: string[] = [];
  for (const t of expandSearchTerms(word).slice(0, 8)) {
    const safe = t.replace(/[,.()]/g, " ").trim();
    if (!safe) continue;
    parts.push(`title.ilike.%${safe}%`, `slug.ilike.%${safe}%`);
    if (includeDesc) parts.push(`description.ilike.%${safe}%`);
  }
  return parts;
}

/** Search seeded catalog without loading the full list into the PWA. */
export async function searchDbCatalog(opts: {
  q?: string;
  limit?: number;
  offset?: number;
  region?: string;
  country?: string;
  category?: string;
}): Promise<CatalogItem[]> {
  try {
    const sb = anon();
    if (!sb) return [];
    const limit = Math.min(opts.limit ?? 48, 100);
    const offset = opts.offset ?? 0;
    const qRaw = (opts.q || "").trim().replace(/%/g, "");
    const category = (opts.category || "").trim();
    const country = (opts.country || "").trim().toLowerCase();

    let query = sb
      .from("channels")
      .select(
        "id, slug, title, description, countries, categories, languages, poster, backdrop, license, is_live, featured, source_url, source_quality, source_format, active_source_url, health_status",
      )
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);

    if (opts.region) {
      query = query.eq("region", opts.region);
    } else if (!qRaw) {
      query = query.eq("region", "iptv-org");
    }

    if (country) {
      query = query.contains("countries", [country]);
    }

    if (category && category !== "All") {
      if (category === "Uncategorized") {
        query = query.contains("categories", ["Undefined"]);
      } else if (category === "Sports") {
        query = query.or(
          [
            "categories.cs.{Sports}",
            "categories.cs.{LinearSports}",
            "categories.cs.{LinearPay}",
            "title.ilike.%sport%",
            "title.ilike.%arena%",
            "title.ilike.%fox%",
            "title.ilike.%espn%",
            "title.ilike.%tsn%",
            "title.ilike.%tennis%",
            "title.ilike.%golf%",
            "title.ilike.%bein%",
            "slug.ilike.%sport%",
            "slug.ilike.%arena%",
            "slug.ilike.%fox%",
            "slug.ilike.%espn%",
            "slug.ilike.%tsn%",
          ].join(","),
        );
      } else {
        query = query.contains("categories", [category]);
      }
    }

    if (qRaw) {
      const words = qRaw.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        for (const word of words) {
          const parts = orPartsForWord(word, false);
          if (parts.length) query = query.or(parts.join(","));
        }
      } else {
        const parts = orPartsForWord(qRaw, false);
        if (parts.length) query = query.or(parts.join(","));
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error("searchDbCatalog", error.message);
      return [];
    }

    const fromChannels = (data || [])
      .map((row) => catalogFromDbChannel(row as DbChannel))
      .filter((x): x is CatalogItem => Boolean(x));

    if (qRaw) {
      const seedParts = orPartsForWord(qRaw, false);
      if (seedParts.length) {
        const { data: seeds } = await sb
          .from("stream_seeds")
          .select(
            "slug, title, url, categories, countries, poster, backdrop, is_active",
          )
          .eq("is_active", true)
          .or(seedParts.join(","))
          .limit(40);
        const seen = new Set(fromChannels.map((c) => c.slug));
        for (const s of seeds || []) {
          if (seen.has(s.slug)) continue;
          const item = catalogFromDbChannel({
            id: `stream-seed-${s.slug}`,
            slug: s.slug,
            title: s.title,
            description: "Eadmin / iptv-org seed",
            countries: s.countries,
            categories: s.categories,
            languages: [],
            poster: s.poster,
            backdrop: s.backdrop,
            license: "open_stream",
            is_live: true,
            featured: false,
            source_url: s.url,
            source_quality: "Auto",
            source_format: "hls",
            active_source_url: s.url,
            health_status: "degraded",
          });
          if (item) {
            seen.add(item.slug);
            fromChannels.unshift(item);
          }
        }
      }
    }

    // Final: every search word must appear in title or slug (accent-insensitive)
    if (qRaw) {
      const words = qRaw
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .split(/\s+/)
        .filter(Boolean);
      return fromChannels
        .filter((c) => {
          const hay = `${c.title} ${c.slug}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .replace(/-/g, " ");
          return words.every(
            (w) =>
              hay.includes(w) ||
              (w === "mexico" && hay.includes("xico")) ||
              (w === "duck" && hay.includes("ducktv")),
          );
        })
        .slice(0, limit);
    }

    return fromChannels.slice(0, limit);
  } catch {
    return [];
  }
}

import {
  IPTV_ORG_COUNTRY,
  IPTV_ORG_INDEX_FULL,
  IPTV_ORG_TARGETS,
  extractTargetsFromM3u,
  extractTargetsFromM3uAsync,
  type ExtractedMatch,
} from "@/lib/iptv-org-targets";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncMode = "smart" | "index";

export type SyncOptions = {
  /** smart = small country/category feeds; index = full ~13k list */
  mode?: SyncMode;
  /** If false, never overwrite a seed that already has a URL */
  replaceExisting?: boolean;
  updatedBy?: string;
  /** Probe URLs and apply HTTPS fallbacks for dead listings */
  probe?: boolean;
};

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "GLS-TV/1.0 (eadmin sync)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.text();
}

/** Prefer HTTPS HLS when several feeds yield the same slug. */
function mergeMatches(batches: ExtractedMatch[]): ExtractedMatch[] {
  const map = new Map<string, ExtractedMatch>();
  for (const row of batches) {
    const prev = map.get(row.slug);
    if (!prev) {
      map.set(row.slug, row);
      continue;
    }
    const prevHttps = prev.url.startsWith("https://") ? 1 : 0;
    const nextHttps = row.url.startsWith("https://") ? 1 : 0;
    if (nextHttps > prevHttps) map.set(row.slug, row);
  }
  return [...map.values()];
}

export async function downloadAndExtract(
  mode: SyncMode = "smart",
  probe = true,
): Promise<{ matches: ExtractedMatch[]; sources: string[] }> {
  const sources: string[] = [];
  const parse = probe ? extractTargetsFromM3uAsync : async (t: string) => extractTargetsFromM3u(t);

  if (mode === "index") {
    sources.push(IPTV_ORG_INDEX_FULL);
    const text = await fetchText(IPTV_ORG_INDEX_FULL);
    return {
      matches: await parse(text),
      sources,
    };
  }

  // Fast path: only regions that usually hold our allowlist (not the full 13k UI dump)
  const feeds = [
    IPTV_ORG_COUNTRY("za"),
    IPTV_ORG_COUNTRY("zw"),
  ];
  sources.push(...feeds);

  const texts = await Promise.all(feeds.map((u) => fetchText(u)));
  const batches = await Promise.all(texts.map((t) => parse(t)));
  const matches = mergeMatches(batches.flat());
  return { matches, sources };
}

export async function upsertMatchesToSeeds(
  service: SupabaseClient,
  matches: ExtractedMatch[],
  opts: SyncOptions = {},
) {
  const replaceExisting = opts.replaceExisting !== false;
  const found: string[] = [];
  const skipped: string[] = [];
  const written: string[] = [];

  const { data: existing } = await service
    .from("stream_seeds")
    .select("slug, url")
    .in(
      "slug",
      IPTV_ORG_TARGETS.map((t) => t.slug),
    );

  const bySlug = new Map((existing ?? []).map((r) => [r.slug as string, r]));

  for (const m of matches) {
    found.push(m.slug);
    const prev = bySlug.get(m.slug);
    if (!replaceExisting && prev?.url?.trim()) {
      skipped.push(m.slug);
      continue;
    }

    const { error } = await service.from("stream_seeds").upsert(
      {
        slug: m.slug,
        title: m.title,
        url: m.url,
        categories: m.categories,
        countries: m.countries,
        poster: m.logo || "",
        backdrop: m.logo || "",
        is_active: true,
        updated_by: opts.updatedBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(error.message);
    written.push(m.slug);
  }

  const missing = IPTV_ORG_TARGETS.map((t) => t.slug).filter(
    (s) => !found.includes(s),
  );

  return { found, written, skipped, missing, matches };
}

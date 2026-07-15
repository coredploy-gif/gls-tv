import type { CatalogItem, MediaSource } from "@/data/types";
import {
  healTraceSources,
  isBrokenTraceOrigin,
  isTraceChannel,
} from "@/lib/trace-mirrors";

/**
 * Pre-go-live channel healing.
 * Prefer open / verified HLS mirrors; demote known-dead or sticky hosts.
 * Policy: no invented pirate pay-TV URLs — only curated open FAST / FTA mirrors.
 */

const SABC1 =
  "https://sabconeta.cdn.mangomolo.com/sabc1/smil:sabc1.stream.smil/master.m3u8";
const SABC2 =
  "https://sabctwota.cdn.mangomolo.com/sabc2/smil:sabc2.stream.smil/master.m3u8";
const SABC3 =
  "https://sabctreta.cdn.mangomolo.com/sabc3/smil:sabc3.stream.smil/master.m3u8";
const SABC3_CHUNK =
  "https://sabctreta.cdn.mangomolo.com/sabc3/smil:sabc3.stream.smil/chunklist_b1600000_t64NzIwcA==.m3u8";
const SABC_NEWS =
  "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8";
const LN24 =
  "https://cdnstack.internetmultimediaonline.org/ln24/ln24.stream/playlist.m3u8";
const WILDEARTH = "https://wildearth-xumo.amagi.tv/master.m3u8";
const HOPE = "https://jstre.am/live/jsl:i1onRBELcGV.m3u8";
const AFROBEATS =
  "https://stream.ecable.tv/afrobeats/tracks-v1a1/mono.m3u8";
const KZN1 =
  "https://cdn.freevisiontv.co.za/sttv/smil:1kzn.stream.smil/playlist.m3u8";

function src(
  url: string,
  priority: number,
  label: string,
  quality = "Auto",
): MediaSource {
  return { url, quality, format: "hls", priority, label };
}

/** Hosts that routinely fail outside their intended network / cert path. */
export function isFragileHost(url: string): boolean {
  return (
    isBrokenTraceOrigin(url) ||
    /channels\.trace\.plus|blocked\.grouptag|streamvidex|qzz\.io|live20\.bozztv\.com/i.test(
      url,
    )
  );
}

export function isGeoSensitiveChannel(
  slug: string,
  title?: string | null,
  categories?: string[],
): boolean {
  if (categories?.includes("Geo")) return true;
  const hay = `${slug} ${title || ""}`.toLowerCase();
  return /sabc|mangomolo|bozztv|freevision|sentech|1kzn|afrikan/.test(hay);
}

export function isPlutoFamily(url: string): boolean {
  return /jmp2\.uk|pluto\.tv|plutotv|stitcher|xumo\.tv|wurl\.tv/i.test(url);
}

type Pack = MediaSource[];

/** Slug / title → preferred open mirrors (prepended). */
function healPackFor(slug: string, title?: string | null): Pack | null {
  const hay = `${slug} ${title || ""}`.toLowerCase();

  if (/sabc[\s_-]?1\b|sabc-1|sabc1/.test(hay) && !/news/.test(hay)) {
    return [
      src(SABC1, 5, "heal-sabc1-mangomolo"),
      src(SABC_NEWS, 80, "heal-sabc-news-alt"),
      src(LN24, 90, "heal-ln24-alt"),
    ];
  }
  if (/sabc[\s_-]?2\b|sabc-2|sabc2/.test(hay) && !/news/.test(hay)) {
    return [
      src(SABC2, 5, "heal-sabc2-mangomolo"),
      src(SABC_NEWS, 80, "heal-sabc-news-alt"),
      src(LN24, 90, "heal-ln24-alt"),
    ];
  }
  if (/sabc[\s_-]?3\b|sabc-3|sabc3/.test(hay) && !/news/.test(hay)) {
    return [
      src(SABC3, 5, "heal-sabc3-mangomolo"),
      src(SABC3_CHUNK, 12, "heal-sabc3-chunk"),
      // Soft alts when viewer IP is outside ZA geofence
      src(SABC_NEWS, 70, "heal-sabc-news-alt"),
      src(LN24, 80, "heal-ln24-alt"),
    ];
  }
  if (/sabc[\s_-]?news|sabcnews|news.?24/.test(hay) && /sabc/.test(hay)) {
    return [
      src(SABC_NEWS, 5, "heal-sabc-news"),
      src(LN24, 40, "heal-ln24-alt"),
    ];
  }
  if (/\bln24\b|ln24-sa|ln24sa/.test(hay)) {
    return [src(LN24, 5, "heal-ln24")];
  }
  if (/wildearth|wild.?earth/.test(hay)) {
    return [src(WILDEARTH, 5, "heal-wildearth")];
  }
  if (/hope.?channel|hope.?africa|jstre\.am/.test(hay)) {
    return [src(HOPE, 5, "heal-hope")];
  }
  if (/1kzn|kzn.?tv|freevision/.test(hay)) {
    return [src(KZN1, 5, "heal-1kzn"), src(AFROBEATS, 90, "heal-afrobeats-alt")];
  }
  if (/afrobeats/.test(hay)) {
    return [src(AFROBEATS, 5, "heal-afrobeats")];
  }

  return null;
}

function mergeSources(
  preferred: MediaSource[],
  existing: MediaSource[],
): MediaSource[] {
  const seen = new Set<string>();
  const out: MediaSource[] = [];
  const push = (s: MediaSource) => {
    if (!s.url || seen.has(s.url)) return;
    seen.add(s.url);
    out.push(s);
  };

  for (const s of preferred) push(s);

  const good: MediaSource[] = [];
  const fragile: MediaSource[] = [];
  for (const s of existing) {
    if (isFragileHost(s.url)) fragile.push(s);
    else good.push(s);
  }
  for (const s of good) push({ ...s, priority: (s.priority ?? 100) + 50 });
  for (const s of fragile)
    push({
      ...s,
      priority: (s.priority ?? 100) + 900,
      label: s.label || "fragile-fallback",
    });

  return out;
}

/**
 * Heal all known fragile catalogue families for go-live.
 * Returns possibly expanded sources + category tags to merge.
 */
export function healChannelSources(
  item: Pick<CatalogItem, "slug" | "title" | "sources" | "categories">,
): { sources: MediaSource[]; tags: string[] } {
  const tags: string[] = [];
  let sources = [...(item.sources || [])];

  // 1) Trace music / sports family
  if (isTraceChannel(item.slug, item.title)) {
    sources = healTraceSources(item.slug, item.title, sources);
    tags.push("Healed", "Playable");
  }

  // 2) ZA FTA / news / hope packs
  const pack = healPackFor(item.slug, item.title);
  if (pack) {
    sources = mergeSources(pack, sources);
    tags.push("Healed", "Playable");
    if (isGeoSensitiveChannel(item.slug, item.title, item.categories)) {
      tags.push("Geo");
    }
  } else if (sources.some((s) => isFragileHost(s.url))) {
    // Demote fragile hosts even without a dedicated pack
    sources = mergeSources([], sources);
    tags.push("ProxyOk");
  }

  // 3) Pluto / jmp2 series — keep URLs but tag for proxy + deep buffer
  if (sources.some((s) => isPlutoFamily(s.url))) {
    tags.push("ProxyOk", "Playable");
  }

  return { sources, tags: [...new Set(tags)] };
}

export function needsDeepBuffer(item: {
  slug: string;
  title?: string | null;
  categories?: string[];
  sources?: MediaSource[];
}): boolean {
  if (
    item.categories?.some((c) =>
      /Healed|Geo|LinearSports|ProxyOk|Music|Sports|News/i.test(c),
    )
  ) {
    return true;
  }
  if (isTraceChannel(item.slug, item.title)) return true;
  if (isGeoSensitiveChannel(item.slug, item.title, item.categories)) return true;
  if (item.sources?.some((s) => isPlutoFamily(s.url) || isFragileHost(s.url)))
    return true;
  return false;
}

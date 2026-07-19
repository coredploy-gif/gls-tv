import type { CatalogItem, MediaSource } from "@/data/types";
import {
  applyHostRewrites,
  brandHealPack,
  isRegistryFragileHost,
  verifiedHealUrl,
  verifiedSlugPack,
} from "@/lib/heal-registry";
import {
  healTraceSources,
  isBrokenTraceOrigin,
  isTraceChannel,
  primaryTraceHealUrl,
  TRACE_URBAN_FALLBACK_TAG,
  usesTraceUrbanFallback,
} from "@/lib/trace-mirrors";

/**
 * System-wide channel healing (playback path).
 * Prefer open / verified HLS mirrors; demote known-dead or sticky hosts.
 * Policy: no invented pirate pay-TV URLs — only curated open FAST / FTA mirrors.
 *
 * Layers (in order): Trace family → slug overrides / playable index → brand
 * registry → ZA FTA packs → host rewrites → fragile demote.
 * Extend brands/hosts in `heal-registry.ts`.
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
const BOK_TV = "https://livestream2.bokradio.co.za/hls/Bok5c.m3u8";

/** True for SABC 1/2/3 (not News). */
export function isNumberedSabcChannel(slug: string, title?: string | null) {
  const hay = `${slug} ${title || ""}`.toLowerCase();
  if (/news/.test(hay)) return false;
  return /sabc[\s_-]?[123]\b|sabc-[123]|sabc[123]/.test(hay);
}

/** News / LN24 mirrors must never attach to SABC 1/2/3. */
export function isSabcSisterSwapUrl(url: string) {
  return /sabconetanw|\/news\/smil:news|ln24\.stream|internetmultimediaonline\.org\/ln24/i.test(
    url,
  );
}

function stripSabcSisterSwaps(
  slug: string,
  title: string | null | undefined,
  sources: MediaSource[],
): MediaSource[] {
  if (!isNumberedSabcChannel(slug, title)) return sources;
  return sources.filter((s) => !isSabcSisterSwapUrl(s.url));
}

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
    isRegistryFragileHost(url) ||
    /channels\.trace\.plus|blocked\.grouptag|streamvidex|qzz\.io|live20\.bozztv\.com|nghk\.ai|sinalmycn\.com|lb\.dstvmultimedia\.com/i.test(
      url,
    )
  );
}

export function isRawIpUrl(url: string): boolean {
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    return /^\d+\.\d+\.\d+\.\d+$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Balkan / RU / BG Arena pay-linear brands — shown for discovery with LinearPay warning.
 * Do not attach unofficial restreams (nghk, raw IP, DStv multimedia scrapes).
 */
export function isArenaPayLinear(
  slug: string,
  title?: string | null,
): boolean {
  const hay = `${slug} ${title || ""}`.toLowerCase();
  if (/tele.?arena/.test(hay)) return false;
  if (/tv.?central/.test(hay)) return false;
  return (
    /arena[\s_-]*sport|arenasport|arena[\s_-]*fight|arenafight|arena[\s_-]*premium|match.?arena|матч.?арена|vivacom.?arena/i.test(
      hay,
    ) || /arenasport|arenafight|arenapremium|matcharena|vivacomarena/i.test(slug)
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

/** ZA / regional FTA packs (brand networks live in heal-registry). */
function healZaPackOnly(slug: string, title?: string | null): Pack | null {
  const hay = `${slug} ${title || ""}`.toLowerCase();

  if (/sabc[\s_-]?1\b|sabc-1|sabc1/.test(hay) && !/news/.test(hay)) {
    // Never fall back to SABC News / LN24 — that silently swaps the channel.
    return [src(SABC1, 5, "heal-sabc1-mangomolo")];
  }
  if (/sabc[\s_-]?2\b|sabc-2|sabc2/.test(hay) && !/news/.test(hay)) {
    return [src(SABC2, 5, "heal-sabc2-mangomolo")];
  }
  if (/sabc[\s_-]?3\b|sabc-3|sabc3/.test(hay) && !/news/.test(hay)) {
    return [
      src(SABC3, 5, "heal-sabc3-mangomolo"),
      src(SABC3_CHUNK, 12, "heal-sabc3-chunk"),
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
  if (/\bbok[\s_-]?tv\b/.test(hay)) {
    return [src(BOK_TV, 5, "heal-bok-tv")];
  }
  if (/bbc[\s_-]?food|bbcfood/.test(hay)) {
    return [
      src(
        "https://d1e9r0b71zfwk7.cloudfront.net/playlist.m3u8",
        5,
        "heal-bbc-food-cf",
      ),
    ];
  }
  if (/tele.?arena|telearena/.test(hay)) {
    return [
      src(
        "https://5ce9406b73c33.streamlock.net/TeleArena/TeleArena.stream/playlist.m3u8",
        5,
        "heal-telearena-streamlock",
      ),
    ];
  }
  return null;
}

/**
 * Slug / title → preferred open mirrors (prepended).
 * Combines ZA FTA packs + brand registry for callers/tests.
 */
export function healPackFor(slug: string, title?: string | null): Pack | null {
  const za = healZaPackOnly(slug, title);
  if (za) return za;
  return brandHealPack(slug, title)?.sources ?? null;
}

/** Curated slug override / playable-index URL when present. */
export function overrideHealUrl(slug: string): string | null {
  return verifiedHealUrl(slug);
}

function overrideHealPack(slug: string): Pack | null {
  return verifiedSlugPack(slug);
}

/**
 * Best open mirror for private-playlist HLS rewrite when the stored URL is dead.
 * Never invents Arena/TSN/Fox/ESPN pay-linear restreams.
 */
export function primaryPrivateHealUrl(
  slug: string,
  title?: string | null,
): string | null {
  if (isArenaPayLinear(slug, title)) return null;
  const override = overrideHealUrl(slug);
  if (override) return override;
  if (isTraceChannel(slug, title)) {
    return primaryTraceHealUrl(slug, title);
  }
  const brand = brandHealPack(slug, title);
  if (brand?.sources[0]?.url) return brand.sources[0].url;
  return healZaPackOnly(slug, title)?.[0]?.url ?? null;
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
    if (isFragileHost(s.url) || isRawIpUrl(s.url)) fragile.push(s);
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
 * Private playlist healing — Trace + registry brands + open FTA packs + overrides.
 * Unlike healChannelSources, NEVER clears Arena/Fox/TSN/ESPN user URLs
 * and NEVER drops raw-IP / nghk sources (demote only; health labels handle dead).
 */
export function healPrivatePlaylistSources(
  slug: string,
  title: string | null | undefined,
  sources: MediaSource[],
): { sources: MediaSource[]; tags: string[]; notice?: string | null } {
  const tags: string[] = [];
  let next = [...sources];
  let notice: string | null = null;

  if (isTraceChannel(slug, title)) {
    next = healTraceSources(slug, title, next);
    tags.push("Healed", "Playable");
    if (usesTraceUrbanFallback(slug, title)) {
      tags.push(TRACE_URBAN_FALLBACK_TAG);
    }
  }

  const overridePack = overrideHealPack(slug);
  if (overridePack) {
    next = mergeSources(overridePack, next);
    tags.push("Healed", "Playable");
  }

  const brand = brandHealPack(slug, title);
  if (brand) {
    next = mergeSources(brand.sources, next);
    tags.push(...brand.tags);
    notice = brand.notice;
  }

  const zaPack = healZaPackOnly(slug, title);
  if (zaPack) {
    next = mergeSources(zaPack, next);
    tags.push("Healed", "Playable");
    if (isGeoSensitiveChannel(slug, title)) tags.push("Geo");
  } else if (
    !overridePack &&
    !brand &&
    next.some((s) => isFragileHost(s.url) || isRawIpUrl(s.url))
  ) {
    next = mergeSources([], next);
    tags.push("ProxyOk");
  }

  const rewritten = applyHostRewrites(next);
  next = rewritten.sources;
  if (rewritten.rewritten > 0) tags.push("Healed", "Playable");

  next = stripSabcSisterSwaps(slug, title, next);

  if (next.some((s) => isPlutoFamily(s.url))) {
    tags.push("ProxyOk", "Playable");
  }

  if (isArenaPayLinear(slug, title)) {
    tags.push("LinearPay", "LinearSports", "Sports", "Rights");
  }

  return { sources: next, tags: [...new Set(tags)], notice };
}

/**
 * Heal all known fragile catalogue families for go-live.
 * Returns possibly expanded sources + category tags to merge.
 */
export function healChannelSources(
  item: Pick<CatalogItem, "slug" | "title" | "sources" | "categories">,
): {
  sources: MediaSource[];
  tags: string[];
  cleared?: boolean;
  notice?: string | null;
} {
  const tags: string[] = [];
  let sources = [...(item.sources || [])];
  let notice: string | null = null;

  if (isArenaPayLinear(item.slug, item.title)) {
    return {
      sources: [],
      tags: ["LinearPay", "LinearSports", "Sports", "Rights"],
      cleared: true,
    };
  }

  if (isTraceChannel(item.slug, item.title)) {
    sources = healTraceSources(item.slug, item.title, sources);
    tags.push("Healed", "Playable");
    if (usesTraceUrbanFallback(item.slug, item.title)) {
      tags.push(TRACE_URBAN_FALLBACK_TAG);
    }
  }

  const overridePack = overrideHealPack(item.slug);
  if (overridePack) {
    sources = mergeSources(overridePack, sources);
    tags.push("Healed", "Playable");
  }

  const brand = brandHealPack(item.slug, item.title);
  if (brand) {
    sources = mergeSources(brand.sources, sources);
    tags.push(...brand.tags);
    notice = brand.notice;
  }

  const zaPack = healZaPackOnly(item.slug, item.title);
  if (zaPack) {
    sources = mergeSources(zaPack, sources);
    tags.push("Healed", "Playable");
    if (isGeoSensitiveChannel(item.slug, item.title, item.categories)) {
      tags.push("Geo");
    }
  } else if (
    !overridePack &&
    !brand &&
    sources.some((s) => isFragileHost(s.url) || isRawIpUrl(s.url))
  ) {
    sources = mergeSources([], sources);
    tags.push("ProxyOk");
  }

  const rewritten = applyHostRewrites(sources);
  sources = rewritten.sources;
  if (rewritten.rewritten > 0) tags.push("Healed", "Playable");

  sources = sources.filter((s) => !isRawIpUrl(s.url) && !/nghk\.ai/i.test(s.url));
  sources = stripSabcSisterSwaps(item.slug, item.title, sources);

  if (sources.some((s) => isPlutoFamily(s.url))) {
    tags.push("ProxyOk", "Playable");
  }

  return { sources, tags: [...new Set(tags)], notice };
}

export function needsDeepBuffer(item: {
  slug: string;
  title?: string | null;
  categories?: string[];
  sources?: MediaSource[];
}): boolean {
  if (
    item.categories?.some((c) =>
      /Healed|Geo|LinearSports|ProxyOk|Music|Sports|News|SisterFallback/i.test(
        c,
      ),
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

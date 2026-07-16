import type { CatalogItem, MediaSource } from "@/data/types";
import overridesJson from "@/data/generated/channel-overrides.json";
import {
  healTraceSources,
  isBrokenTraceOrigin,
  isTraceChannel,
  primaryTraceHealUrl,
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
const DW_EN =
  "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8";
const FRANCE24_EN =
  "https://static.france24.com/live/F24_EN_HI_HLS/live_web.m3u8";
const AL_JAZEERA_EN = "https://cdn-7.pishow.tv/live/429/master.m3u8";
const CGTN = "https://live.cgtn.com/1000e/prog_index.m3u8";
const RED_BULL =
  "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8";
const BOK_TV = "https://livestream2.bokradio.co.za/hls/Bok5c.m3u8";
const BEIN_XTRA = "https://bein-xtra-bein.amagi.tv/playlist.m3u8";
const FOX_WEATHER = "https://247wlive.foxweather.com/stream/index.m3u8";
const ESPN8_OCHO =
  "https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8";
const TSN_OCHO =
  "https://d3pnbvng3bx2nj.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-rds8g35qfqrnv/TSN_The_Ocho.m3u8";

const channelOverrides = overridesJson as Record<
  string,
  { title?: string; url?: string; note?: string; categories?: string[] }
>;

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

/** Slug / title → preferred open mirrors (prepended). */
export function healPackFor(slug: string, title?: string | null): Pack | null {
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
  if (/\bbok[\s_-]?tv\b/.test(hay)) {
    return [src(BOK_TV, 5, "heal-bok-tv")];
  }
  if (
    /deutsche.?welle|dw[\s_-]?english|dwenglish|(?:^|[\s_-])dw(?:[\s_-]english|\b)/.test(
      hay,
    )
  ) {
    return [src(DW_EN, 5, "heal-dw-english")];
  }
  if (/france[\s_-]?24/.test(hay)) {
    return [src(FRANCE24_EN, 5, "heal-france24-en")];
  }
  if (/al[\s_-]?jazeera/.test(hay)) {
    return [src(AL_JAZEERA_EN, 5, "heal-al-jazeera-en")];
  }
  if (/\bcgtn\b/.test(hay)) {
    return [src(CGTN, 5, "heal-cgtn")];
  }
  if (/red[\s_-]?bull/.test(hay)) {
    return [src(RED_BULL, 5, "heal-red-bull")];
  }
  // Free FAST only — never remap pay ESPN / TSN linear numbers.
  if (/espn[\s_-]?8|espn8|the[\s_-]?ocho/.test(hay) && /espn/.test(hay)) {
    return [src(ESPN8_OCHO, 5, "heal-espn8-ocho")];
  }
  if (/tsn[\s_-]?the[\s_-]?ocho|tsntheocho/.test(hay)) {
    return [src(TSN_OCHO, 5, "heal-tsn-ocho")];
  }
  if (/fox[\s_-]?weather/.test(hay)) {
    return [src(FOX_WEATHER, 5, "heal-fox-weather")];
  }
  // BBC Food — CloudFront plays direct from ZA; Pluto stitcher/jmp2 are dead here.
  if (/bbc[\s_-]?food|bbcfood/.test(hay)) {
    return [
      src(
        "https://d1e9r0b71zfwk7.cloudfront.net/playlist.m3u8",
        5,
        "heal-bbc-food-cf",
      ),
    ];
  }

  // beIN XTRA FAST (open Amagi) — not pay beIN numbered linears.
  if (/bein/.test(hay) && /xtra|extra/.test(hay)) {
    return [src(BEIN_XTRA, 5, "heal-bein-xtra")];
  }
  // Curated catalog maps dead beIN Sports USA restream → XTRA FAST.
  if (/beinsportsusa|bein[\s_-]?sports[\s_-]?usa\b/.test(hay) && !/xtra|extra|haber/.test(hay)) {
    return [src(BEIN_XTRA, 5, "heal-bein-usa-xtra")];
  }

  // Italian TeleArena — Wowza/streamlock already used elsewhere in playable packs
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

/** Curated slug override URL when present (open / verified only). */
export function overrideHealUrl(slug: string): string | null {
  const url = channelOverrides[slug]?.url?.trim();
  return url || null;
}

function overrideHealPack(slug: string): Pack | null {
  const url = overrideHealUrl(slug);
  if (!url) return null;
  return [src(url, 4, `heal-override-${slug}`)];
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
  return healPackFor(slug, title)?.[0]?.url ?? null;
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
 * Private playlist healing — Trace + open FTA packs + curated overrides.
 * Unlike healChannelSources, NEVER clears Arena/Fox/TSN/ESPN user URLs
 * and NEVER drops raw-IP / nghk sources (demote only; health labels handle dead).
 */
export function healPrivatePlaylistSources(
  slug: string,
  title: string | null | undefined,
  sources: MediaSource[],
): { sources: MediaSource[]; tags: string[] } {
  const tags: string[] = [];
  let next = [...sources];

  // 1) Trace music / sports family → Amagi FAST
  if (isTraceChannel(slug, title)) {
    next = healTraceSources(slug, title, next);
    tags.push("Healed", "Playable");
  }

  // 2) Curated slug overrides (India news, beIN→XTRA, Trace Sport, etc.)
  const overridePack = overrideHealPack(slug);
  if (overridePack) {
    next = mergeSources(overridePack, next);
    tags.push("Healed", "Playable");
  }

  // 3) Known FTA / open FAST packs — merge without wiping user URLs
  const pack = healPackFor(slug, title);
  if (pack) {
    next = mergeSources(pack, next);
    tags.push("Healed", "Playable");
    if (isGeoSensitiveChannel(slug, title)) {
      tags.push("Geo");
    }
  } else if (
    !overridePack &&
    next.some((s) => isFragileHost(s.url) || isRawIpUrl(s.url))
  ) {
    // Demote fragile / raw-IP hosts; keep them as last resort
    next = mergeSources([], next);
    tags.push("ProxyOk");
  }

  // 4) Pluto / jmp2 — proxy + deep buffer (do not replace URLs)
  if (next.some((s) => isPlutoFamily(s.url))) {
    tags.push("ProxyOk", "Playable");
  }

  // 5) Pay-linear brands stay on owner URLs — surface rights warning only
  if (isArenaPayLinear(slug, title)) {
    tags.push("LinearPay", "LinearSports", "Sports", "Rights");
  }

  return { sources: next, tags: [...new Set(tags)] };
}

/**
 * Heal all known fragile catalogue families for go-live.
 * Returns possibly expanded sources + category tags to merge.
 */
export function healChannelSources(
  item: Pick<CatalogItem, "slug" | "title" | "sources" | "categories">,
): { sources: MediaSource[]; tags: string[]; cleared?: boolean } {
  const tags: string[] = [];
  let sources = [...(item.sources || [])];

  // 0) Arena Sport / Fight / Premium — show as linear pay (no pirate HLS)
  if (isArenaPayLinear(item.slug, item.title)) {
    return {
      sources: [],
      tags: ["LinearPay", "LinearSports", "Sports", "Rights"],
      cleared: true,
    };
  }

  // 1) Trace music / sports family → Amagi FAST (public catalog + DB seeds)
  if (isTraceChannel(item.slug, item.title)) {
    sources = healTraceSources(item.slug, item.title, sources);
    tags.push("Healed", "Playable");
  }

  // 2) Curated slug overrides (same pack used for private playlists / africa.json)
  const overridePack = overrideHealPack(item.slug);
  if (overridePack) {
    sources = mergeSources(overridePack, sources);
    tags.push("Healed", "Playable");
  }

  // 3) ZA FTA / news / hope / TeleArena packs
  const pack = healPackFor(item.slug, item.title);
  if (pack) {
    sources = mergeSources(pack, sources);
    tags.push("Healed", "Playable");
    if (isGeoSensitiveChannel(item.slug, item.title, item.categories)) {
      tags.push("Geo");
    }
  } else if (
    !overridePack &&
    sources.some((s) => isFragileHost(s.url) || isRawIpUrl(s.url))
  ) {
    // Demote fragile / raw-IP hosts even without a dedicated pack
    sources = mergeSources([], sources);
    tags.push("ProxyOk");
  }

  // Drop raw-IP and nghk restreams that survived merge
  sources = sources.filter((s) => !isRawIpUrl(s.url) && !/nghk\.ai/i.test(s.url));

  // 4) Pluto / jmp2 series — keep URLs but tag for proxy + deep buffer
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

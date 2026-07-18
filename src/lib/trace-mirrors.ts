import type { MediaSource } from "@/data/types";

/**
 * Trace+ origin (`channels.trace.plus`) is frequently SSL/geo blocked (esp. ZA).
 * Prefer open Amagi FAST mirrors — same approach as curated Africa Trace tiles.
 *
 * Regional Trace music (Africa / Southern Africa / Gospel / Mziki / …) often has
 * no open dedicated FAST feed. Those heal onto Trace Urban Amagi — surface
 * `TraceUrbanFallback` so the UI can say so instead of a silent swap.
 */

export const TRACE_URBAN_FALLBACK_NOTICE =
  "Switching to Trace Urban — regional feed unavailable";

/** Category tag merged onto healed regional Trace entries. */
export const TRACE_URBAN_FALLBACK_TAG = "TraceUrbanFallback";

const TRACE_URBAN: MediaSource[] = [
  // Prefer CORS-friendly Amagi hosts for browser direct play.
  // lightning-*.amagi.tv often omits ACAO and stalls behind /api/hls 502s.
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-traceurban-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 8,
    label: "trace-amagi-tcl",
  },
  {
    url: "https://amg01131-tracetv-amg01131c1-rakuten-us-1081.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg01131-tracetvfast-traceurban-rakutenus/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 9,
    label: "trace-amagi-rakuten",
  },
  {
    url: "https://lightning-traceurban-samsungau.amagi.tv/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 12,
    label: "trace-amagi-au",
  },
];

const TRACE_LATINA: MediaSource[] = [
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-tracelatina-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 8,
    label: "trace-latina-tcl",
  },
  {
    url: "https://amg01131-tracetv-tracelatina-klowdtv-v10em.amagi.tv/playlist/amg01131-tracetv-tracelatina-klowdtv/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 9,
    label: "trace-latina-klowd",
  },
];

const TRACE_BRAZUCA: MediaSource[] = [
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-tracebrazuca-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 8,
    label: "trace-brazuca-tcl",
  },
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01131-tracetv-tracebrazuca-xiaomi/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 9,
    label: "trace-brazuca-xiaomi",
  },
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01131-tracetv-tracebrazuca-samsungbr/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 10,
    label: "trace-brazuca-br",
  },
];

const TRACE_SPORT: MediaSource[] = [
  {
    url: "https://lightning-tracesport-samsungau.amagi.tv/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 8,
    label: "trace-sport-amagi",
  },
];

const TRACE_UK: MediaSource[] = [
  {
    url: "https://amg01131-tracetv-amg01131c5-stirr-us-4389.playouts.now.amagi.tv/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 8,
    label: "trace-uk-stirr",
  },
];

export function isTraceChannel(slug: string, title?: string | null): boolean {
  const hay = `${slug} ${title || ""}`.toLowerCase();
  // iptv-org uses concatenated slugs (tracegospel-fr-…, tracesportstars-fr-…)
  // where `\btrace\b` does not match — also accept Trace* brand prefixes.
  return (
    /\btrace\b/.test(hay) ||
    /^trace[a-z0-9]/.test(slug.toLowerCase()) ||
    /(?:^|[^a-z])trace(?:urban|gospel|latina|brazuca|sport|africa|ayiti|caribbean|ivoire|naija|mziki|kitoko|mboa|muzika|ngoma|toca|jama|uk|teranga|afrikora|vanillaislands)/i.test(
      hay,
    )
  );
}

export function isBrokenTraceOrigin(url: string): boolean {
  return /channels\.trace\.plus|trace\.tv\/|encrypted\.m3u8\?ads/i.test(url);
}

export function isTraceUrbanMirrorUrl(url: string): boolean {
  return /traceurban|trace-urban|trace[\s_-]*urban/i.test(url);
}

type TraceFlavor =
  | "urban"
  | "latina"
  | "brazuca"
  | "sport"
  | "uk"
  | "gospel"
  | "generic";

function flavorFor(slug: string, title?: string | null): TraceFlavor {
  const hay = `${slug} ${title || ""}`.toLowerCase();
  if (/latina|latinx/.test(hay)) return "latina";
  if (/brazuca|brasil|brazil|ayiti|haiti|caribbean|toca|jama/.test(hay))
    return "brazuca";
  if (/sport/.test(hay)) return "sport";
  if (/\buk\b/.test(hay)) return "uk";
  if (/gospel/.test(hay)) return "gospel";
  if (/urban|africa|mziki|naija|kitoko|mboa|muzika|ngoma|ivoire|teranga/.test(hay))
    return "urban";
  return "generic";
}

/**
 * Canonical open Trace Urban FAST (International / France / plain Urban).
 * Regional Urban Africa / Southern Africa / Gospel / Africa music → not canonical
 * (they heal onto Urban as a sister feed).
 */
export function isCanonicalTraceUrban(
  slug: string,
  title?: string | null,
): boolean {
  if (!isTraceChannel(slug, title)) return false;
  const hay = `${slug} ${title || ""}`.toLowerCase();
  if (
    /gospel|latina|brazuca|sport|ayiti|caribbean|mziki|naija|ivoire|kitoko|mboa|muzika|ngoma|teranga|toca|jama|afrikora|vanilla/.test(
      hay,
    )
  ) {
    return false;
  }
  // Trace Africa (no "urban") is a different linear — not Urban FAST.
  if (/\bafrica\b/.test(hay) && !/urban/.test(hay)) return false;
  // Urban Southern Africa / Urban SA / Urban Africa → regional, Urban is sister.
  if (
    /urban/.test(hay) &&
    (/southern|southernafrica|urban[\s_-]?sa\b|[\s_-]sa\b/.test(hay) ||
      /\bafrica\b/.test(hay))
  ) {
    return false;
  }
  return /urban/.test(hay) || /^trace-urban/.test(slug.toLowerCase());
}

/**
 * True when the best open heal for this Trace title is Trace Urban Amagi
 * because a dedicated regional feed is not available as open FAST.
 */
export function usesTraceUrbanFallback(
  slug: string,
  title?: string | null,
): boolean {
  if (!isTraceChannel(slug, title)) return false;
  const flavor = flavorFor(slug, title);
  if (
    flavor === "latina" ||
    flavor === "brazuca" ||
    flavor === "sport" ||
    flavor === "uk"
  ) {
    return false;
  }
  if (isCanonicalTraceUrban(slug, title)) return false;
  return true;
}

export function hasTraceUrbanFallbackTag(
  categories: string[] | null | undefined,
): boolean {
  return Boolean(
    categories?.some((c) => c === TRACE_URBAN_FALLBACK_TAG),
  );
}

/** Absolute https stream that looks like a usable own/regional feed (not Urban Amagi). */
function isPreferableOwnTraceSource(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isBrokenTraceOrigin(url)) return false;
  if (isTraceUrbanMirrorUrl(url)) return false;
  // Skip hosts we already treat as sticky / geo-fragile in channel-heal.
  if (
    /blocked\.grouptag|streamvidex|qzz\.io|live20\.bozztv\.com|nghk\.ai|sinalmycn\.com|lb\.dstvmultimedia\.com/i.test(
      url,
    )
  ) {
    return false;
  }
  return true;
}

/** Working Amagi FAST mirrors for a Trace catalogue entry. */
export function traceHealMirrors(
  slug: string,
  title?: string | null,
): MediaSource[] {
  switch (flavorFor(slug, title)) {
    case "latina":
      return [...TRACE_LATINA, ...TRACE_URBAN.slice(0, 1)];
    case "brazuca":
      return [...TRACE_BRAZUCA, ...TRACE_URBAN.slice(0, 1)];
    case "sport":
      return [...TRACE_SPORT, ...TRACE_URBAN.slice(0, 1)];
    case "uk":
      return [...TRACE_UK, ...TRACE_URBAN.slice(0, 1)];
    case "gospel":
      return [...TRACE_URBAN];
    case "urban":
    case "generic":
    default:
      return [...TRACE_URBAN];
  }
}

/** Best open mirror when a Trace+ CDN URL cannot be played. */
export function primaryTraceHealUrl(
  slug: string,
  title?: string | null,
): string | null {
  return traceHealMirrors(slug, title)[0]?.url ?? null;
}

/**
 * Put the best Trace feed first:
 * - Prefer a working own/regional https source when present
 * - Else Amagi flavor mirrors (Urban for regional music / Gospel)
 * - Demote dead Trace+ CDN URLs to last resort
 */
export function healTraceSources(
  slug: string,
  title: string | null | undefined,
  sources: MediaSource[],
): MediaSource[] {
  if (!isTraceChannel(slug, title)) return sources;

  const seen = new Set<string>();
  const out: MediaSource[] = [];
  const push = (s: MediaSource, priorityBoost = 0) => {
    if (!s.url || seen.has(s.url)) return;
    seen.add(s.url);
    out.push({
      ...s,
      priority: (s.priority ?? 100) + priorityBoost,
    });
  };

  const urbanFallback = usesTraceUrbanFallback(slug, title);
  const ownGood: MediaSource[] = [];
  const otherGood: MediaSource[] = [];
  const bad: MediaSource[] = [];

  for (const s of sources) {
    if (isBrokenTraceOrigin(s.url)) bad.push(s);
    else if (urbanFallback && isPreferableOwnTraceSource(s.url)) ownGood.push(s);
    else otherGood.push(s);
  }

  // Regional Trace: keep a healthy own feed ahead of Urban sister mirrors.
  if (urbanFallback) {
    for (const s of ownGood) push(s, 0);
    for (const m of traceHealMirrors(slug, title)) push(m, 10);
    for (const s of otherGood) push(s, 40);
  } else {
    for (const m of traceHealMirrors(slug, title)) push(m, 0);
    for (const s of [...ownGood, ...otherGood]) push(s, 40);
  }
  for (const s of bad)
    push({ ...s, label: s.label || "trace-plus-fallback" }, 800);

  return out;
}

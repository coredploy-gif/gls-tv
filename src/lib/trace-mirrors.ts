import type { MediaSource } from "@/data/types";

/**
 * Trace+ origin (`channels.trace.plus`) is frequently SSL/geo blocked (esp. ZA).
 * Prefer open Amagi FAST mirrors — same approach as curated Africa Trace tiles.
 */

const TRACE_URBAN: MediaSource[] = [
  {
    url: "https://lightning-traceurban-samsungau.amagi.tv/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 8,
    label: "trace-amagi-au",
  },
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-traceurban-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 9,
    label: "trace-amagi-tcl",
  },
  {
    url: "https://amg01131-tracetv-amg01131c1-rakuten-us-1081.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg01131-tracetvfast-traceurban-rakutenus/playlist.m3u8",
    quality: "HD",
    format: "hls",
    priority: 11,
    label: "trace-amagi-rakuten",
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
  return /\btrace\b/.test(hay);
}

export function isBrokenTraceOrigin(url: string): boolean {
  return /channels\.trace\.plus|trace\.tv\/|encrypted\.m3u8\?ads/i.test(url);
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

/**
 * Put Amagi Trace mirrors first; demote dead Trace+ CDN URLs to last resort.
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

  for (const m of traceHealMirrors(slug, title)) push(m, 0);

  const good: MediaSource[] = [];
  const bad: MediaSource[] = [];
  for (const s of sources) {
    if (isBrokenTraceOrigin(s.url)) bad.push(s);
    else good.push(s);
  }
  for (const s of good) push(s, 40);
  for (const s of bad) push({ ...s, label: s.label || "trace-plus-fallback" }, 800);

  return out;
}

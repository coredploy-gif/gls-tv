import type { CatalogItem } from "@/data/types";

export type IptvChannel = CatalogItem & {
  tvgId?: string | null;
};

export type M3uParseStats = {
  parsed: number;
  skipped: number;
  invalid: number;
  duplicates: number;
  truncated: number;
  kind: "channel-list" | "hls-master" | "hls-media" | "unknown";
};

export type M3uParseResult = {
  channels: IptvChannel[];
  stats: M3uParseStats;
};

function httpUrl(raw: string, baseUrl?: string) {
  try {
    const url = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function attributes(line: string) {
  const result = new Map<string, string>();
  const meta = line.slice(0, line.lastIndexOf(",") >= 0 ? line.lastIndexOf(",") : undefined);
  const re = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/gi;
  for (const match of meta.matchAll(re)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function manifestKind(lines: string[]): M3uParseStats["kind"] {
  const upper = lines.map((line) => line.toUpperCase());
  if (upper.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) return "hls-master";
  if (
    upper.some((line) =>
      /#EXT-X-(TARGETDURATION|MEDIA-SEQUENCE|PLAYLIST-TYPE|ENDLIST)/.test(line),
    )
  ) {
    return "hls-media";
  }
  return upper.some((line) => line.startsWith("#EXTINF")) ? "channel-list" : "unknown";
}

function titleFromStreamUrl(streamUrl: string) {
  try {
    const leaf =
      new URL(streamUrl).pathname.split("/").filter(Boolean).pop() || "stream";
    const cleaned = leaf
      .replace(/\.m3u8$/i, "")
      .replace(/[+_-]+/g, " ")
      .trim();
    return cleaned.slice(0, 80) || "Imported stream";
  } catch {
    return "Imported stream";
  }
}

/** Build a one-channel IPTV entry from a direct HLS master/media URL. */
export function channelFromSingleHls(
  streamUrl: string,
  options: { defaultCountry?: string; forceCategory?: string; title?: string } = {},
): IptvChannel {
  const title = (options.title || titleFromStreamUrl(streamUrl)).slice(0, 200);
  const group = options.forceCategory || "Imported";
  const slug =
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "imported-stream";
  const fallbackArt =
    "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1200&q=80";
  return {
    id: `iptv-${slug}`,
    slug,
    title,
    type: "live",
    description: `${group} live channel`,
    countries: [options.defaultCountry || "world"],
    categories: [group],
    languages: [],
    poster: fallbackArt,
    backdrop: fallbackArt,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: streamUrl,
        quality: "Auto",
        format: /\.m3u8(?:$|\?)/i.test(streamUrl) ? "hls" : "mp4",
      },
    ],
    tvgId: null,
  };
}

export function parseM3uDetailed(
  text: string,
  options: {
    defaultCountry?: string;
    forceCategory?: string;
    baseUrl?: string;
    maxChannels?: number;
    /** When set, HLS master/media manifests become one channel pointing at this URL. */
    singleStreamUrl?: string;
    /** Friendly title for single-stream imports (overrides URL leaf). */
    singleStreamTitle?: string;
  } = {},
): M3uParseResult {
  const {
    defaultCountry = "world",
    forceCategory,
    baseUrl,
    maxChannels = Number.POSITIVE_INFINITY,
    singleStreamUrl,
  } = options;
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n?|\n|\u2028|\u2029/);
  const kind = manifestKind(lines);
  const stats: M3uParseStats = {
    parsed: 0,
    skipped: 0,
    invalid: 0,
    duplicates: 0,
    truncated: 0,
    kind,
  };
  if (kind === "hls-master" || kind === "hls-media") {
    const stream = singleStreamUrl ? httpUrl(singleStreamUrl) : null;
    if (stream) {
      stats.parsed = 1;
      return {
        channels: [
          channelFromSingleHls(stream, {
            defaultCountry,
            forceCategory,
            title: options.singleStreamTitle,
          }),
        ],
        stats,
      };
    }
    stats.invalid = 1;
    return { channels: [], stats };
  }

  const items: IptvChannel[] = [];
  const seen = new Set<string>();
  let pending: { line: string; lineNumber: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (/^#EXTINF\s*:/i.test(line)) {
      if (pending) stats.skipped += 1;
      pending = { line, lineNumber: i + 1 };
      continue;
    }
    if (!pending || !line || line.startsWith("#")) continue;

    const info = pending;
    pending = null;
    const streamUrl = httpUrl(line, baseUrl);
    if (!streamUrl) {
      stats.invalid += 1;
      continue;
    }

    const comma = info.line.lastIndexOf(",");
    const title = (comma >= 0 ? info.line.slice(comma + 1) : "Unknown").trim();
    const attr = attributes(info.line);
    const tvgId = attr.get("tvg-id") || "";
    const rawLogo = attr.get("tvg-logo") || "";
    const logo = rawLogo ? httpUrl(rawLogo, baseUrl) : null;
    const group = attr.get("group-title") || forceCategory || "General";
    const dedupeKey = `${tvgId.toLowerCase() || title.toLowerCase()}\u0000${streamUrl}`;
    if (seen.has(dedupeKey)) {
      stats.duplicates += 1;
      continue;
    }
    seen.add(dedupeKey);
    if (items.length >= maxChannels) {
      stats.truncated += 1;
      continue;
    }

    let country = defaultCountry;
    const cm = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
    if (cm?.[1]) country = cm[1].toLowerCase();
    const qm = title.match(/\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)/i);
    const quality = qm?.[1]?.toUpperCase() ?? "Auto";
    const categories = [
      ...new Set(
        group
          .split(/[;,]/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (
      forceCategory &&
      !categories.some((category) => category.toLowerCase() === forceCategory.toLowerCase())
    ) {
      categories.unshift(forceCategory);
    }
    const idBase = (tvgId || title).toLowerCase().replace(/[^a-z0-9@.]+/g, "-");
    const slug =
      idBase.replace(/[@.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
      `ch-${info.lineNumber}`;
    const cleanTitle =
      title.replace(/\s*\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)\s*$/i, "").trim() ||
      title;
    const fallbackArt =
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1200&q=80";

    items.push({
      id: `iptv-${slug}`,
      slug,
      title: cleanTitle,
      type: "live",
      description: `${categories.join(" · ")} live channel`,
      countries: [country],
      categories,
      languages: [],
      poster: logo || fallbackArt,
      backdrop: logo || fallbackArt,
      license: "open_stream",
      isLive: true,
      sources: [
        {
          url: streamUrl,
          quality,
          format: /\.m3u8(?:$|\?)/i.test(streamUrl) ? "hls" : "mp4",
        },
      ],
      tvgId: tvgId || null,
    });
  }
  if (pending) stats.skipped += 1;
  stats.parsed = items.length;
  return { channels: items, stats };
}

export function parseM3u(
  text: string,
  options: { defaultCountry?: string; forceCategory?: string; baseUrl?: string } = {},
): IptvChannel[] {
  return parseM3uDetailed(text, options).channels;
}

const MATCH_DAY_RE =
  /\b(espn|sky sports|bein|dazn|premier|fifa|world cup|olympics|nba|nfl|mlb|nhl|uefa|champions|tennis|golf|f1|formula|cricket|rugby|boxing|ufc|moto|olympi|match)\b/i;

export function pickMatchDay(channels: CatalogItem[], limit = 16) {
  const ranked = channels
    .map((ch) => {
      const hay = `${ch.title} ${ch.categories.join(" ")}`;
      let score = 0;
      if (MATCH_DAY_RE.test(hay)) score += 5;
      if (/1080|4K|UHD|FHD/i.test(ch.sources[0]?.quality ?? "")) score += 2;
      if (ch.countries.includes("us") || ch.countries.includes("gb")) score += 1;
      return { ch, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.ch);

  const unique = new Map<string, CatalogItem>();
  for (const ch of ranked) {
    if (!unique.has(ch.id)) unique.set(ch.id, ch);
    if (unique.size >= limit) break;
  }
  return [...unique.values()];
}

export function groupByCountry(channels: CatalogItem[]) {
  const map = new Map<string, CatalogItem[]>();
  for (const ch of channels) {
    const code = ch.countries[0] || "world";
    const list = map.get(code) ?? [];
    list.push(ch);
    map.set(code, list);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

export function groupByCategory(channels: CatalogItem[]) {
  const map = new Map<string, CatalogItem[]>();
  for (const ch of channels) {
    for (const cat of ch.categories.length ? ch.categories : ["General"]) {
      const list = map.get(cat) ?? [];
      list.push(ch);
      map.set(cat, list);
    }
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

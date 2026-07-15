/**
 * Targets we cherry-pick from the public iptv-org index.m3u.
 * Only rows that actually exist in that playlist are seeded — no invented URLs.
 */

export type IptvOrgTarget = {
  /** Canonical GLS slug (stream_seeds + curated tiles) */
  slug: string;
  title: string;
  /** Match against EXTINF display name (and tvg-id if present) */
  match: RegExp[];
  categories?: string[];
  countries?: string[];
};

/** Crowdsourced public index (~13k). Parse server-side only — never in the PWA. */
export const IPTV_ORG_INDEX_FULL =
  "https://iptv-org.github.io/iptv/index.m3u";

/** Smaller country playlists when you only need one region (faster sync). */
export const IPTV_ORG_COUNTRY = (code: string) =>
  `https://iptv-org.github.io/iptv/countries/${code.toLowerCase()}.m3u`;
export const IPTV_ORG_TARGETS: IptvOrgTarget[] = [
  {
    slug: "sabc-1",
    title: "SABC 1",
    match: [/^sabc\s*1\b/i],
    categories: ["General", "Africa", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "sabc-2",
    title: "SABC 2",
    match: [/^sabc\s*2\b/i],
    categories: ["General", "Africa", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "sabc-3",
    title: "SABC 3",
    match: [/^sabc\s*3\b/i],
    categories: ["General", "Africa", "Geo", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "sabc-news",
    title: "SABC News",
    match: [/^sabc\s*news/i],
    categories: ["News", "Africa", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "zbc-tv",
    title: "ZBC TV",
    match: [/^zbc(\s*tv)?\b/i],
    categories: ["General", "Africa", "Popular", "UserSeed"],
    countries: ["zw", "world"],
  },
];

export type ExtractedMatch = {
  slug: string;
  title: string;
  playlistTitle: string;
  url: string;
  logo: string;
  group: string;
  categories: string[];
  countries: string[];
};

function attr(line: string, key: string) {
  const m = line.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return m?.[1]?.trim() || "";
}

function scoreUrl(url: string) {
  let s = 0;
  if (url.startsWith("https://")) s += 50;
  if (/\.m3u8(\?|$)/i.test(url)) s += 30;
  if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url)) s -= 40;
  return s;
}

const HTTPS_FALLBACKS: Record<string, string[]> = {};

async function probeHls(url: string) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "GLS-TV/1.0" },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const text = (await res.text()).slice(0, 200);
    return /#EXTM3U/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Stream-parse an M3U body and return at most one best URL per target slug.
 * Skips targets with no match in the playlist.
 */
export async function extractTargetsFromM3uAsync(
  text: string,
  targets: IptvOrgTarget[] = IPTV_ORG_TARGETS,
): Promise<ExtractedMatch[]> {
  const basic = extractTargetsFromM3u(text, targets);
  const out: ExtractedMatch[] = [];

  for (const row of basic) {
    let url = row.url;
    if (!(await probeHls(url))) {
      const alts = HTTPS_FALLBACKS[row.slug] || [];
      let rescued = false;
      for (const alt of alts) {
        if (await probeHls(alt)) {
          url = alt;
          rescued = true;
          break;
        }
      }
      if (!rescued) continue; // dead playlist entry — do not seed broken URL
    }
    out.push({ ...row, url });
  }

  // Targets with no playlist hit but HTTPS fallback available
  for (const t of targets) {
    if (out.some((r) => r.slug === t.slug)) continue;
    const alts = HTTPS_FALLBACKS[t.slug] || [];
    for (const alt of alts) {
      if (await probeHls(alt)) {
        out.push({
          slug: t.slug,
          title: t.title,
          playlistTitle: t.title,
          url: alt,
          logo: "",
          group: "Sports",
          categories: t.categories || ["Sports", "UserSeed"],
          countries: t.countries || ["world"],
        });
        break;
      }
    }
  }

  return out;
}

/**
 * Stream-parse an M3U body and return at most one best URL per target slug.
 * Skips targets with no match in the playlist.
 */
export function extractTargetsFromM3u(
  text: string,
  targets: IptvOrgTarget[] = IPTV_ORG_TARGETS,
): ExtractedMatch[] {
  const lines = text.split(/\r?\n/);
  const best = new Map<string, ExtractedMatch & { _score: number }>();

  let pending: {
    target: IptvOrgTarget;
    playlistTitle: string;
    logo: string;
    group: string;
  } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      pending = null;
      const playlistTitle = line.split(",").pop()?.trim() || "";
      const tvgId = attr(line, "tvg-id");
      const hay = `${playlistTitle} ${tvgId}`.trim();
      const target = targets.find((t) =>
        t.match.some((re) => re.test(playlistTitle) || re.test(tvgId) || re.test(hay)),
      );
      if (!target) continue;
      pending = {
        target,
        playlistTitle,
        logo: attr(line, "tvg-logo"),
        group: attr(line, "group-title") || "General",
      };
      continue;
    }

    if (pending && /^https?:\/\//i.test(line)) {
      const url = line.trim();
      const score = scoreUrl(url);
      const prev = best.get(pending.target.slug);
      if (!prev || score > prev._score) {
        best.set(pending.target.slug, {
          slug: pending.target.slug,
          title: pending.target.title,
          playlistTitle: pending.playlistTitle,
          url,
          logo: pending.logo,
          group: pending.group,
          categories: pending.target.categories || ["Sports", "UserSeed"],
          countries: pending.target.countries || ["world"],
          _score: score,
        });
      }
      pending = null;
    }
  }

  return [...best.values()].map(({ _score: _, ...row }) => row);
}

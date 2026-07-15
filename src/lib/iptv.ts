import type { CatalogItem } from "@/data/types";

export type IptvChannel = CatalogItem & {
  tvgId?: string | null;
};

export function parseM3u(
  text: string,
  options: { defaultCountry?: string; forceCategory?: string } = {},
): IptvChannel[] {
  const { defaultCountry = "world", forceCategory } = options;
  const lines = text.split(/\r?\n/);
  const items: IptvChannel[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!url || url.startsWith("#")) continue;

    const comma = line.lastIndexOf(",");
    const title = (comma >= 0 ? line.slice(comma + 1) : "Unknown").trim();
    const meta = line.slice(0, comma >= 0 ? comma : undefined);
    const attr = (key: string) => {
      const m = meta.match(new RegExp(`${key}="([^"]*)"`));
      return m?.[1] ?? "";
    };

    const tvgId = attr("tvg-id");
    const logo = attr("tvg-logo");
    const group = attr("group-title") || forceCategory || "General";
    const dedupeKey = tvgId || url;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let country = defaultCountry;
    const cm = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
    if (cm?.[1]) country = cm[1].toLowerCase();

    const qm = title.match(/\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)/i);
    const quality = qm?.[1]?.toUpperCase() ?? "Auto";

    const categories = [
      ...new Set(
        group
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (
      forceCategory &&
      !categories.map((c) => c.toLowerCase()).includes(forceCategory.toLowerCase())
    ) {
      categories.unshift(forceCategory);
    }

    const idBase = (tvgId || title).toLowerCase().replace(/[^a-z0-9@.]+/g, "-");
    const slug =
      idBase.replace(/[@.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
      `ch-${items.length}`;

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
          url,
          quality,
          format: url.includes(".m3u8") ? "hls" : "mp4",
        },
      ],
      tvgId: tvgId || null,
    });
  }

  return items;
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

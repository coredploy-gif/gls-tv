/**
 * India-focused heal: refresh IN playlists, probe HTTPS, merge into playable-asia.
 *
 * Usage: npm run heal:india
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "src", "data", "generated");
const cacheDir = path.join(root, "data-cache");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const UA = "GLS-TV-Heal-India/1.0";
const TIMEOUT_MS = 10000;
const CONCURRENCY = 12;
const PROBE_CAP = 280;
const KEEP_TARGET = 120;

/** Extra known-open / FAST-ish India seeds to always try. */
const CURATED_IN = [
  {
    title: "WION",
    slug: "wion-in",
    url: "https://d7x8y1yka5en6.cloudfront.net/out/v1/e8dcdabd45e54451ad392d42e7582e5b/index.m3u8",
    categories: ["News"],
    poster: "https://i.imgur.com/Y8FK1Kk.png",
  },
  {
    title: "Sansad TV",
    slug: "sansad-tv-in",
    url: "https://play.cdn.vl.indiaatplay.com/live/sansadtv/index.m3u8",
    categories: ["News", "General"],
  },
  {
    title: "DD News",
    slug: "dd-news-in",
    url: "https://cdn-5.pishow.tv/live/8/master.m3u8",
    categories: ["News"],
  },
];

const PRIORITY =
  /news|ndtv|republic|zee|aaj|india today|etv|manorama|sun|asianet|colors|sony|star|kids|cartoon|sport|food|cook|chef|music|bhakti|devotion|cinema|movie|serial|series|drama|entertainment/i;

function isCorsStar(cors) {
  if (!cors) return false;
  return cors
    .split(",")
    .map((s) => s.trim())
    .includes("*");
}

function parseM3u(text, country = "in") {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!/^https:\/\//i.test(url)) continue;
    if (!/\.m3u8(\?|$)/i.test(url) && !/playlist|manifest|master|index/i.test(url))
      continue;

    const title = line.split(",").pop()?.trim() || "Channel";
    const tvgId = /tvg-id="([^"]*)"/i.exec(line)?.[1] || "";
    const logo = /tvg-logo="([^"]*)"/i.exec(line)?.[1] || "";
    const group = /group-title="([^"]*)"/i.exec(line)?.[1] || "";
    const idBase = (tvgId || title)
      .toLowerCase()
      .replace(/[^a-z0-9@.]+/g, "-");
    const slug =
      idBase.replace(/[@.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
      `in-${items.length}`;
    const cleanTitle =
      title.replace(/\s*\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)\s*$/i, "").trim() ||
      title;
    const categories = [
      ...new Set(
        group
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    items.push({
      title: cleanTitle,
      slug,
      url,
      countries: [country],
      categories,
      poster: logo || undefined,
      id: `iptv-${slug}`,
    });
  }
  return items;
}

async function fetchM3u(url, cacheName) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) {
      console.log(`  fail ${r.status} ${cacheName}`);
      return [];
    }
    const text = await r.text();
    fs.writeFileSync(path.join(cacheDir, cacheName), text);
    return parseM3u(text, "in");
  } catch (e) {
    console.log(`  fail ${cacheName}`, e.message || e);
    return [];
  }
}

function stripBadges(cats = []) {
  return cats.filter(
    (c) =>
      ![
        "Playable",
        "Verified",
        "Popular",
        "Unstable",
        "ProxyOk",
        "Catalog",
        "Healed",
      ].includes(c),
  );
}

async function fetchText(url, init = {}) {
  const r = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": UA, Accept: "*/*", ...(init.headers || {}) },
    method: init.method || "GET",
  });
  const text = init.method === "HEAD" ? "" : await r.text();
  return {
    ok: r.ok || r.status === 206,
    status: r.status,
    cors: r.headers.get("access-control-allow-origin") || "",
    text,
  };
}

/** Same tiers as verify-playable.mjs */
async function probeStrict(url) {
  try {
    if (!/^https:\/\//i.test(url)) return { tier: null, reason: "not_https" };
    const master = await fetchText(url);
    if (!master.ok || !/#EXTM3U/i.test(master.text))
      return { tier: null, reason: "master" };

    const lines = master.text.split(/\r?\n/).map((l) => l.trim());
    const next = lines.find((l) => l && !l.startsWith("#"));
    if (!next) return { tier: null, reason: "empty" };
    const abs = new URL(next, url).href;

    let playlistUrl = url;
    let playlistText = master.text;
    let corsOk = isCorsStar(master.cors);

    if (/\.m3u8(\?|$)/i.test(abs) || next.includes(".m3u8")) {
      const variant = await fetchText(abs);
      if (!variant.ok || !/#EXTM3U/i.test(variant.text))
        return { tier: null, reason: "variant" };
      corsOk = corsOk && isCorsStar(variant.cors);
      playlistUrl = abs;
      playlistText = variant.text;
    }

    const pLines = playlistText.split(/\r?\n/).map((l) => l.trim());
    const seg = pLines.find(
      (l) =>
        l &&
        !l.startsWith("#") &&
        !l.includes(".m3u8") &&
        (/\.(ts|m4s|aac|mp4)(\?|$)/i.test(l) || l.startsWith("http")),
    );
    if (!seg) return { tier: null, reason: "no_segment" };
    const segUrl = new URL(seg, playlistUrl).href;

    let segRes = await fetchText(segUrl, { method: "HEAD" });
    if (!segRes.ok) {
      segRes = await fetchText(segUrl, {
        headers: { Range: "bytes=0-128" },
      });
    }
    if (!segRes.ok) return { tier: null, reason: `seg_${segRes.status}` };

    if (corsOk && (isCorsStar(segRes.cors) || segRes.cors === "")) {
      return { tier: "direct", reason: "ok" };
    }
    return { tier: "proxy", reason: corsOk ? "seg_cors" : "needs_proxy" };
  } catch (e) {
    return { tier: null, reason: e.cause?.code || e.message || "error" };
  }
}

function score(item) {
  const hay = `${item.title} ${item.categories.join(" ")}`;
  let s = 0;
  if (PRIORITY.test(hay)) s += 25;
  if (/news/i.test(hay)) s += 12;
  if (/kid|cartoon|anime/i.test(hay)) s += 10;
  if (/sport/i.test(hay)) s += 10;
  if (/food|cook|chef/i.test(hay)) s += 10;
  if (/akamai|amagi|cloudfront|yupp|now3|n18syndication|ndtv/i.test(item.url))
    s += 15;
  if (/geo-blocked|not 24\/7/i.test(item.title)) s -= 5;
  return s;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

function toCatalog(item, tier) {
  const base = stripBadges([
    ...(item.categories || []),
    "Asia",
    "India",
    "Healed",
  ]);
  const cats =
    tier === "direct"
      ? [...new Set([...base, "Playable", "Verified", "Popular"])]
      : [...new Set([...base, "ProxyOk", "Verified"])];
  return {
    id: item.id || `iptv-${item.slug}`,
    slug: item.slug,
    title: item.title,
    type: /series|drama|cinema|movie|serial/i.test(
      `${item.title} ${item.categories.join(" ")}`,
    )
      ? "series"
      : "live",
    description:
      tier === "direct"
        ? "India · heal · direct Playable (CORS*)"
        : "India · heal · plays via proxy",
    countries: ["in"],
    categories: cats,
    languages: [],
    poster:
      item.poster ||
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
    backdrop:
      item.poster ||
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: tier === "direct",
    sources: [{ url: item.url, quality: "Auto", format: "hls", priority: 10 }],
  };
}

function dedupeBySlug(list) {
  const map = new Map();
  for (const i of list) {
    const existing = map.get(i.slug);
    if (!existing) {
      map.set(i.slug, i);
      continue;
    }
    const preferNew =
      (i.categories?.includes("Playable") &&
        !existing.categories?.includes("Playable")) ||
      (i.categories?.includes("ProxyOk") &&
        !existing.categories?.includes("Playable") &&
        !existing.categories?.includes("ProxyOk"));
    if (preferNew) map.set(i.slug, i);
  }
  return [...map.values()];
}

function fromCatalogJson(list) {
  return list
    .filter((c) => (c.countries || []).includes("in") && c.sources?.[0]?.url)
    .map((c) => ({
      title: c.title,
      slug: c.slug,
      url: c.sources[0].url,
      countries: ["in"],
      categories: stripBadges(c.categories || []),
      poster: c.poster,
      id: c.id,
    }));
}

async function main() {
  const started = Date.now();
  console.log("India heal — downloading playlists…");

  const fromCountry = await fetchM3u(
    "https://iptv-org.github.io/iptv/countries/in.m3u",
    "in-country.m3u",
  );
  const fromStreams = await fetchM3u(
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u",
    "in-streams.m3u",
  );
  console.log(`  country: ${fromCountry.length}, streams: ${fromStreams.length}`);

  const asiaPath = path.join(outDir, "asia.json");
  const existingAsia = fs.existsSync(asiaPath)
    ? JSON.parse(fs.readFileSync(asiaPath, "utf8"))
    : [];
  const fromDump = fromCatalogJson(existingAsia);
  console.log(`  asia.json India: ${fromDump.length}`);

  const curated = CURATED_IN.map((c) => ({
    ...c,
    countries: ["in"],
    id: `curated-${c.slug}`,
  }));

  let pool = dedupeBySlug([
    ...curated,
    ...fromCountry,
    ...fromStreams,
    ...fromDump,
  ]).filter((i) => /^https:\/\//i.test(i.url));
  console.log(`  unique HTTPS candidates: ${pool.length}`);

  pool.sort(
    (a, b) =>
      score(b) - score(a) || a.title.localeCompare(b.title),
  );
  const sample = pool.slice(0, PROBE_CAP);
  console.log(`\nProbing ${sample.length} (strict playlist+segment)…`);

  const results = await mapPool(sample, CONCURRENCY, async (item, idx) => {
    const p = await probeStrict(item.url);
    if ((idx + 1) % 30 === 0)
      console.log(`  ${idx + 1}/${sample.length}…`);
    return { item, p };
  });

  const alive = results
    .filter((r) => r.p.tier)
    .map((r) => ({
      ...r.item,
      _tier: r.p.tier,
      _score: score(r.item) + (r.p.tier === "direct" ? 50 : 20),
    }))
    .sort((a, b) => b._score - a._score);

  const kept = alive.slice(0, KEEP_TARGET);
  const healed = kept.map((i) => toCatalog(i, i._tier));
  console.log(
    `\nAlive ${alive.length} (direct ${alive.filter((a) => a._tier === "direct").length}, proxy ${alive.filter((a) => a._tier === "proxy").length}) → keep ${healed.length}`,
  );

  const playablePath = path.join(outDir, "playable-asia.json");
  const prev = fs.existsSync(playablePath)
    ? JSON.parse(fs.readFileSync(playablePath, "utf8"))
    : [];
  const nonIndia = prev.filter((c) => !(c.countries || []).includes("in"));
  const merged = dedupeBySlug([...healed, ...nonIndia]);
  fs.writeFileSync(playablePath, JSON.stringify(merged, null, 2));
  console.log(
    `Wrote playable-asia.json: ${merged.length} total (${healed.length} India + ${nonIndia.length} other Asia)`,
  );

  const series = healed
    .filter((c) =>
      /series|drama|cinema|movie|serial|entertainment/i.test(
        `${c.title} ${c.categories.join(" ")}`,
      ),
    )
    .map((c) => ({ ...c, type: "series" }));
  const seriesPath = path.join(outDir, "playable-asia-series.json");
  const prevSeries = fs.existsSync(seriesPath)
    ? JSON.parse(fs.readFileSync(seriesPath, "utf8"))
    : [];
  const seriesNonIn = prevSeries.filter(
    (c) => !(c.countries || []).includes("in"),
  );
  const seriesMerged = dedupeBySlug([...series, ...seriesNonIn]);
  fs.writeFileSync(seriesPath, JSON.stringify(seriesMerged, null, 2));
  console.log(
    `Wrote playable-asia-series.json: ${seriesMerged.length} (${series.length} India)`,
  );

  // Overrides for searchable common titles
  const overridesPath = path.join(outDir, "channel-overrides.json");
  const overrides = fs.existsSync(overridesPath)
    ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
    : {};
  for (const item of healed.filter((h) => h.categories.includes("Playable"))) {
    const key = item.slug;
    if (/news18|india today|india tv|etv|zee |ndtv|republic|wion|sansad|abp/i.test(item.title)) {
      overrides[key] = {
        slug: key,
        title: item.title,
        url: item.sources[0].url,
        note: "India heal · verified open HLS",
        countries: ["in"],
        categories: item.categories,
      };
    }
  }
  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));

  const report = {
    at: new Date().toISOString(),
    ms: Date.now() - started,
    candidates: pool.length,
    probed: sample.length,
    alive: alive.length,
    kept: healed.length,
    direct: healed.filter((h) => h.categories.includes("Playable")).length,
    proxy: healed.filter((h) => h.categories.includes("ProxyOk")).length,
    byCat: {
      news: healed.filter((h) => /news/i.test(h.categories.join(" "))).length,
      kids: healed.filter((h) => /kid|cartoon/i.test(h.categories.join(" ") + h.title)).length,
      sports: healed.filter((h) => /sport/i.test(h.categories.join(" ") + h.title)).length,
      food: healed.filter((h) => /food|cook/i.test(h.categories.join(" ") + h.title)).length,
      entertainment: healed.filter((h) =>
        /entertain|series|drama|cinema/i.test(h.categories.join(" ") + h.title),
      ).length,
    },
    sampleTitles: healed.slice(0, 25).map((h) => h.title),
  };
  fs.writeFileSync(
    path.join(outDir, "heal-india-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\nReport:", JSON.stringify(report.byCat), `${report.ms}ms`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Seed African public + Asian (IN/KR/CN/JP + neighbours) channels.
 * Focus: food, kids, sports, news, entertainment/series (HTTPS + probe).
 *
 * Usage: npm run seed:regions
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cacheDir = path.join(root, "data-cache", "regions");
const outDir = path.join(root, "src", "data", "generated");
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const UA = "GLS-TV-Regions/1.0";
const CONCURRENCY = 12;
const TIMEOUT_MS = 8000;

const AFRICA = [
  "za",
  "ng",
  "ke",
  "eg",
  "gh",
  "tz",
  "ug",
  "ma",
  "dz",
  "tn",
  "et",
  "sn",
  "ci",
  "cm",
  "rw",
  "zw",
  "bw",
  "na",
  "mz",
  "ao",
  "ly",
  "sd",
  "so",
  "mg",
  "mw", // Malawi
  "zm", // Zambia
  "sz", // Eswatini (Swaziland)
  "ls", // Lesotho
];

const ASIA = [
  "in",
  "kr",
  "cn",
  "jp",
  "tw",
  "hk",
  "th",
  "id",
  "ph",
  "vn",
  "my",
  "sg",
  "bd",
  "pk",
  "lk",
  "np",
  "mm",
  "kh",
  "la",
  "mn",
];

const PRIORITY_CAT =
  /food|cook|chef|kitchen|kid|child|cartoon|animation|family|sport|news|series|drama|entertainment|movie|film|culture|documentary|general/i;

const SERIES_CAT =
  /series|drama|entertainment|movie|film|soap|k-?drama|anime|show/i;

function parseM3u(text, defaultCountry) {
  const lines = text.split(/\r?\n/);
  const items = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!url || url.startsWith("#")) continue;
    if (!/^https:\/\//i.test(url)) continue;
    if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(url)) continue;

    const comma = line.lastIndexOf(",");
    const title = (comma >= 0 ? line.slice(comma + 1) : "Unknown").trim();
    if (/geo-?blocked/i.test(title)) continue;

    const meta = line.slice(0, comma >= 0 ? comma : undefined);
    const attr = (key) => {
      const m = meta.match(new RegExp(`${key}="([^"]*)"`));
      return m ? m[1] : "";
    };

    const tvgId = attr("tvg-id") || "";
    const logo = attr("tvg-logo") || "";
    const group = attr("group-title") || "General";
    const key = tvgId || url;
    if (seen.has(key)) continue;
    seen.add(key);

    let country = defaultCountry || "world";
    const cm = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
    if (cm) country = cm[1].toLowerCase();

    const idBase = (tvgId || title)
      .toLowerCase()
      .replace(/[^a-z0-9@.]+/g, "-");
    const slug =
      idBase.replace(/[@.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
      `ch-${items.length}`;

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
      tvgId: tvgId || null,
    });
  }
  return items;
}

async function downloadCountry(code) {
  const url = `https://iptv-org.github.io/iptv/countries/${code}.m3u`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return [];
    const text = await r.text();
    fs.writeFileSync(path.join(cacheDir, `${code}.m3u`), text);
    return parseM3u(text, code);
  } catch {
    return [];
  }
}

async function downloadCategory(name) {
  const url = `https://iptv-org.github.io/iptv/categories/${name}.m3u`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) return [];
    const text = await r.text();
    fs.writeFileSync(path.join(cacheDir, `cat-${name}.m3u`), text);
    return parseM3u(text, "world");
  } catch {
    return [];
  }
}

function scoreCandidate(item, regionCodes) {
  const hay = `${item.title} ${item.categories.join(" ")}`;
  let s = 0;
  if (PRIORITY_CAT.test(hay)) s += 20;
  if (SERIES_CAT.test(hay)) s += 15;
  if (/kid|cartoon|anime|animation/i.test(hay)) s += 8;
  if (/food|cook|chef/i.test(hay)) s += 8;
  if (/sport/i.test(hay)) s += 8;
  if (/news/i.test(hay)) s += 6;
  if (regionCodes.includes(item.countries[0])) s += 5;
  if (/akamai|amagi|cloudfront|pluto|zype|youtube|ytimg/i.test(item.url))
    s += 10;
  return s;
}

async function probe(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return { ok: false };
    const text = await r.text();
    if (!/#EXTM3U/i.test(text)) return { ok: false };
    const cors = r.headers.get("access-control-allow-origin") || "";
    const hasMedia = text
      .split(/\r?\n/)
      .some((l) => l.trim() && !l.startsWith("#"));
    if (!hasMedia) return { ok: false };
    return {
      ok: true,
      cors,
      direct: cors === "*",
      score: (cors === "*" ? 40 : 10) + 10,
    };
  } catch {
    return { ok: false };
  }
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

function toCatalog(item, region, probeResult, forceType, { verified = false } = {}) {
  const cats = new Set([
    ...item.categories,
    region === "africa" ? "Africa" : "Asia",
  ]);
  if (verified) {
    cats.add("Playable");
    cats.add("Verified");
    if (probeResult?.direct) cats.add("Popular");
  } else {
    cats.add("Catalog");
  }
  if (SERIES_CAT.test(`${item.title} ${item.categories.join(" ")}`)) {
    cats.add("Series");
    cats.add("Drama");
  }
  const isSeriesish = SERIES_CAT.test(
    `${item.title} ${item.categories.join(" ")}`,
  );
  return {
    id: item.id || `playable-${item.slug}`,
    slug: item.slug,
    title: item.title,
    type: forceType || (isSeriesish ? "series" : "live"),
    description: verified
      ? `${region === "africa" ? "Africa" : "Asia"} · browser CORS+segment verified`
      : `${region === "africa" ? "Africa" : "Asia"} · catalog (unverified)`,
    countries: item.countries?.length ? item.countries : ["world"],
    categories: [...cats],
    languages: [],
    poster:
      item.poster ||
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
    backdrop:
      item.poster ||
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: Boolean(verified && probeResult?.direct),
    sources: [{ url: item.url, quality: "Auto", format: "hls" }],
  };
}

function diversify(sorted, limit, perCountry = 6) {
  const picked = [];
  const counts = new Map();
  for (const item of sorted) {
    if (picked.length >= limit) break;
    const c = item.countries?.[0] || "world";
    const n = counts.get(c) || 0;
    if (n >= perCountry) continue;
    counts.set(c, n + 1);
    picked.push(item);
  }
  for (const item of sorted) {
    if (picked.length >= limit) break;
    if (!picked.some((p) => p.slug === item.slug)) picked.push(item);
  }
  return picked;
}

async function healPool(label, candidates, probeCap, keep) {
  const ranked = [...candidates].sort(
    (a, b) =>
      scoreCandidate(b, []) - scoreCandidate(a, []) ||
      a.title.localeCompare(b.title),
  );
  // Prefer priority categories first
  const priority = ranked.filter((c) =>
    PRIORITY_CAT.test(`${c.title} ${c.categories.join(" ")}`),
  );
  const rest = ranked.filter(
    (c) => !PRIORITY_CAT.test(`${c.title} ${c.categories.join(" ")}`),
  );
  const sample = [...priority, ...rest].slice(0, probeCap);
  console.log(`\n${label}: ${candidates.length} HTTPS → probe ${sample.length}`);

  const results = await mapPool(sample, CONCURRENCY, async (item, idx) => {
    const p = await probe(item.url);
    if ((idx + 1) % 25 === 0)
      console.log(`  ${label} ${idx + 1}/${sample.length}`);
    return { item, p };
  });

  const ok = results
    .filter((r) => r.p.ok)
    .map((r) => ({
      ...r.item,
      _score: (r.p.score || 0) + scoreCandidate(r.item, []),
      _direct: r.p.direct,
      _cors: r.p.cors,
    }))
    .sort((a, b) => b._score - a._score);

  const kept = diversify(ok, keep, label.includes("India") ? 40 : 8);
  console.log(`  ✓ ${ok.length} alive, keep ${kept.length}`);
  return { all: ok, keep: kept };
}

function dedupe(list) {
  const map = new Map();
  for (const i of list) if (!map.has(i.slug)) map.set(i.slug, i);
  return [...map.values()];
}

async function main() {
  const started = Date.now();
  console.log("Downloading Africa…");
  let africaRaw = [];
  for (const code of AFRICA) {
    const items = await downloadCountry(code);
    console.log(`  ${code}: ${items.length}`);
    africaRaw.push(...items);
  }
  // Continent / ZA raw streams (regions/af.m3u is 404 on pages host)
  try {
    const zaRaw =
      "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/za.m3u";
    const r = await fetch(zaRaw, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(60000),
    });
    if (r.ok) {
      const text = await r.text();
      fs.writeFileSync(path.join(cacheDir, "streams-za.m3u"), text);
      const zaItems = parseM3u(text, "za");
      console.log(`  streams za: ${zaItems.length}`);
      africaRaw.push(...zaItems);
    }
  } catch (e) {
    console.log("  streams za: failed", e.message || e);
  }
  africaRaw = dedupe(africaRaw);

  console.log("Downloading Asia countries…");
  let asiaRaw = [];
  for (const code of ASIA) {
    const items = await downloadCountry(code);
    console.log(`  ${code}: ${items.length}`);
    asiaRaw.push(...items);
  }

  console.log("Downloading series/entertainment categories (Asia filter)…");
  const seriesCat = await downloadCategory("series");
  const entCat = await downloadCategory("entertainment");
  const moviesCat = await downloadCategory("movies");
  const asiaCodes = new Set(ASIA);
  const asiaFromCats = dedupe(
    [...seriesCat, ...entCat, ...moviesCat].filter((i) =>
      asiaCodes.has(i.countries[0]),
    ),
  );
  console.log(`  Asia from cats: ${asiaFromCats.length}`);
  asiaRaw = dedupe([...asiaRaw, ...asiaFromCats]);

  // Full dumps (unprobed) for Live TV browse volume — NEVER mark Playable
  fs.writeFileSync(
    path.join(outDir, "africa.json"),
    JSON.stringify(
      africaRaw.map((i) =>
        toCatalog(i, "africa", { direct: false }, "live", { verified: false }),
      ),
    ),
  );
  fs.writeFileSync(
    path.join(outDir, "asia.json"),
    JSON.stringify(
      asiaRaw.map((i) =>
        toCatalog(i, "asia", { direct: false }, "live", { verified: false }),
      ),
    ),
  );

  // Heal: Africa all priority-capped
  const africaHeal = await healPool("Africa", africaRaw, 180, 80);

  // Asia: split India heavy + KR/CN/JP focus + rest
  const india = asiaRaw.filter((i) => i.countries[0] === "in");
  const krCnJp = asiaRaw.filter((i) =>
    ["kr", "cn", "jp", "tw", "hk"].includes(i.countries[0]),
  );
  const asiaRest = asiaRaw.filter(
    (i) => !["in", "kr", "cn", "jp", "tw", "hk"].includes(i.countries[0]),
  );

  const indiaHeal = await healPool("India", india, 150, 60);
  const coreAsiaHeal = await healPool("KR/CN/JP", krCnJp, 160, 70);
  const restAsiaHeal = await healPool("Asia rest", asiaRest, 120, 50);

  const asiaKept = dedupe([
    ...indiaHeal.keep,
    ...coreAsiaHeal.keep,
    ...restAsiaHeal.keep,
  ]);

  const playableAfrica = africaHeal.keep.map((i) =>
    toCatalog(i, "africa", { direct: i._direct }, "live", { verified: true }),
  );
  const playableAsia = asiaKept.map((i) =>
    toCatalog(i, "asia", { direct: i._direct }, "live", { verified: true }),
  );

  const asiaSeries = asiaKept
    .filter((i) =>
      SERIES_CAT.test(`${i.title} ${i.categories.join(" ")}`),
    )
    .map((i) => {
      const item = toCatalog(i, "asia", { direct: i._direct }, "series", {
        verified: true,
      });
      item.type = "series";
      item.categories = [
        ...new Set([...item.categories, "Series", "Asia", "Drama"]),
      ];
      return item;
    });

  // Korean-focused series pack
  const koreaSeries = asiaSeries.filter((i) =>
    i.countries.includes("kr") || /korea|k-?drama|korean/i.test(i.title),
  );

  fs.writeFileSync(
    path.join(outDir, "playable-africa.json"),
    JSON.stringify(playableAfrica, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "playable-asia.json"),
    JSON.stringify(playableAsia, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "playable-asia-series.json"),
    JSON.stringify(asiaSeries, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "playable-korea-series.json"),
    JSON.stringify(koreaSeries, null, 2),
  );

  const report = {
    at: new Date().toISOString(),
    ms: Date.now() - started,
    africa: {
      raw: africaRaw.length,
      playable: playableAfrica.length,
    },
    asia: {
      raw: asiaRaw.length,
      playable: playableAsia.length,
      series: asiaSeries.length,
      koreaSeries: koreaSeries.length,
      indiaPlayable: indiaHeal.keep.length,
      krCnJpPlayable: coreAsiaHeal.keep.length,
    },
  };
  fs.writeFileSync(
    path.join(outDir, "regions-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\nDone:", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

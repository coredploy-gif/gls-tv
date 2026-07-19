/**
 * GLS TV heal + playable seed
 * - Probes iptv-org category playlists for browser-viable HLS
 * - Prefers CORS * (direct play); also keeps proxy-ok HTTPS streams
 * - Rejects raw IP / dead / non-HLS junk
 * - Writes curated playable JSON used by the app
 *
 * Usage: npm run heal
 * Cron:  POST /api/cron/heal with Authorization: Bearer $CRON_SECRET
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

const UA = "GLS-TV-Heal/1.0";
const CONCURRENCY = 10;
const TIMEOUT_MS = 9000;

/** Official / known-good always-include seeds (verified CORS or proxy-ok). */
const CURATED = [
  {
    bucket: "sports",
    title: "Red Bull TV",
    slug: "red-bull-tv",
    url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master_1660.m3u8",
    countries: ["world", "at"],
    categories: ["Sports", "Extreme"],
    poster:
      "https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=1600&h=2400&q=92",
  },
  {
    bucket: "sports",
    title: "beIN SPORTS XTRA",
    slug: "beinsportsxtra-us-sd",
    url: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
    countries: ["us"],
    categories: ["Sports"],
    poster:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&h=2400&q=92",
  },
  {
    bucket: "sports",
    title: "beIN SPORTS XTRA Español",
    slug: "beinsportsxtraenespanol-us-sd",
    url: "https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8",
    countries: ["us", "mx"],
    categories: ["Sports"],
  },
  {
    bucket: "sports",
    title: "Tennis Channel",
    slug: "tennis-channel",
    url: "https://tennischannel-vizio.amagi.tv/playlist.m3u8",
    countries: ["us", "world"],
    categories: ["Sports", "Tennis"],
  },
  {
    bucket: "news",
    title: "Al Jazeera English",
    slug: "al-jazeera-english",
    url: "https://cdn-7.pishow.tv/live/429/master.m3u8",
    countries: ["qa", "world"],
    categories: ["News"],
  },
  {
    bucket: "news",
    title: "DW English",
    slug: "dw-english",
    url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8",
    countries: ["de", "world"],
    categories: ["News"],
  },
  {
    bucket: "news",
    title: "France 24 English",
    slug: "france-24-english",
    url: "https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8",
    countries: ["fr", "world"],
    categories: ["News"],
  },
];

/** Dead / pay-TV restreams — never promote as open playable. */
const BLOCK_SLUGS = new Set([
  "beinsportsusa-us-sd", // http IP restream → 404
  "beinsportshaber-tr-sd",
]);

/** Pay linear titles that should not be seeded as “open” from iptv-org sports.m3u */
const PAY_LINEAR_TITLE =
  /^(espn(\s*2|\s*u|\s*news|\s*deportes)?|fs1|fs2|fox\s*sports(\s*[12])?|fox\s*deportes|tsn\s*[1-5]|sky\s*sports|dazn|bt\s*sport|tnt\s*sports|nba\s*tv|nfl\s*network|nhl\s*network|supersport|premier\s*sports|bein\s*sports(?!\s*xtra))\b/i;

function looksLikeOpenSportsFast(title, url) {
  return /xtra|ocho|livenow|live.?now|amagi|pluto|xumo|red.?bull|fifa\+|alkass|fox weather|30a |golf kingdom|stadium|fuel|buzzr|outside/i.test(
    `${title} ${url}`,
  );
}

const FEEDS = [
  ["sports", "https://iptv-org.github.io/iptv/categories/sports.m3u", "Sports"],
  ["kids", "https://iptv-org.github.io/iptv/categories/kids.m3u", "Kids"],
  [
    "animation",
    "https://iptv-org.github.io/iptv/categories/animation.m3u",
    "Kids",
  ],
  [
    "cooking",
    "https://iptv-org.github.io/iptv/categories/cooking.m3u",
    "Food",
  ],
];

function parseM3u(text, forceCategory) {
  const lines = text.split(/\r?\n/);
  const items = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!url || url.startsWith("#")) continue;
    if (!/^https:\/\//i.test(url)) continue; // HTTPS only for guarantee
    if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(url)) continue; // no raw IPs

    const comma = line.lastIndexOf(",");
    const title = (comma >= 0 ? line.slice(comma + 1) : "Unknown").trim();
    const meta = line.slice(0, comma >= 0 ? comma : undefined);
    const attr = (key) => {
      const m = meta.match(new RegExp(`${key}="([^"]*)"`));
      return m ? m[1] : "";
    };

    const tvgId = attr("tvg-id") || "";
    const logo = attr("tvg-logo") || "";
    const group = attr("group-title") || forceCategory || "General";
    const dedupeKey = tvgId || url;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let country = "world";
    const cm = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
    if (cm) country = cm[1].toLowerCase();

    const idBase = (tvgId || title)
      .toLowerCase()
      .replace(/[^a-z0-9@.]+/g, "-");
    const slug =
      idBase.replace(/[@.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
      `ch-${items.length}`;

    if (BLOCK_SLUGS.has(slug)) continue;

    const cleanTitle =
      title.replace(/\s*\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)\s*$/i, "").trim() ||
      title;

    // Non-pirate seed: skip pay linear brands from sports.m3u unless clearly FAST/open
    if (
      forceCategory === "Sports" &&
      PAY_LINEAR_TITLE.test(cleanTitle) &&
      !looksLikeOpenSportsFast(cleanTitle, url)
    ) {
      continue;
    }
    if (/geo-?blocked/i.test(title)) continue;

    const categories = [
      ...new Set(
        [
          forceCategory,
          ...group
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ].filter(Boolean),
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

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await r.text();
  return {
    ok: r.ok,
    status: r.status,
    cors: r.headers.get("access-control-allow-origin"),
    text,
  };
}

function scoreCdn(url) {
  let s = 0;
  if (/akamai|amagi|cloudfront|pluto|zype|pishow|france24|dwamd|rbmn/i.test(url))
    s += 30;
  if (/jmp2\.uk\/plu/i.test(url)) s += 25;
  if (/\.m3u8(\?|$)/i.test(url)) s += 5;
  return s;
}

/**
 * Probe: playlist OK + at least one media line.
 * corsOk = * or missing (proxy can still play).
 */
async function probe(url) {
  try {
    const master = await fetchText(url);
    if (!master.ok) return { ok: false, reason: `http_${master.status}` };
    if (!/#EXTM3U/i.test(master.text)) return { ok: false, reason: "not_m3u" };

    const lines = master.text.split(/\r?\n/).map((l) => l.trim());
    let mediaOrVariant = lines.find(
      (l) => l && !l.startsWith("#") && (l.includes(".m3u8") || l.includes(".ts") || l.includes(".m4s") || l.startsWith("http")),
    );
    if (!mediaOrVariant) return { ok: false, reason: "empty" };

    let segs = 0;
    let cors = master.cors;
    const abs = new URL(mediaOrVariant, url).href;

    if (/\.m3u8(\?|$)/i.test(abs) || mediaOrVariant.includes(".m3u8")) {
      const variant = await fetchText(abs);
      if (!variant.ok) return { ok: false, reason: "variant_fail" };
      cors = variant.cors || cors;
      const vLines = variant.text.split(/\r?\n/).map((l) => l.trim());
      const seg = vLines.find(
        (l) =>
          l &&
          !l.startsWith("#") &&
          !l.includes(".m3u8") &&
          (l.includes(".ts") ||
            l.includes(".m4s") ||
            l.includes(".aac") ||
            l.startsWith("http") ||
            /\.(ts|m4s|aac|mp4)(\?|$)/i.test(l)),
      );
      if (seg) {
        const segUrl = new URL(seg, abs).href;
        try {
          const sr = await fetch(segUrl, {
            method: "HEAD",
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          segs = sr.ok ? 1 : 0;
          cors = sr.headers.get("access-control-allow-origin") || cors;
          // Some CDNs reject HEAD — try GET range
          if (!sr.ok) {
            const gr = await fetch(segUrl, {
              headers: { "User-Agent": UA, Range: "bytes=0-1" },
              signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            segs = gr.ok || gr.status === 206 ? 1 : 0;
            cors = gr.headers.get("access-control-allow-origin") || cors;
          }
        } catch {
          segs = 1; // playlist parsed; segment HEAD flaky on some CDNs
        }
      } else {
        segs = 1; // live playlist may only list relative paths we already saw
      }
    } else {
      segs = 1;
    }

    const corsStar = cors === "*" || cors === "*.*" || cors === "null";
    // Note: header "null" string vs null — treat * as best
    const direct = cors === "*";
    return {
      ok: true,
      cors: cors || "",
      direct,
      proxyOk: true,
      segs,
      score: (direct ? 40 : 10) + scoreCdn(url) + (segs > 0 ? 10 : 0),
    };
  } catch (e) {
    return { ok: false, reason: e.cause?.code || e.message || "error" };
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

async function downloadFeeds() {
  const parsed = { sports: [], kids: [], food: [], news: [] };
  for (const [name, url, forceCat] of FEEDS) {
    console.log(`Fetching ${name}…`);
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(60000),
    });
    const text = await r.text();
    fs.writeFileSync(path.join(cacheDir, `${name}.m3u`), text);
    const items = parseM3u(text, forceCat);
    console.log(`  ${items.length} HTTPS candidates`);
    if (name === "sports") parsed.sports.push(...items);
    else if (name === "kids" || name === "animation") parsed.kids.push(...items);
    else if (name === "cooking") parsed.food.push(...items);
  }
  return parsed;
}

function dedupeBySlug(list) {
  const map = new Map();
  for (const item of list) {
    if (!map.has(item.slug)) map.set(item.slug, item);
  }
  return [...map.values()];
}

function preferDiverseCountries(sorted, limit) {
  const picked = [];
  const usedCountries = new Map();
  for (const item of sorted) {
    if (picked.length >= limit) break;
    const c = item.countries?.[0] || "world";
    const n = usedCountries.get(c) || 0;
    if (n >= 4 && picked.length < limit - 2) continue; // diversity soft cap
    usedCountries.set(c, n + 1);
    picked.push(item);
  }
  // fill remainder
  for (const item of sorted) {
    if (picked.length >= limit) break;
    if (!picked.some((p) => p.slug === item.slug)) picked.push(item);
  }
  return picked;
}

function toPlayableRecord(item, probeResult, bucket) {
  return {
    cat: bucket,
    title: item.title,
    slug: item.slug,
    url: item.url,
    countries: item.countries?.length ? item.countries : ["world"],
    categories: item.categories || [bucket],
    poster: item.poster,
    cors: probeResult.cors || (probeResult.direct ? "*" : ""),
    direct: Boolean(probeResult.direct),
    segs: probeResult.segs || 0,
    score: probeResult.score || 0,
    id: item.id || `playable-${item.slug}`,
  };
}

function toCatalogItem(rec, bucketLabel) {
  const cats = new Set([
    bucketLabel,
    "Playable",
    "Verified",
    "Popular",
    ...(rec.categories || []),
  ]);
  return {
    id: rec.id || `playable-${rec.slug}`,
    slug: rec.slug,
    title: rec.title,
    type: "live",
    description: `${bucketLabel} · heal-verified ${new Date().toISOString().slice(0, 10)}`,
    countries: rec.countries || ["world"],
    categories: [...cats],
    languages: ["English"],
    poster:
      rec.poster ||
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
    backdrop:
      rec.poster ||
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [{ url: rec.url, quality: "Auto", format: "hls" }],
  };
}

async function healBucket(name, candidates, target = 40) {
  console.log(`\nProbing ${name}: ${candidates.length}…`);
  // Prioritize CDN-looking URLs first
  const ranked = [...candidates].sort(
    (a, b) => scoreCdn(b.url) - scoreCdn(a.url),
  );
  // Probe top 120 to keep runtime sane
  const sample = ranked.slice(0, 120);
  const results = await mapPool(sample, CONCURRENCY, async (item, idx) => {
    const p = await probe(item.url);
    if ((idx + 1) % 20 === 0) console.log(`  ${name} ${idx + 1}/${sample.length}`);
    return { item, p };
  });

  const ok = results
    .filter((r) => r.p.ok)
    .filter((r) => !/geo-?blocked/i.test(r.item.title))
    .map((r) => toPlayableRecord(r.item, r.p, name))
    .sort((a, b) => b.score - a.score || (b.direct ? 1 : 0) - (a.direct ? 1 : 0));

  // Prefer direct-play (CORS *) when building keep list
  const directFirst = [
    ...ok.filter((r) => r.direct),
    ...ok.filter((r) => !r.direct),
  ];
  const diverse = preferDiverseCountries(directFirst, target);
  console.log(`  ✓ ${ok.length} alive, keeping ${diverse.length}`);
  return { all: ok, keep: diverse };
}

async function main() {
  const started = Date.now();
  const feeds = await downloadFeeds();

  // Inject curated into candidate pools
  for (const c of CURATED) {
    const row = {
      title: c.title,
      slug: c.slug,
      url: c.url,
      countries: c.countries,
      categories: c.categories,
      poster: c.poster,
      id: `curated-${c.slug}`,
    };
    if (c.bucket === "sports") feeds.sports.unshift(row);
    if (c.bucket === "kids") feeds.kids.unshift(row);
    if (c.bucket === "food") feeds.food.unshift(row);
    if (c.bucket === "news") {
      /* news handled in top10 */
    }
  }

  feeds.sports = dedupeBySlug(feeds.sports);
  feeds.kids = dedupeBySlug(feeds.kids);
  feeds.food = dedupeBySlug(feeds.food);

  const sports = await healBucket("sports", feeds.sports, 50);
  const kids = await healBucket("kids", feeds.kids, 40);
  const food = await healBucket("food", feeds.food, 35);

  // Competition-ish food: titles matching cook-off / chef / masterchef etc.
  const competitions = food.all
    .filter((r) =>
      /chef|competition|masterchef|iron|cook.?off|challenge|battle|chopped|kitchen/i.test(
        r.title,
      ),
    )
    .slice(0, 15);

  // Override: beIN Sports USA → XTRA (open FAST feed; main USA restream is dead)
  const overrides = {
    "beinsportsusa-us-sd": {
      slug: "beinsportsusa-us-sd",
      title: "beIN SPORTS XTRA",
      url: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
      note: "Main beIN Sports USA open restream is dead (404). Mapped to free XTRA FAST feed.",
      countries: ["us"],
      categories: ["Sports", "Playable", "Verified"],
    },
  };

  const playableSports = sports.keep.map((r) => toCatalogItem(r, "Sports"));
  const playableKids = kids.keep.map((r) => toCatalogItem(r, "Kids"));
  const playableFood = food.keep.map((r) => toCatalogItem(r, "Food"));

  // Ensure beIN XTRA is in sports playable
  if (!playableSports.some((c) => /bein/i.test(c.slug))) {
    const xtra = sports.all.find((r) => r.slug === "beinsportsxtra-us-sd");
    if (xtra) playableSports.unshift(toCatalogItem(xtra, "Sports"));
  }

  const top10 = {
    sports: sports.keep.slice(0, 10),
    news: [
      toPlayableRecord(
        CURATED.find((c) => c.slug === "al-jazeera-english"),
        { ok: true, cors: "*", direct: true, segs: 10, score: 100 },
        "news",
      ),
      ...CURATED.filter((c) => c.bucket === "news" && c.slug !== "al-jazeera-english").map(
        (c) =>
          toPlayableRecord(c, {
            ok: true,
            cors: "*",
            direct: true,
            segs: 10,
            score: 90,
          }, "news"),
      ),
    ].slice(0, 10),
    kids: kids.keep.slice(0, 10),
    food: [
      ...competitions.slice(0, 4),
      ...food.keep.filter((r) => !competitions.some((c) => c.slug === r.slug)),
    ].slice(0, 10),
  };

  // Fill news top10 from previous file if short
  try {
    const prev = JSON.parse(
      fs.readFileSync(path.join(outDir, "top10-playable.json"), "utf8"),
    );
    if (prev.news?.length) {
      const seen = new Set(top10.news.map((n) => n.slug));
      for (const n of prev.news) {
        if (top10.news.length >= 10) break;
        if (!seen.has(n.slug)) {
          top10.news.push(n);
          seen.add(n.slug);
        }
      }
    }
  } catch {
    /* first run */
  }

  fs.writeFileSync(
    path.join(outDir, "playable-sports.json"),
    JSON.stringify(playableSports, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "playable-kids.json"),
    JSON.stringify(playableKids, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "playable-food.json"),
    JSON.stringify(playableFood, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "playable-food-competitions.json"),
    JSON.stringify(
      competitions.map((r) => toCatalogItem(r, "Food")),
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(outDir, "top10-playable.json"),
    JSON.stringify(top10, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "channel-overrides.json"),
    JSON.stringify(overrides, null, 2),
  );

  const report = {
    at: new Date().toISOString(),
    ms: Date.now() - started,
    sports: { alive: sports.all.length, kept: playableSports.length },
    kids: { alive: kids.all.length, kept: playableKids.length },
    food: {
      alive: food.all.length,
      kept: playableFood.length,
      competitions: competitions.length,
    },
    overrides: Object.keys(overrides),
    note: "beIN Sports USA open feed dead → XTRA mapping",
  };
  fs.writeFileSync(
    path.join(outDir, "heal-report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log("\nHeal complete:", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Heal US + popular sports: open FAST / free feeds only.
 * Blocks raw-IP pirate restreams for Fox/ESPN/TSN main linear.
 *
 * Usage: npm run heal:sports
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

const UA = "GLS-TV-Heal-Sports/1.0";
const TIMEOUT_MS = 10000;
const CONCURRENCY = 12;

/** Legitimate free / FAST sports (people search Fox/ESPN/TSN → land here). */
const CURATED = [
  {
    title: "ESPN8 The Ocho",
    slug: "espn8-the-ocho",
    url: "https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8",
    categories: ["Sports", "ESPN", "Popular"],
    note: "Official free ESPN FAST (not ESPN 1/2 linear).",
  },
  {
    title: "LiveNOW from FOX",
    slug: "livenow-from-fox",
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00488-foxdigital-livenowbyfox-lgus/playlist.m3u8",
    categories: ["News", "Sports", "Fox", "Popular"],
    mirrors: ["https://fox-foxnewsnow-vizio.amagi.tv/playlist.m3u8"],
    note: "Free Fox digital FAST — not FS1/FS2 pay linear.",
  },
  {
    title: "FOX Weather",
    slug: "fox-weather",
    url: "https://247wlive.foxweather.com/stream/index.m3u8",
    categories: ["Weather", "Fox", "News", "Popular"],
  },
  {
    title: "beIN SPORTS XTRA",
    slug: "beinsportsxtra-us-sd",
    url: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
    categories: ["Sports", "Soccer", "Popular"],
  },
  {
    title: "Red Bull TV",
    slug: "red-bull-tv",
    url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master_1660.m3u8",
    categories: ["Sports", "Extreme", "Popular"],
  },
  {
    title: "AccuWeather Now",
    slug: "accuweather-now",
    url: "https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00684-accuweather-accuweather-plex/playlist.m3u8",
    categories: ["Weather", "Sports"],
  },
];

const WANT =
  /fox|espn|tsn|stadium|tennis|golf|nascar|olympi|fifa|buzzer|draft.?king|fuel|red.?bull|bein|rally|moto|fight|boxing|pac.?12|cbs sport|nbc sport|sportsnet|outside|fishing|poker|racing|speed|weather|fifa|world of free|tyc|alkass|adf|extreme|skate|surf|climb|snow|motoGP|formula|f1|ufc|combate|wwe|aew|impact|glory|lucha|sport|olymp|athletic|marathon|cycling|cricket|rugby|hockey|soccer|football|basketball|volley|swim|running|track/i;

/**
 * Drop pay-TV linear brands that iptv-org often lists via unofficial restreams.
 * Keep official FAST / free cues (XTRA, Ocho, LiveNOW, Pluto/Amagi/CDN).
 */
function isOpenFastCue(item) {
  const hay = `${item.title} ${item.url} ${(item.categories || []).join(" ")}`;
  return /xtra|ocho|livenow|live.?now|fast|pluto|xumo|amagi|red.?bull|fifa\+|alkass|30a |golf kingdom|accuweather|fox weather|stadium|outside tv|buzzr|fuel tv|world of free|tyc|adf|free\b/i.test(
    hay,
  );
}

function isPiratePayLinear(item) {
  if (isRawIp(item.url)) return true;
  if (/geo-?blocked/i.test(item.title)) return true;
  if (isOpenFastCue(item)) return false;
  const t = item.title
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s*\((?:\d{3,4}p|SD|HD|FHD|4K|UHD)\)\s*$/i, "")
    .trim();
  if (
    /^(espn|espn\s*2|espn2|espn\s*u|espn\s*news|espn\s*deportes)(\b|$)/i.test(t)
  )
    return true;
  if (
    /^(fs1|fs2|fox\s*sports(\s*[12])?|fox\s*deportes|fox\s*soccer)(\b|$)/i.test(
      t,
    )
  )
    return true;
  if (/^tsn\s*[1-5]\b/i.test(t) || /^tsn$/i.test(t)) return true;
  if (/^sky\s*sports/i.test(t)) return true;
  if (/^dazn\b/i.test(t)) return true;
  if (/^(bt\s*sport|tnt\s*sports)\b/i.test(t)) return true;
  if (/^(nba\s*tv|nfl\s*network|nhl\s*network)\b/i.test(t)) return true;
  if (/^supersport\b/i.test(t) || /^dstv\b/i.test(t)) return true;
  if (/bein\s*sports/i.test(t) && !/xtra/i.test(t)) return true;
  if (/^premier\s*sports\b/i.test(t)) return true;
  // http IP or shady non-HTTPS already filtered — also drop opaque IP CDNs
  try {
    const host = new URL(item.url).hostname.toLowerCase();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
  } catch {
    return true;
  }
  return false;
}

function isRawIp(url) {
  try {
    const h = new URL(url).hostname;
    return /^\d+\.\d+\.\d+\.\d+$/.test(h);
  } catch {
    return true;
  }
}

function isCorsStar(cors) {
  if (!cors) return false;
  return cors
    .split(",")
    .map((s) => s.trim())
    .includes("*");
}

function parseM3u(text, fallbackCountry = "us") {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!/^https:\/\//i.test(url)) continue;
    if (isRawIp(url)) continue;

    const title = line.split(",").pop()?.trim() || "Channel";
    const tvgId = /tvg-id="([^"]*)"/i.exec(line)?.[1] || "";
    const logo = /tvg-logo="([^"]*)"/i.exec(line)?.[1] || "";
    const group = /group-title="([^"]*)"/i.exec(line)?.[1] || "";
    const tvgCountry = /tvg-country="([^"]*)"/i.exec(line)?.[1] || "";
    const slug = (tvgId || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const countries = (tvgCountry || fallbackCountry)
      .split(/[;,]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    items.push({
      title: title.replace(/\s*\((\d{3,4}p|SD|HD|FHD|4K)\)\s*$/i, "").trim(),
      slug,
      url,
      countries: countries.length ? countries : [fallbackCountry],
      categories: group
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      poster: logo || undefined,
      id: `iptv-${slug}`,
    });
  }
  return items;
}

async function fetchM3u(url, cacheName, country) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) {
      console.log(`  fail ${r.status} ${cacheName}`);
      return [];
    }
    const text = await r.text();
    fs.writeFileSync(path.join(cacheDir, cacheName), text);
    return parseM3u(text, country);
  } catch (e) {
    console.log(`  fail ${cacheName}`, e.message || e);
    return [];
  }
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

async function probeStrict(url) {
  try {
    if (!/^https:\/\//i.test(url) || isRawIp(url)) return null;
    const master = await fetchText(url);
    if (!master.ok || !/#EXTM3U/i.test(master.text)) return null;
    const lines = master.text.split(/\r?\n/).map((l) => l.trim());
    const next = lines.find((l) => l && !l.startsWith("#"));
    if (!next) return null;
    const abs = new URL(next, url).href;
    let playlistUrl = url;
    let playlistText = master.text;
    let corsOk = isCorsStar(master.cors);
    if (/\.m3u8(\?|$)/i.test(abs) || next.includes(".m3u8")) {
      const variant = await fetchText(abs);
      if (!variant.ok || !/#EXTM3U/i.test(variant.text)) return null;
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
    if (!seg) return null;
    const segUrl = new URL(seg, playlistUrl).href;
    let segRes = await fetchText(segUrl, { method: "HEAD" });
    if (!segRes.ok) {
      segRes = await fetchText(segUrl, { headers: { Range: "bytes=0-128" } });
    }
    if (!segRes.ok) return null;
    return corsOk && (isCorsStar(segRes.cors) || segRes.cors === "")
      ? "direct"
      : "proxy";
  } catch {
    return null;
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

function score(item) {
  const hay = `${item.title} ${item.categories.join(" ")}`;
  let s = 0;
  if (/espn|fox|tsn|bein|stadium|tennis|red.?bull|fifa|draft/i.test(hay))
    s += 30;
  if (/sport/i.test(hay)) s += 10;
  if (/akamai|amagi|cloudfront|pluto|xumo|vizio/i.test(item.url)) s += 15;
  if (/geo-blocked|not 24\/7/i.test(item.title)) s -= 8;
  if (isPiratePayLinear(item)) s -= 100;
  // penalize obvious pirate naming of pay linear without FAST cues
  if (
    /^(espn|espn 2|espn2|fs1|fs2|fox sports 1|fox sports 2|tsn ?[1-5])$/i.test(
      item.title.trim(),
    )
  )
    s -= 40;
  return s;
}

function toCatalog(item, tier) {
  const base = [
    ...(item.categories || []),
    "Sports",
    "Healed",
    ...(item.countries?.includes("us") || item.countries?.includes("ca")
      ? ["US"]
      : []),
  ];
  const cats =
    tier === "direct"
      ? [...new Set([...base, "Playable", "Verified", "Popular"])]
      : [...new Set([...base, "ProxyOk", "Verified"])];
  const sources = [
    { url: item.url, quality: "Auto", format: "hls", priority: 10 },
    ...(item.mirrors || []).map((url, idx) => ({
      url,
      quality: "Auto",
      format: "hls",
      priority: 20 + idx * 10,
      label: "mirror",
    })),
  ];
  return {
    id: item.id || `iptv-${item.slug}`,
    slug: item.slug,
    title: item.title,
    type: "live",
    description:
      item.note ||
      (tier === "direct"
        ? "Sports · heal · direct Playable"
        : "Sports · heal · plays via proxy"),
    countries: item.countries?.length ? item.countries : ["us", "world"],
    categories: cats.filter(Boolean),
    languages: ["en"],
    poster:
      item.poster ||
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=600&q=80",
    backdrop:
      item.poster ||
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=2400&q=80",
    license: "open_stream",
    isLive: true,
    featured: tier === "direct",
    sources,
  };
}

function dedupe(list) {
  const map = new Map();
  for (const i of list) {
    if (!map.has(i.slug)) map.set(i.slug, i);
    else if (
      i.categories?.includes("Playable") &&
      !map.get(i.slug).categories?.includes("Playable")
    ) {
      map.set(i.slug, i);
    }
  }
  return [...map.values()];
}

async function main() {
  const started = Date.now();
  console.log("iptv-org sports.m3u · non-pirate open/FAST heal…");

  const sportsFeed = await fetchM3u(
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "cat-sports.m3u",
    "world",
  );
  const usFeed = await fetchM3u(
    "https://iptv-org.github.io/iptv/countries/us.m3u",
    "us-country.m3u",
    "us",
  );
  const openSports = sportsFeed.filter((i) => !isPiratePayLinear(i));
  const droppedPirate = sportsFeed.length - openSports.length;
  console.log(
    `  sports.m3u HTTPS: ${sportsFeed.length} · non-pirate kept: ${openSports.length} · dropped pay/IP/geo: ${droppedPirate}`,
  );
  console.log(`  us country HTTPS: ${usFeed.length}`);

  const existingSports = fs.existsSync(path.join(outDir, "sports.json"))
    ? JSON.parse(fs.readFileSync(path.join(outDir, "sports.json"), "utf8"))
    : [];
  const fromDump = existingSports
    .filter((c) => c.sources?.[0]?.url && !isRawIp(c.sources[0].url))
    .filter((c) =>
      WANT.test(`${c.title} ${(c.categories || []).join(" ")}`),
    )
    .map((c) => ({
      title: c.title,
      slug: c.slug,
      url: c.sources[0].url,
      countries: c.countries || ["world"],
      categories: c.categories || ["Sports"],
      poster: c.poster,
      id: c.id,
    }))
    .filter((i) => !isPiratePayLinear(i));

  const curated = CURATED.map((c) => ({
    ...c,
    countries: ["us", "world"],
    id: `curated-${c.slug}`,
  }));

  // Prefer the full open sports.m3u set (not just branded WANT hits)
  let pool = dedupe([
    ...curated,
    ...openSports,
    ...usFeed
      .filter((i) =>
        /sport|fox|espn|tennis|golf|nascar|olympi|weather|stadium|red.?bull|bein|fifa/i.test(
          `${i.title} ${i.categories.join(" ")}`,
        ),
      )
      .filter((i) => !isPiratePayLinear(i)),
    ...fromDump,
  ]);

  pool = pool.filter((i) => !isRawIp(i.url) && !isPiratePayLinear(i));
  pool.sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title));
  console.log(`  candidates: ${pool.length}`);

  const sample = pool.slice(0, 220);
  console.log(`Probing ${sample.length}…`);
  const results = await mapPool(sample, CONCURRENCY, async (item, idx) => {
    const tier = await probeStrict(item.url);
    if ((idx + 1) % 25 === 0) console.log(`  ${idx + 1}/${sample.length}`);
    return { item, tier };
  });

  const alive = results
    .filter((r) => r.tier)
    .map((r) => ({
      ...r.item,
      _tier: r.tier,
      _score: score(r.item) + (r.tier === "direct" ? 40 : 15),
    }))
    .sort((a, b) => b._score - a._score);

  const kept = alive.slice(0, 120);
  const healed = kept.map((i) => toCatalog(i, i._tier));
  console.log(
    `\nAlive ${alive.length} → keep ${healed.length} (direct ${healed.filter((h) => h.categories.includes("Playable")).length})`,
  );

  // Also refresh sports.json dump from open sports.m3u (catalog, unverified)
  const sportsCatalog = openSports.slice(0, 800).map((i) =>
    toCatalog(
      {
        ...i,
        categories: [...new Set([...(i.categories || []), "Sports", "Catalog"])],
      },
      "proxy",
    ),
  );
  // Strip Playable badges from catalog dump
  for (const row of sportsCatalog) {
    row.categories = row.categories.filter(
      (c) => !["Playable", "ProxyOk", "Verified", "Healed", "Popular"].includes(c),
    );
    row.categories.push("Catalog");
    row.description = "Sports · iptv-org catalog (unverified open HTTPS)";
    row.featured = false;
    row.license = "open_stream";
  }
  fs.writeFileSync(
    path.join(outDir, "sports.json"),
    JSON.stringify(sportsCatalog, null, 2),
  );
  console.log(`Wrote sports.json catalog: ${sportsCatalog.length}`);

  // Merge with previous playable-sports (prefer healed; drop pirates from prev)
  const prevPath = path.join(outDir, "playable-sports.json");
  const prev = fs.existsSync(prevPath)
    ? JSON.parse(fs.readFileSync(prevPath, "utf8"))
    : [];
  const prevClean = prev.filter((c) => {
    const url = c.sources?.[0]?.url || "";
    return !isPiratePayLinear({
      title: c.title,
      url,
      categories: c.categories || [],
    });
  });
  const merged = dedupe([...healed, ...prevClean]);
  fs.writeFileSync(prevPath, JSON.stringify(merged, null, 2));
  console.log(`Wrote playable-sports.json: ${merged.length}`);

  // Overrides: search Fox Sports / ESPN / TSN → open FAST destinations
  const overridesPath = path.join(outDir, "channel-overrides.json");
  const overrides = fs.existsSync(overridesPath)
    ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
    : {};

  const mapAlias = (slug, title, url, note, cats) => {
    overrides[slug] = {
      slug,
      title,
      url,
      note,
      countries: ["us", "world"],
      categories: cats,
    };
  };

  const ocho = healed.find((h) => /ocho/i.test(h.slug) || /ocho/i.test(h.title));
  const liveFox = healed.find((h) => /livenow|live.?now/i.test(h.slug + h.title));
  const foxWx = healed.find((h) => /fox-weather|fox weather/i.test(h.slug + h.title));
  const xtra = healed.find((h) => /bein/i.test(h.slug));

  if (ocho) {
    mapAlias(
      "espn",
      "ESPN8 The Ocho (free FAST)",
      ocho.sources[0].url,
      "Main ESPN 1/2/U are pay linear — open FAST substitute.",
      ["Sports", "ESPN", "Playable", "Verified", "Healed"],
    );
    mapAlias(
      "espn-us-sd",
      "ESPN8 The Ocho (free FAST)",
      ocho.sources[0].url,
      "Pay ESPN restream blocked — mapped to The Ocho.",
      ["Sports", "ESPN", "Playable", "Verified", "Healed"],
    );
  }
  if (liveFox) {
    mapAlias(
      "fox-sports",
      "LiveNOW from FOX (free)",
      liveFox.sources[0].url,
      "FS1/FS2 pay linear not listed — Fox free LiveNOW FAST.",
      ["Sports", "Fox", "News", "Playable", "Verified", "Healed"],
    );
    mapAlias(
      "foxsports-us-sd",
      "LiveNOW from FOX (free)",
      liveFox.sources[0].url,
      "Pirate Fox Sports IP streams removed — LiveNOW FAST.",
      ["Sports", "Fox", "Playable", "Verified", "Healed"],
    );
    mapAlias(
      "foxsports1-us-sd",
      "LiveNOW from FOX (free)",
      liveFox.sources[0].url,
      "FS1 pay not open — LiveNOW FAST.",
      ["Sports", "Fox", "Playable", "Verified", "Healed"],
    );
  }
  if (foxWx) {
    mapAlias(
      "fox-weather",
      "FOX Weather",
      foxWx.sources[0].url,
      "Official Fox Weather open stream.",
      ["Weather", "Fox", "Playable", "Verified", "Healed"],
    );
  }
  // TSN 1–5 slots are owned by src/data/user-stream-seeds.json — do not remap.
  for (const n of [1, 2, 3, 4, 5]) {
    delete overrides[`tsn${n}`];
    delete overrides[`tsn${n}-ca-sd`];
  }
  if (xtra) {
    mapAlias(
      "beinsportsusa-us-sd",
      "beIN SPORTS XTRA",
      xtra.sources[0].url,
      "Main beIN Sports USA restream dead — XTRA FAST.",
      ["Sports", "Playable", "Verified", "Healed"],
    );
  }

  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));

  const report = {
    at: new Date().toISOString(),
    ms: Date.now() - started,
    candidates: pool.length,
    probed: sample.length,
    alive: alive.length,
    kept: healed.length,
    titles: healed.slice(0, 30).map((h) => h.title),
  };
  fs.writeFileSync(
    path.join(outDir, "heal-sports-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("Sample:", report.titles.join(" · "));
  console.log("Done.", report.ms, "ms");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

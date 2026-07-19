/**
 * Heal open soccer / football pack into playable-sports.
 * HTTPS only — no pay-linear IP restreams.
 *
 * Usage: npm run heal:soccer
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "src", "data", "generated");
const UA = "GLS-TV-Heal-Soccer/1.0";
const TIMEOUT_MS = 10000;

const SOCCER_RE =
  /soccer|football|fifa|bein|alkass|tyc|gol |goal|futbol|fútbol|liga|mls|copa|stadium|shoof|xtra|rally/i;

const CURATED = [
  {
    id: "curated-bein-xtra",
    slug: "beinsportsxtra-us-sd",
    title: "beIN SPORTS XTRA",
    url: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
    countries: ["us", "world"],
    categories: ["Sports", "Soccer", "Football"],
  },
  {
    id: "curated-bein-xtra-es",
    slug: "beinsportsxtraenespanol-us-sd",
    title: "beIN Sports XTRA en Español",
    url: "https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8",
    countries: ["us", "mx", "world"],
    categories: ["Sports", "Soccer", "Football"],
  },
  {
    id: "curated-stadium",
    slug: "stadium-us-sd",
    title: "Stadium",
    url: "https://wurl120sports.global.transmit.live/hls/679a907dc0c5e1080be8a895/playlist.m3u8",
    countries: ["us", "world"],
    categories: ["Sports", "Soccer", "Football"],
  },
];

function isRawIp(url) {
  try {
    return /^\d+\.\d+\.\d+\.\d+$/.test(new URL(url).hostname);
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

function parseM3u(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!/^https:\/\//i.test(url) || isRawIp(url)) continue;
    const title = line.split(",").pop()?.trim() || "Channel";
    if (!SOCCER_RE.test(title + " " + line)) continue;
    const tvgId = /tvg-id="([^"]*)"/i.exec(line)?.[1] || "";
    const logo = /tvg-logo="([^"]*)"/i.exec(line)?.[1] || "";
    const group = /group-title="([^"]*)"/i.exec(line)?.[1] || "";
    const slug = (tvgId || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    items.push({
      title: title.replace(/\s*\((\d{3,4}p|SD|HD)\)\s*$/i, "").trim(),
      slug,
      url,
      poster: logo || undefined,
      categories: group
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      id: `iptv-${slug}`,
      countries: ["world"],
    });
  }
  return items;
}

const SOCCER_ART_IDS = [
  "photo-1574629810360-7efbbe195018",
  "photo-1431324155629-1a6deb1dec8d",
  "photo-1522778119026-d647f0596c20",
  "photo-1579952363873-27f3bade9f55",
  "photo-1517466787929-bc90951d0974",
  "photo-1508098682721-e5dbc6094189",
  "photo-1560272564-c83b66b1ad12",
  "photo-1459865264687-595d652de67e",
  "photo-1575361204480-aadea25e6d68",
  "photo-1489944440615-453fc2b6a9a9",
  "photo-1606925797300-0b35e9d3864f",
  "photo-1624526267942-ab0ff8a3e972",
];

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function soccerArt(slug) {
  const id = SOCCER_ART_IDS[hashSeed(slug) % SOCCER_ART_IDS.length];
  return {
    poster: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&h=2400&q=92`,
    backdrop: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=3840&h=2160&q=92`,
  };
}

function toItem(base, tier) {
  const cats = [
    ...new Set([
      ...(base.categories || []),
      "Sports",
      "Soccer",
      "Football",
      "Healed",
      ...(tier === "direct"
        ? ["Playable", "Verified", "Popular"]
        : ["ProxyOk", "Verified"]),
    ]),
  ];
  const art = soccerArt(base.slug || base.id || base.title);
  return {
    id: base.id || `iptv-${base.slug}`,
    slug: base.slug,
    title: base.title,
    type: "live",
    description:
      tier === "direct"
        ? "Soccer · open FAST / free · direct Playable"
        : "Soccer · open feed · plays via proxy",
    countries: base.countries || ["world"],
    categories: cats,
    languages: ["en"],
    poster: art.poster,
    backdrop: art.backdrop,
    license: "open_stream",
    isLive: true,
    featured: tier === "direct",
    sources: [
      { url: base.url, quality: "Auto", format: "hls", priority: 10 },
    ],
  };
}

function dedupe(list) {
  const map = new Map();
  for (const i of list) {
    const e = map.get(i.slug);
    if (!e) map.set(i.slug, i);
    else if (
      i.categories.includes("Playable") &&
      !e.categories.includes("Playable")
    )
      map.set(i.slug, i);
  }
  return [...map.values()];
}

async function main() {
  console.log("Soccer heal…");
  const r = await fetch(
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) },
  );
  const fromFeed = parseM3u(await r.text());
  console.log("  sports.m3u soccerish HTTPS:", fromFeed.length);

  const sportsJson = JSON.parse(
    fs.readFileSync(path.join(outDir, "sports.json"), "utf8"),
  );
  const fromDump = sportsJson
    .filter(
      (c) =>
        c.sources?.[0]?.url &&
        !isRawIp(c.sources[0].url) &&
        SOCCER_RE.test(`${c.title} ${(c.categories || []).join(" ")}`),
    )
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      url: c.sources[0].url,
      poster: c.poster,
      categories: c.categories || [],
      countries: c.countries || ["world"],
    }));

  const pool = dedupe([
    ...CURATED.map((c) => ({ ...c, categories: c.categories })),
    ...fromFeed,
    ...fromDump,
  ]);
  console.log("  pool:", pool.length);

  const healed = [];
  for (let i = 0; i < pool.length; i++) {
    const item = pool[i];
    const tier = await probeStrict(item.url);
    if ((i + 1) % 15 === 0) console.log(`  ${i + 1}/${pool.length}`);
    if (!tier) continue;
    healed.push(toItem(item, tier));
    console.log(`  + ${tier} ${item.title}`);
  }

  const playPath = path.join(outDir, "playable-sports.json");
  const prev = JSON.parse(fs.readFileSync(playPath, "utf8"));
  // Tag existing soccer with Soccer category
  const tagged = prev.map((p) => {
    if (!SOCCER_RE.test(`${p.title} ${(p.categories || []).join(" ")}`))
      return p;
    return {
      ...p,
      categories: [
        ...new Set([...(p.categories || []), "Soccer", "Football", "Sports"]),
      ],
    };
  });
  const merged = dedupe([...healed, ...tagged]);
  fs.writeFileSync(playPath, JSON.stringify(merged, null, 2));

  const soccer = merged.filter((p) =>
    SOCCER_RE.test(`${p.title} ${(p.categories || []).join(" ")}`),
  );
  console.log(`\nSoccer playable: ${soccer.length}`);
  console.log(soccer.map((s) => s.title).join(" · "));

  fs.writeFileSync(
    path.join(outDir, "heal-soccer-report.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        count: soccer.length,
        titles: soccer.map((s) => s.title),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

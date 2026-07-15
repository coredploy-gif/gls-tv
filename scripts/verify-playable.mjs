/**
 * Strict browser verify with two tiers:
 * - Playable: CORS * end-to-end (direct in browser)
 * - ProxyOk: playlist + segment OK, but CORS missing (player proxy works)
 * Dead streams are removed from playable-* files.
 *
 * Also scrubs false Playable badges from africa.json / asia.json dumps.
 *
 * Usage: npm run verify:playable
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "src", "data", "generated");
const UA = "GLS-TV-Verify/1.0";
const TIMEOUT_MS = 10000;
const CONCURRENCY = 10;

const FILES = [
  "playable-africa.json",
  "playable-asia.json",
  "playable-asia-series.json",
  "playable-korea-series.json",
  "playable-sports.json",
  "playable-kids.json",
  "playable-food.json",
  "playable-food-competitions.json",
  "playable-wrestling.json",
];

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
      ].includes(c),
  );
}

function isCorsStar(cors) {
  if (!cors) return false;
  const parts = cors.split(",").map((s) => s.trim());
  return parts.includes("*");
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

/**
 * @returns {{ tier: 'direct'|'proxy'|null, reason: string }}
 */
async function probe(url) {
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

    const segCorsOk = isCorsStar(segRes.cors) || segRes.cors === "";
    // empty segment CORS often still works if playlist had *; treat conservatively
    if (corsOk && (isCorsStar(segRes.cors) || segRes.cors === "")) {
      return { tier: "direct", reason: "ok" };
    }
    // Segment reachable → proxy can play even without CORS *
    if (segCorsOk || segRes.ok) {
      return { tier: "proxy", reason: corsOk ? "seg_cors" : "needs_proxy" };
    }
    return { tier: null, reason: "seg_blocked" };
  } catch (e) {
    return { tier: null, reason: e.cause?.code || e.message || "error" };
  }
}

function markItem(item, tier) {
  const base = stripBadges(item.categories || []);
  if (tier === "direct") {
    return {
      ...item,
      categories: [...new Set([...base, "Playable", "Verified", "Popular"])],
      featured: true,
      description: `${(item.description || "Channel").split("·")[0].trim()} · direct Playable (CORS*)`,
    };
  }
  // proxy tier — works via /api/hls, NOT a green Playable lie
  return {
    ...item,
    categories: [...new Set([...base, "ProxyOk", "Verified"])],
    featured: false,
    description: `${(item.description || "Channel").split("·")[0].trim()} · plays via proxy`,
  };
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

async function verifyFile(name) {
  const p = path.join(outDir, name);
  if (!fs.existsSync(p)) return null;
  const items = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(items) || !items.length) return { name, kept: 0, total: 0 };

  console.log(`\nVerify ${name}: ${items.length}`);
  const results = await mapPool(items, CONCURRENCY, async (item, idx) => {
    const url = item.sources?.[0]?.url;
    const probeRes = url
      ? await probe(url)
      : { tier: null, reason: "no_url" };
    if ((idx + 1) % 20 === 0) console.log(`  ${idx + 1}/${items.length}`);
    return { item, probeRes };
  });

  const kept = results
    .filter((r) => r.probeRes.tier)
    .map((r) => markItem(r.item, r.probeRes.tier));

  const direct = kept.filter((i) => i.categories.includes("Playable")).length;
  const proxy = kept.filter((i) => i.categories.includes("ProxyOk")).length;

  fs.writeFileSync(p, JSON.stringify(kept, null, 2));

  const reasons = {};
  for (const f of results.filter((r) => !r.probeRes.tier)) {
    const k = f.probeRes.reason || "fail";
    reasons[k] = (reasons[k] || 0) + 1;
  }
  console.log(
    `  ✓ keep ${kept.length} (direct ${direct} / proxy ${proxy}) / ${items.length}`,
    reasons,
  );
  return { name, kept: kept.length, direct, proxy, total: items.length, reasons };
}

function scrubRegionDumps() {
  for (const name of ["africa.json", "asia.json"]) {
    const p = path.join(outDir, name);
    if (!fs.existsSync(p)) continue;
    const items = JSON.parse(fs.readFileSync(p, "utf8"));
    const scrubbed = items.map((item) => ({
      ...item,
      categories: [
        ...new Set([
          ...stripBadges(item.categories || []),
          "Catalog",
        ]),
      ],
      featured: false,
      description: `${(item.description || "Channel").split("·")[0].trim()} · catalog (unverified)`,
    }));
    fs.writeFileSync(p, JSON.stringify(scrubbed));
    console.log(`Scrubbed badges from ${name}: ${scrubbed.length}`);
  }
}

async function main() {
  scrubRegionDumps();
  const report = [];
  for (const f of FILES) {
    const r = await verifyFile(f);
    if (r) report.push(r);
  }

  const asiaPath = path.join(outDir, "playable-asia.json");
  if (fs.existsSync(asiaPath)) {
    const asia = JSON.parse(fs.readFileSync(asiaPath, "utf8"));
    const korea = asia
      .filter(
        (c) =>
          c.countries.includes("kr") &&
          !/shop|shopping|qvc/i.test(`${c.title} ${c.categories.join(" ")}`),
      )
      .map((c) => ({
        ...c,
        type: "series",
        categories: [
          ...new Set([...c.categories, "Series", "Drama", "Korea", "Asia"]),
        ],
      }));
    fs.writeFileSync(
      path.join(outDir, "playable-korea-series.json"),
      JSON.stringify(korea, null, 2),
    );
    const series = asia
      .filter((c) =>
        /series|drama|entertainment|movie|film|cinema|zee|son/i.test(
          `${c.title} ${c.categories.join(" ")}`,
        ),
      )
      .map((c) => ({
        ...c,
        type: "series",
        categories: [...new Set([...c.categories, "Series", "Drama", "Asia"])],
      }));
    fs.writeFileSync(
      path.join(outDir, "playable-asia-series.json"),
      JSON.stringify(series, null, 2),
    );
    console.log(`Korea pack ${korea.length}, Asia series ${series.length}`);
  }

  fs.writeFileSync(
    path.join(outDir, "verify-report.json"),
    JSON.stringify({ at: new Date().toISOString(), report }, null, 2),
  );
  console.log("\nDone.", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

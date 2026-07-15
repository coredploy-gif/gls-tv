/**
 * Second pass: kids / sports / food gaps for India.
 * Usage: node scripts/heal-india-gaps.mjs
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "src", "data", "generated");
const UA = "GLS-TV-Heal-India-Gap/1.0";
const TIMEOUT_MS = 10000;

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
    status: r.status,
    cors: r.headers.get("access-control-allow-origin") || "",
    text,
  };
}

async function probeStrict(url) {
  try {
    if (!/^https:\/\//i.test(url)) return null;
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

const asia = JSON.parse(fs.readFileSync(path.join(outDir, "asia.json"), "utf8"));
const play = JSON.parse(
  fs.readFileSync(path.join(outDir, "playable-asia.json"), "utf8"),
);
const playSlugs = new Set(play.map((p) => p.slug));

const GAP_RE =
  /kid|cartoon|anime|animation|sport|cricket|food|cook|chef|kitchen|bhakti|bhajan|devotional|music/i;

const gap = asia.filter(
  (x) =>
    (x.countries || []).includes("in") &&
    !playSlugs.has(x.slug) &&
    x.sources?.[0]?.url &&
    GAP_RE.test(`${x.title} ${(x.categories || []).join(" ")}`),
);

console.log(`India gap candidates: ${gap.length}`);
const sample = gap.slice(0, 100);
const added = [];

for (let i = 0; i < sample.length; i++) {
  const g = sample[i];
  const tier = await probeStrict(g.sources[0].url);
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${sample.length}`);
  if (!tier) continue;

  const extra = [];
  const hay = `${g.title} ${(g.categories || []).join(" ")}`;
  if (/kid|cartoon|anime|animation/i.test(hay)) extra.push("Kids");
  if (/sport|cricket/i.test(hay)) extra.push("Sports");
  if (/food|cook|chef|kitchen/i.test(hay)) extra.push("Food");
  if (/music|bhakti|bhajan|devotion/i.test(hay)) extra.push("Music");

  const cats = [
    ...new Set([
      ...(g.categories || []).filter(
        (c) => !["Catalog", "Playable", "Verified", "Popular", "ProxyOk"].includes(c),
      ),
      "Asia",
      "India",
      "Healed",
      ...extra,
      ...(tier === "direct"
        ? ["Playable", "Verified", "Popular"]
        : ["ProxyOk", "Verified"]),
    ]),
  ];

  added.push({
    ...g,
    categories: cats,
    featured: tier === "direct",
    description:
      tier === "direct"
        ? "India · gap heal · direct Playable"
        : "India · gap heal · plays via proxy",
    sources: [
      {
        url: g.sources[0].url,
        quality: g.sources[0].quality || "Auto",
        format: "hls",
        priority: 10,
      },
    ],
  });
  console.log(`  + ${tier} ${g.title}`);
}

const merged = [...play.filter((p) => !added.some((a) => a.slug === p.slug)), ...added];
fs.writeFileSync(
  path.join(outDir, "playable-asia.json"),
  JSON.stringify(merged, null, 2),
);

const inPlay = merged.filter((c) => (c.countries || []).includes("in"));
console.log(`\nAdded ${added.length}`);
console.log(`India playable now: ${inPlay.length}`);
console.log({
  kids: inPlay.filter((h) => /kid|cartoon/i.test(h.categories.join(" ") + h.title)).length,
  sports: inPlay.filter((h) => /sport|cricket/i.test(h.categories.join(" ") + h.title)).length,
  food: inPlay.filter((h) => /food|cook/i.test(h.categories.join(" ") + h.title)).length,
  music: inPlay.filter((h) => /music|bhakti/i.test(h.categories.join(" ") + h.title)).length,
});

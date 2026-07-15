/**
 * Emit compact SELECT upsert_channel_seed(...) SQL files for MCP execute_sql.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gen = path.join(root, "src", "data", "generated");
const outDir = path.join(root, "tmp", "seed-fn");

const FILES = [
  ["playable-africa.json", "africa"],
  ["playable-asia.json", "asia"],
  ["playable-sports.json", "sports"],
  ["playable-kids.json", "kids"],
  ["playable-food.json", "food"],
  ["playable-wrestling.json", "sports"],
  ["top10-playable.json", "top10"],
];

function loadItems() {
  const map = new Map();
  for (const [file, region] of FILES) {
    const p = path.join(gen, file);
    if (!fs.existsSync(p)) continue;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const list = Array.isArray(raw)
      ? raw
      : Object.values(raw).flatMap((v) => (Array.isArray(v) ? v : []));
    for (const item of list) {
      if (!item?.slug || !item?.sources?.[0]?.url) continue;
      const cats = item.categories || [];
      if (
        !cats.includes("Playable") &&
        !cats.includes("ProxyOk") &&
        !cats.includes("Verified") &&
        region !== "top10"
      ) {
        continue;
      }
      const existing = map.get(item.slug);
      if (!existing) map.set(item.slug, { ...item, _region: region });
      else {
        const urls = new Set(existing.sources.map((s) => s.url));
        for (const s of item.sources) {
          if (!urls.has(s.url)) existing.sources.push(s);
        }
      }
    }
  }
  return [...map.values()];
}

const items = loadItems();
fs.mkdirSync(outDir, { recursive: true });
const batchSize = 8;
let bi = 0;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const channels = [];
  const sources = [];
  for (const item of batch) {
    const health = item.categories?.includes("Playable")
      ? "healthy"
      : item.categories?.includes("ProxyOk")
        ? "degraded"
        : "unknown";
    const url = item.sources[0].url;
    channels.push({
      id: item.id,
      slug: item.slug,
      title: item.title,
      description: item.description || "",
      type: item.type || "live",
      countries: item.countries || [],
      categories: item.categories || [],
      languages: item.languages || [],
      poster: item.poster || null,
      backdrop: item.backdrop || null,
      license: item.license || "open_stream",
      is_live: item.isLive !== false,
      featured: Boolean(item.featured),
      source_url: url,
      source_quality: item.sources[0].quality || "Auto",
      source_format: item.sources[0].format || "hls",
      health_status: health,
      is_online: true,
      active_source_url: url,
      region: item._region || null,
    });
    let pri = 10;
    for (const s of item.sources) {
      sources.push({
        channel_id: item.id,
        url: s.url,
        priority: s.priority ?? pri,
        label: s.label || (pri === 10 ? "primary" : "mirror"),
        health_status: health,
      });
      pri += 10;
    }
  }
  const payload = JSON.stringify({ channels, sources });
  // Escape for SQL single-quoted string
  const sql =
    "SELECT upsert_channel_seed('" +
    payload.replace(/'/g, "''") +
    "'::jsonb) AS upserted;";
  fs.writeFileSync(path.join(outDir, `fn-${bi}.sql`), sql);
  console.log(`fn-${bi}.sql`, sql.length, "chars", batch.length, "channels");
  bi += 1;
}
console.log("total batches", bi, "channels", items.length);

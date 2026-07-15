/**
 * Export playable packs to SQL batches for Supabase MCP / psql sync
 * when SUPABASE_SERVICE_ROLE_KEY is not set locally.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gen = path.join(root, "src", "data", "generated");
const outDir = path.join(root, "tmp", "sync-sql");

const FILES = [
  ["playable-africa.json", "africa"],
  ["playable-asia.json", "asia"],
  ["playable-sports.json", "sports"],
  ["playable-kids.json", "kids"],
  ["playable-food.json", "food"],
  ["playable-wrestling.json", "sports"],
  ["top10-playable.json", "top10"],
];

function esc(s) {
  if (s == null || s === "") return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function arr(a) {
  if (!a || !a.length) return "'{}'";
  return "ARRAY[" + a.map((x) => esc(x)).join(",") + "]::text[]";
}

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
      if (!existing) {
        map.set(item.slug, { ...item, _region: region });
      } else {
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
const batchSize = 35;
let bi = 0;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const chVals = [];
  const srcVals = [];

  for (const item of batch) {
    const health = item.categories?.includes("Playable")
      ? "healthy"
      : item.categories?.includes("ProxyOk")
        ? "degraded"
        : "unknown";
    const url = item.sources[0].url;
    chVals.push(
      "(" +
        [
          esc(item.id),
          esc(item.slug),
          esc(item.title),
          esc(item.description || ""),
          esc(item.type || "live"),
          arr(item.countries || []),
          arr(item.categories || []),
          arr(item.languages || []),
          esc(item.poster),
          esc(item.backdrop),
          esc(item.license || "open_stream"),
          item.isLive !== false,
          Boolean(item.featured),
          esc(url),
          esc(item.sources[0].quality || "Auto"),
          esc(item.sources[0].format || "hls"),
          esc(health),
          "true",
          esc(url),
          esc(item._region || null),
          "now()",
        ].join(",") +
        ")",
    );

    let pri = 10;
    for (const s of item.sources) {
      srcVals.push(
        "(" +
          [
            esc(item.id),
            esc(s.url),
            pri,
            esc(s.label || (pri === 10 ? "primary" : "mirror")),
            esc(health),
            "now()",
          ].join(",") +
          ")",
      );
      pri += 10;
    }
  }

  const sql = `-- batch ${bi} (${batch.length} channels)
INSERT INTO channels (
  id, slug, title, description, type, countries, categories, languages,
  poster, backdrop, license, is_live, featured, source_url, source_quality,
  source_format, health_status, is_online, active_source_url, region, updated_at
) VALUES
${chVals.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  countries = EXCLUDED.countries,
  categories = EXCLUDED.categories,
  languages = EXCLUDED.languages,
  poster = EXCLUDED.poster,
  backdrop = EXCLUDED.backdrop,
  license = EXCLUDED.license,
  is_live = EXCLUDED.is_live,
  featured = EXCLUDED.featured,
  source_url = EXCLUDED.source_url,
  source_quality = EXCLUDED.source_quality,
  source_format = EXCLUDED.source_format,
  health_status = EXCLUDED.health_status,
  is_online = EXCLUDED.is_online,
  active_source_url = EXCLUDED.active_source_url,
  region = EXCLUDED.region,
  updated_at = EXCLUDED.updated_at;

INSERT INTO channel_sources (channel_id, url, priority, label, health_status, updated_at)
VALUES
${srcVals.join(",\n")}
ON CONFLICT (channel_id, url) DO UPDATE SET
  priority = EXCLUDED.priority,
  label = EXCLUDED.label,
  health_status = EXCLUDED.health_status,
  updated_at = EXCLUDED.updated_at;
`;

  fs.writeFileSync(path.join(outDir, `batch-${bi}.sql`), sql);
  bi += 1;
}

console.log(`Wrote ${bi} batches for ${items.length} channels → ${outDir}`);

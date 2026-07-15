/**
 * Sync playable packs via upsert_channel_seed RPC (anon key).
 * Requires temporary GRANT to anon (revoked after sync).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gen = path.join(root, "src", "data", "generated");

try {
  const envPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
} catch {
  /* ignore */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL or key");
  process.exit(1);
}

const sb = createClient(url, key);

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
const batchSize = 15;
let ok = 0;

console.log(`Syncing ${items.length} via upsert_channel_seed…`);

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
    const streamUrl = item.sources[0].url;
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
      source_url: streamUrl,
      source_quality: item.sources[0].quality || "Auto",
      source_format: item.sources[0].format || "hls",
      health_status: health,
      is_online: true,
      active_source_url: streamUrl,
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

  const { data, error } = await sb.rpc("upsert_channel_seed", {
    p: { channels, sources },
  });
  if (error) {
    console.error("batch", i, error.message);
    continue;
  }
  ok += typeof data === "number" ? data : batch.length;
  console.log(`  ${Math.min(i + batchSize, items.length)}/${items.length} (rpc=${data})`);
}

console.log(`Done. Upserted ~${ok} channels.`);

/**
 * Upsert local playable packs into Supabase channels + channel_sources.
 * Prefer SUPABASE_SERVICE_ROLE_KEY (npm run sync:supabase).
 * Fallback without service role: temporarily GRANT upsert_channel_seed to anon,
 * then npm run sync:rpc (script revokes nothing — revoke after use).
 *
 * Usage:
 *   set SUPABASE_SERVICE_ROLE_KEY=...
 *   npm run sync:supabase
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gen = path.join(root, "src", "data", "generated");

// Load .env.local manually
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  console.error(
    "Add SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API). Rotate if it was pasted in chat.",
  );
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
      // Prefer Playable / ProxyOk only
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
        // merge mirrors
        const urls = new Set(existing.sources.map((s) => s.url));
        for (const s of item.sources) {
          if (!urls.has(s.url)) existing.sources.push(s);
        }
      }
    }
  }
  return [...map.values()];
}

async function main() {
  const items = loadItems();
  console.log(`Syncing ${items.length} channels…`);

  let ok = 0;
  for (const item of items) {
    const channel = {
      id: item.id,
      slug: item.slug,
      title: item.title,
      description: item.description || "",
      type: item.type || "live",
      countries: item.countries || [],
      categories: item.categories || [],
      languages: item.languages || [],
      poster: item.poster,
      backdrop: item.backdrop,
      license: item.license || "open_stream",
      is_live: item.isLive !== false,
      featured: Boolean(item.featured),
      source_url: item.sources[0].url,
      source_quality: item.sources[0].quality || "Auto",
      source_format: item.sources[0].format || "hls",
      health_status: item.categories?.includes("Playable")
        ? "healthy"
        : item.categories?.includes("ProxyOk")
          ? "degraded"
          : "unknown",
      is_online: true,
      active_source_url: item.sources[0].url,
      region: item._region || null,
      updated_at: new Date().toISOString(),
    };

    const { error: cErr } = await sb.from("channels").upsert(channel, {
      onConflict: "id",
    });
    if (cErr) {
      console.warn("channel", item.slug, cErr.message);
      continue;
    }

    // Upsert each mirror
    let priority = 10;
    for (const s of item.sources) {
      const { error: sErr } = await sb.from("channel_sources").upsert(
        {
          channel_id: item.id,
          url: s.url,
          priority: s.priority ?? priority,
          label: s.label || (priority === 10 ? "primary" : "mirror"),
          health_status: item.categories?.includes("Playable")
            ? "healthy"
            : "degraded",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel_id,url" },
      );
      if (sErr) console.warn("source", item.slug, sErr.message);
      priority += 10;
    }

    await sb.rpc("rollup_channel_health", { p_channel_id: item.id });
    ok += 1;
    if (ok % 25 === 0) console.log(`  ${ok}/${items.length}`);
  }

  console.log(`Done. Upserted ${ok} channels.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

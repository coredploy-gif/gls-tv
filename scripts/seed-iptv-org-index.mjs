/**
 * Seed ALL channels from the public iptv-org index.m3u into Supabase
 * (channels + channel_sources). Does NOT dump 13k into the phone UI —
 * browse via search / watch by slug; curated Sports stay lean.
 *
 *   node scripts/seed-iptv-org-index.mjs
 *   node scripts/seed-iptv-org-index.mjs --limit=500   # smoke test
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL + anon (or SERVICE_ROLE) via upsert_channel_seed RPC.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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

const INDEX = "https://iptv-org.github.io/iptv/index.m3u";
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 0;
const BATCH = 40;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL + anon/service key");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function attr(meta, key) {
  const m = meta.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return m?.[1] || "";
}

function slugify(raw) {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9@.]+/g, "-")
      .replace(/[@.]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "ch"
  );
}

function parseIndex(text) {
  const lines = text.split(/\r?\n/);
  const bySlug = new Map();
  let pending = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const comma = line.lastIndexOf(",");
      const titleRaw = (comma >= 0 ? line.slice(comma + 1) : "Unknown").trim();
      const meta = line.slice(0, comma >= 0 ? comma : undefined);
      const tvgId = attr(meta, "tvg-id");
      const logo = attr(meta, "tvg-logo");
      const group = attr(meta, "group-title") || "General";
      const geoBlocked = /\[\s*geo[-\s]?blocked\s*\]/i.test(titleRaw);
      const categories = [
        ...new Set(
          group
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .concat(geoBlocked ? ["IptvOrg", "Geo"] : ["IptvOrg"]),
        ),
      ];
      let country = "world";
      const cm = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
      if (cm) country = cm[1].toLowerCase();
      const qm = titleRaw.match(/\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)/i);
      const quality = qm ? qm[1].toUpperCase() : "Auto";
      const title =
        titleRaw
          .replace(/\s*\[\s*geo[-\s]?blocked\s*\]/gi, "")
          .replace(/\s*\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)\s*$/i, "")
          .trim() ||
        titleRaw;
      const idBase = tvgId || title;
      const slug = slugify(idBase);
      pending = {
        slug,
        title,
        tvgId,
        logo,
        categories,
        country,
        quality,
      };
      continue;
    }

    if (pending && /^https?:\/\//i.test(line)) {
      const streamUrl = line.trim();
      const id = `iptv-${pending.slug}`;
      const existing = bySlug.get(pending.slug);
      if (!existing) {
        bySlug.set(pending.slug, {
          id,
          slug: pending.slug,
          title: pending.title,
          description: `iptv-org · ${pending.categories.filter((c) => c !== "IptvOrg").join(" · ") || "live"}`,
          type: "live",
          countries: [pending.country],
          categories: pending.categories,
          languages: [],
          poster: pending.logo || null,
          backdrop: pending.logo || null,
          license: "open_stream",
          is_live: true,
          featured: false,
          source_url: streamUrl,
          source_quality: pending.quality,
          source_format: /\.m3u8(\?|$)/i.test(streamUrl) ? "hls" : "mp4",
          health_status: "degraded",
          is_online: true,
          active_source_url: streamUrl,
          region: "iptv-org",
          _sources: [
            {
              channel_id: id,
              url: streamUrl,
              priority: 10,
              label: "iptv-org",
              health_status: "degraded",
            },
          ],
        });
      } else {
        const urls = new Set(existing._sources.map((s) => s.url));
        if (!urls.has(streamUrl)) {
          existing._sources.push({
            channel_id: existing.id,
            url: streamUrl,
            priority: 10 + existing._sources.length * 10,
            label: "iptv-org-mirror",
            health_status: "degraded",
          });
        }
      }
      pending = null;
      if (LIMIT > 0 && bySlug.size >= LIMIT) break;
    }
  }

  return [...bySlug.values()];
}

console.log("Downloading", INDEX, "…");
const res = await fetch(INDEX, {
  headers: { "User-Agent": "GLS-TV/1.0 (full-index-seed)" },
});
if (!res.ok) {
  console.error("Download failed", res.status);
  process.exit(1);
}
const text = await res.text();
const cacheDir = path.join(root, "data-cache");
fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(path.join(cacheDir, "index.m3u"), text);
console.log(`Cached ${(text.length / 1e6).toFixed(1)} MB`);

const items = parseIndex(text);
console.log(`Parsed ${items.length} unique channels from index`);

let ok = 0;
let fail = 0;

for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  const channels = batch.map((item) => {
    const { _sources, ...ch } = item;
    return ch;
  });
  const sources = batch.flatMap((item) => item._sources);

  const { data, error } = await sb.rpc("upsert_channel_seed", {
    p: { channels, sources },
  });

  if (error) {
    fail += batch.length;
    console.error(`batch ${i}:`, error.message);
    // smaller retry on fail
    for (const item of batch) {
      const { _sources, ...ch } = item;
      const r = await sb.rpc("upsert_channel_seed", {
        p: { channels: [ch], sources: _sources },
      });
      if (r.error) console.error("  ", item.slug, r.error.message);
      else ok += 1;
    }
  } else {
    ok += typeof data === "number" ? data : batch.length;
  }

  if ((i / BATCH) % 5 === 0 || i + BATCH >= items.length) {
    console.log(`  ${Math.min(i + BATCH, items.length)}/${items.length} upserted≈${ok} fail≈${fail}`);
  }
}

console.log(`Done. Upserted ~${ok} channels into Supabase (region=iptv-org).`);

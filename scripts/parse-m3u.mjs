import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseM3u(text, { defaultCountry, forceCategory } = {}) {
  const lines = text.split(/\r?\n/);
  const items = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;
    const url = (lines[i + 1] || "").trim();
    if (!url || url.startsWith("#")) continue;

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

    let country = defaultCountry || "world";
    const cm = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
    if (cm) country = cm[1].toLowerCase();

    const qm = title.match(/\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)/i);
    const quality = qm ? qm[1].toUpperCase() : "Auto";

    const categories = [
      ...new Set(
        group
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (
      forceCategory &&
      !categories.map((c) => c.toLowerCase()).includes(forceCategory.toLowerCase())
    ) {
      categories.unshift(forceCategory);
    }

    const idBase = (tvgId || title)
      .toLowerCase()
      .replace(/[^a-z0-9@.]+/g, "-");
    const slug =
      idBase.replace(/[@.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
      `ch-${items.length}`;

    const cleanTitle =
      title.replace(/\s*\((\d{3,4}p|SD|HD|FHD|4K|UHD)\)\s*$/i, "").trim() ||
      title;

    const fallbackArt =
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1200&q=80";

    items.push({
      id: `iptv-${slug}`,
      slug,
      title: cleanTitle,
      type: "live",
      description: `${categories.join(" · ")} live channel`,
      countries: [country],
      categories,
      languages: [],
      poster: logo || fallbackArt,
      backdrop: logo || fallbackArt,
      license: "open_stream",
      isLive: true,
      sources: [
        {
          url,
          quality,
          format: url.includes(".m3u8") ? "hls" : "mp4",
        },
      ],
      tvgId: tvgId || null,
    });
  }

  return items;
}

const root = path.join(__dirname, "..");
const outDir = path.join(root, "src", "data", "generated");
fs.mkdirSync(outDir, { recursive: true });

const sports = parseM3u(
  fs.readFileSync(path.join(root, "data-cache", "sports.m3u"), "utf8"),
  { forceCategory: "Sports" },
);
const us = parseM3u(
  fs.readFileSync(path.join(root, "data-cache", "us.m3u"), "utf8"),
  { defaultCountry: "us" },
);

function safeParse(name, opts) {
  const p = path.join(root, "data-cache", `${name}.m3u`);
  if (!fs.existsSync(p)) return [];
  return parseM3u(fs.readFileSync(p, "utf8"), opts);
}

const kids = safeParse("kids", { forceCategory: "Kids" });
const animation = safeParse("animation", { forceCategory: "Kids" });
const cooking = safeParse("cooking", { forceCategory: "Food" });

// Apply channel overrides (e.g. dead beIN USA → XTRA)
const overridesPath = path.join(outDir, "channel-overrides.json");
let overrides = {};
if (fs.existsSync(overridesPath)) {
  overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
}

function applyOverrides(list) {
  return list.map((item) => {
    const o = overrides[item.slug];
    if (!o) return item;
    return {
      ...item,
      title: o.title || item.title,
      categories: [
        ...new Set([...(o.categories || item.categories), "Healed"]),
      ],
      sources: [
        {
          url: o.url || item.sources[0].url,
          quality: item.sources[0]?.quality || "Auto",
          format: "hls",
        },
      ],
      description: o.note || item.description,
    };
  });
}

fs.writeFileSync(
  path.join(outDir, "sports.json"),
  JSON.stringify(applyOverrides(sports)),
);
fs.writeFileSync(path.join(outDir, "us.json"), JSON.stringify(applyOverrides(us)));
fs.writeFileSync(
  path.join(outDir, "kids.json"),
  JSON.stringify(applyOverrides([...kids, ...animation])),
);
fs.writeFileSync(
  path.join(outDir, "food.json"),
  JSON.stringify(applyOverrides(cooking)),
);

console.log(
  `Wrote sports=${sports.length} us=${us.length} kids=${kids.length + animation.length} food=${cooking.length}`,
);

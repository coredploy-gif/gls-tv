/**
 * Cherry-pick allowlisted channels from iptv-org → Supabase stream_seeds.
 *
 *   node --env-file=.env.local scripts/seed-iptv-org-targets.mjs
 *   node --env-file=.env.local scripts/seed-iptv-org-targets.mjs --index
 *   node --env-file=.env.local scripts/seed-iptv-org-targets.mjs --keep-existing
 *
 * Never dumps the full 13k list into the app — only matched targets.
 */

import { createClient } from "@supabase/supabase-js";

const INDEX = "https://iptv-org.github.io/iptv/index.m3u";
const country = (c) => `https://iptv-org.github.io/iptv/countries/${c}.m3u`;

const TARGETS = [
  {
    slug: "sabc-1",
    title: "SABC 1",
    match: [/^sabc\s*1\b/i],
    categories: ["General", "Africa", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "sabc-2",
    title: "SABC 2",
    match: [/^sabc\s*2\b/i],
    categories: ["General", "Africa", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "sabc-3",
    title: "SABC 3",
    match: [/^sabc\s*3\b/i],
    categories: ["General", "Africa", "Geo", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "sabc-news",
    title: "SABC News",
    match: [/^sabc\s*news/i],
    categories: ["News", "Africa", "Popular", "UserSeed"],
    countries: ["za", "world"],
  },
  {
    slug: "zbc-tv",
    title: "ZBC TV",
    match: [/^zbc(\s*tv)?\b/i],
    categories: ["General", "Africa", "Popular", "UserSeed"],
    countries: ["zw", "world"],
  },
];

function attr(line, key) {
  const m = line.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return m?.[1]?.trim() || "";
}

function scoreUrl(url) {
  let s = 0;
  if (url.startsWith("https://")) s += 50;
  if (/\.m3u8(\?|$)/i.test(url)) s += 30;
  if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url)) s -= 40;
  return s;
}

function extract(text) {
  const lines = text.split(/\r?\n/);
  const best = new Map();
  let pending = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      pending = null;
      const playlistTitle = line.split(",").pop()?.trim() || "";
      const tvgId = attr(line, "tvg-id");
      const target = TARGETS.find((t) =>
        t.match.some((re) => re.test(playlistTitle) || re.test(tvgId)),
      );
      if (!target) continue;
      pending = {
        target,
        playlistTitle,
        logo: attr(line, "tvg-logo"),
        group: attr(line, "group-title") || "General",
      };
      continue;
    }

    if (pending && /^https?:\/\//i.test(line)) {
      const url = line.trim();
      const score = scoreUrl(url);
      const prev = best.get(pending.target.slug);
      if (!prev || score > prev._score) {
        best.set(pending.target.slug, {
          slug: pending.target.slug,
          title: pending.target.title,
          playlistTitle: pending.playlistTitle,
          url,
          logo: pending.logo,
          categories: pending.target.categories,
          countries: pending.target.countries,
          _score: score,
        });
      }
      pending = null;
    }
  }

  return [...best.values()].map(({ _score, ...row }) => row);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "GLS-TV/1.0 (seed-iptv-org-targets)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const useIndex = process.argv.includes("--index");
const keepExisting = process.argv.includes("--keep-existing");
const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dryRun && (!url || !key)) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or pass --dry-run)");
  process.exit(1);
}

const supabase =
  !dryRun && url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

console.log(
  useIndex
    ? "Downloading full iptv-org index.m3u …"
    : "Downloading country/sports slices (smart) …",
);

let matches = [];
if (useIndex) {
  const text = await fetchText(INDEX);
  matches = extract(text);
} else {
  const feeds = [
    country("za"),
    country("zw"),
  ];
  const texts = await Promise.all(feeds.map(fetchText));
  const map = new Map();
  for (const t of texts) {
    for (const m of extract(t)) {
      const prev = map.get(m.slug);
      if (!prev || (m.url.startsWith("https://") && !prev.url.startsWith("https://"))) {
        map.set(m.slug, m);
      } else if (!prev) map.set(m.slug, m);
    }
  }
  matches = [...map.values()];
}

console.log(`Matched ${matches.length}/${TARGETS.length} targets in playlist:`);
for (const m of matches) {
  console.log(`  ✓ ${m.slug} ← "${m.playlistTitle}"`);
}
const missing = TARGETS.filter((t) => !matches.some((m) => m.slug === t.slug));
for (const t of missing) {
  console.log(`  ✗ ${t.slug} — not in playlist (left alone)`);
}

const { data: existing } = dryRun
  ? { data: [] }
  : await supabase
      .from("stream_seeds")
      .select("slug, url")
      .in(
        "slug",
        TARGETS.map((t) => t.slug),
      );
const bySlug = new Map((existing ?? []).map((r) => [r.slug, r]));

let written = 0;
for (const m of matches) {
  if (keepExisting && bySlug.get(m.slug)?.url?.trim()) {
    console.log(`  skip ${m.slug} (URL already set)`);
    continue;
  }
  if (dryRun) {
    console.log(`  [dry-run] would upsert ${m.slug} → ${m.url.slice(0, 72)}…`);
    written++;
    continue;
  }
  const { error } = await supabase.from("stream_seeds").upsert(
    {
      slug: m.slug,
      title: m.title,
      url: m.url,
      categories: m.categories,
      countries: m.countries,
      poster: m.logo || "",
      backdrop: m.logo || "",
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );
  if (error) {
    console.error(m.slug, error.message);
    process.exit(1);
  }
  written++;
}

console.log(
  dryRun
    ? `Dry-run: ${written} match(es) ready (nothing written).`
    : `Upserted ${written} seed(s) into stream_seeds.`,
);

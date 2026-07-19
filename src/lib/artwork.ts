/**
 * Netflix-class artwork helpers — Full HD / 4K cinematic plates when catalog
 * only ships a blank IPTV channel logo.
 */

const POSTER_FALLBACK =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2160&h=3240&q=92";
const BACKDROP_FALLBACK =
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=3840&h=2160&q=92";

const u = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=92`;

/** Generic cinematic fallback plates (2:3). */
const CINEMATIC_PLATES = [
  u("photo-1574629810360-7efbbe195018", 1600, 2400),
  u("photo-1461896836934-ffe607ba6851", 1600, 2400),
  u("photo-1546519638-68e109498ffc", 1600, 2400),
  u("photo-1612872087720-bb876e2e67d1", 1600, 2400),
  u("photo-1504711434869-e1e241b58b61", 1600, 2400),
  u("photo-1493225457124-a3eb161ffa5f", 1600, 2400),
  u("photo-1470225620780-dba8ba36b745", 1600, 2400),
  u("photo-1556909114-f6e7ad7d3136", 1600, 2400),
  u("photo-1511671782779-c97d3d27a1d4", 1600, 2400),
  u("photo-1485846234645-a62644f84728", 1600, 2400),
];

/** Diversified 4K-capable plates per hub — hashed per channel so rows aren't clones. */
const CATEGORY_PLATES: Record<string, string[]> = {
  sports: [
    u("photo-1574629810360-7efbbe195018", 1600, 2400), // soccer stadium night
    u("photo-1431324155629-1a6deb1dec8d", 1600, 2400), // soccer crowd
    u("photo-1522778119026-d647f0596c20", 1600, 2400), // soccer ball
    u("photo-1579952363873-27f3bade9f55", 1600, 2400), // soccer strike
    u("photo-1517466787929-bc90951d0974", 1600, 2400), // soccer match
    u("photo-1508098682721-e5dbc6094189", 1600, 2400), // stadium bowl
    u("photo-1560272564-c83b66b1ad12", 1600, 2400), // pitch action
    u("photo-1459865264687-595d652de67e", 1600, 2400), // aerial pitch
    u("photo-1575361204480-aadea25e6d68", 1600, 2400), // green pitch
    u("photo-1624526267942-ab0ff8a3e972", 1600, 2400), // night floodlights
  ],
  news: [
    u("photo-1504711434869-e1e241b58b61", 1600, 2400),
    u("photo-1495020689067-958852a7765e", 1600, 2400),
    u("photo-1504711332673-fb914d329d74", 1600, 2400),
    u("photo-1585829365295-ab7cd400c167", 1600, 2400),
    u("photo-1523995462485-3d171b5c8fa9", 1600, 2400),
    u("photo-1513635269975-59663e0ac1ad", 1600, 2400),
  ],
  music: [
    u("photo-1493225457124-a3eb161ffa5f", 1600, 2400),
    u("photo-1470225620780-dba8ba36b745", 1600, 2400),
    u("photo-1511671782779-c97d3d27a1d4", 1600, 2400),
    u("photo-1514320291840-2e0a9bf2a9ae", 1600, 2400),
  ],
  kids: [
    u("photo-1566576912321-d58ddd7a6088", 1600, 2400),
    u("photo-1515488042361-ee00e0ddd4e4", 1600, 2400),
    u("photo-1587654780291-39c9404d749b", 1600, 2400),
    u("photo-1596464716127-f2a82984de30", 1600, 2400),
    u("photo-1503454537195-1dcabb73ffb9", 1600, 2400),
    u("photo-1471286174890-9c112ffca5b4", 1600, 2400),
    u("photo-1516627145497-ae6968895b74", 1600, 2400),
    u("photo-1606092195730-5d7b9af1efc5", 1600, 2400),
  ],
  food: [
    u("photo-1556909114-f6e7ad7d3136", 1600, 2400),
    u("photo-1504674900247-0877df9cc836", 1600, 2400),
    u("photo-1414235077428-338989a2e8c0", 1600, 2400),
    u("photo-1467003909585-2f8a72700288", 1600, 2400),
    u("photo-1540189549336-e6e99c3679fe", 1600, 2400),
    u("photo-1565299624946-b28f40a0ae38", 1600, 2400),
  ],
  africa: [
    u("photo-1484318571209-661cf29a69c3", 1600, 2400),
    u("photo-1523805009345-7448845a9e53", 1600, 2400),
    u("photo-1516026672322-bc52d61a55d5", 1600, 2400),
  ],
  asia: [
    u("photo-1540959733332-eab4deabeeaf", 1600, 2400),
    u("photo-1493976040374-85c8e12f0c0e", 1600, 2400),
    u("photo-1528164344705-47542687000d", 1600, 2400),
  ],
  movies: [
    u("photo-1489599849927-2ee91cede3ba", 1600, 2400),
    u("photo-1485846234645-a62644f84728", 1600, 2400),
  ],
  live: [
    u("photo-1522869635100-9f4c5e86aa37", 1600, 2400),
    u("photo-1598899134739-24c46f58b8c0", 1600, 2400),
  ],
};

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickPlate(plates: string[], seed: string) {
  return plates[hashSeed(seed) % plates.length]!;
}

/** Already a photographic / cinematic CDN — keep as full-bleed art. */
export function isCinematicArtUrl(url: string | null | undefined) {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    /images\.unsplash\.com/.test(u) ||
    /image\.tmdb\.org/.test(u) ||
    /images\.pexels\.com/.test(u)
  );
}

/** IPTV / FAST channel marks that look blank when stretched to 2:3. */
export function isLikelyChannelLogo(url: string | null | undefined) {
  if (!url) return true;
  if (isCinematicArtUrl(url)) return false;
  const u = url.toLowerCase();
  return (
    /imgur\.com|i\.imgur\.com/.test(u) ||
    /colorlogopng|logo\.png|logo\.svg|\/logos?\//.test(u) ||
    /_logo_|-logo-|logopedia|channel.?logo|tvg-logo/.test(u) ||
    /images\.pluto\.tv\/channels/.test(u) ||
    /jiotvimages|admango\.cdn/.test(u) ||
    /provider-static\.plex\.tv/.test(u) ||
    /static\.wikia\.nocookie\.net/.test(u) ||
    /upload\.wikimedia\.org|wikipedia\.org/.test(u) ||
    /cloudfront\.net.*logo|logo.*cloudfront\.net/.test(u) ||
    /smotret\.tv\/images/.test(u) ||
    /wurl\.com/.test(u) ||
    /\.(svg)(\?|$)/.test(u) ||
    /\/dare_images\//.test(u)
  );
}

/**
 * Live TV without real photography should never render as a stretched blank logo.
 */
export function shouldUseCinematicPlate(
  poster: string | null | undefined,
  type?: string,
) {
  if (isCinematicArtUrl(poster)) return false;
  if (isLikelyChannelLogo(poster)) return true;
  if (type === "live") return true;
  return !poster;
}

/** Upgrade CDN params for a 4K-class poster master (2160×3240). */
export function hdPosterUrl(url: string | null | undefined): string {
  if (!url) return POSTER_FALLBACK;
  return upgradeCdnUrl(url, "poster") || POSTER_FALLBACK;
}

/** Upgrade CDN params for hero ≈ Full HD–4K. */
export function hdBackdropUrl(
  url: string | null | undefined,
  width = 3840,
): string {
  if (!url) return BACKDROP_FALLBACK;
  return upgradeCdnUrl(url, "backdrop", width) || BACKDROP_FALLBACK;
}

function upgradeCdnUrl(
  url: string,
  kind: "poster" | "backdrop",
  backdropW = 3840,
): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("unsplash.com")) {
      parsed.searchParams.set("auto", "format");
      parsed.searchParams.set("fit", "crop");
      parsed.searchParams.set("q", "92");
      if (kind === "poster") {
        parsed.searchParams.set("w", "2160");
        parsed.searchParams.set("h", "3240");
      } else {
        parsed.searchParams.set("w", String(backdropW));
        parsed.searchParams.set(
          "h",
          String(Math.round(backdropW * 0.5625)),
        );
      }
      return parsed.href;
    }

    if (host === "image.tmdb.org") {
      if (kind === "poster") {
        parsed.pathname = parsed.pathname.replace(
          /\/t\/p\/(?:original|w\d+)\//,
          "/t/p/w780/",
        );
      } else {
        parsed.pathname = parsed.pathname.replace(
          /\/t\/p\/(?:original|w\d+)\//,
          backdropW >= 2560 ? "/t/p/original/" : "/t/p/w1280/",
        );
      }
      return parsed.href;
    }

    if (host.includes("wikimedia.org") || host.includes("wikipedia.org")) {
      return url.replace(
        /\/(\d+)px-/,
        kind === "poster" ? "/800px-" : "/1920px-",
      );
    }

    return url;
  } catch {
    return url;
  }
}

export function cinematicPosterPlate(
  seed: string,
  categories: string[] = [],
): string {
  const cat = categories.map((c) => c.toLowerCase()).join(" ");
  for (const [key, plates] of Object.entries(CATEGORY_PLATES)) {
    if (cat.includes(key)) return hdPosterUrl(pickPlate(plates, seed));
  }
  return hdPosterUrl(pickPlate(CINEMATIC_PLATES, seed));
}

/**
 * Local, resolution-independent fail-safe artwork. It keeps a card polished
 * when a remote logo or poster disappears instead of leaving an empty tile.
 */
export function brandedPosterFallback(title: string, categories: string[] = []) {
  const seed = `${title}-${categories.join("-")}`;
  const hue = hashSeed(seed) % 360;
  const accent = (hue + 42) % 360;
  const label = title.replace(/[&<>"']/g, "").slice(0, 42) || "GLS TV";
  const kind = categories.find((category) => /sport|news|movie|series|music|kids|food/i.test(category)) || "GLS TV";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1620" role="img" aria-label="${label}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 72% 32%)"/><stop offset="1" stop-color="hsl(${accent} 78% 12%)"/></linearGradient>
      <radialGradient id="r" cx="75%" cy="12%" r="74%"><stop stop-color="hsl(${accent} 90% 62%)" stop-opacity=".58"/><stop offset="1" stop-color="#050505" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1080" height="1620" fill="#080808"/><rect width="1080" height="1620" fill="url(#g)"/><rect width="1080" height="1620" fill="url(#r)"/>
    <path d="M-70 1240 1160 720v980H-70z" fill="#000" fill-opacity=".34"/>
    <text x="82" y="120" fill="white" fill-opacity=".82" font-family="Arial,sans-serif" font-size="38" font-weight="700" letter-spacing="10">GLS TV</text>
    <text x="82" y="1330" fill="white" fill-opacity=".72" font-family="Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="6">${kind.toUpperCase()}</text>
    <foreignObject x="82" y="1385" width="880" height="160"><div xmlns="http://www.w3.org/1999/xhtml" style="font:800 74px/1.05 Arial,sans-serif;color:white;letter-spacing:-2px">${label}</div></foreignObject>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** 16:9 hero plate for logo-only channels. */
export function cinematicBackdropPlate(
  seed: string,
  categories: string[] = [],
): string {
  return cinematicPosterPlate(seed, categories).replace(
    /w=\d+&h=\d+/,
    "w=3840&h=2160",
  );
}

export function posterSrcSet(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("unsplash.com")) return undefined;
    const mk = (w: number, h: number) => {
      const x = new URL(parsed.href);
      x.searchParams.set("w", String(w));
      x.searchParams.set("h", String(h));
      x.searchParams.set("q", "92");
      x.searchParams.set("auto", "format");
      x.searchParams.set("fit", "crop");
      return `${x.href} ${w}w`;
    };
    return [
      mk(600, 900),
      mk(900, 1350),
      mk(1200, 1800),
      mk(1600, 2400),
      mk(2160, 3240),
    ].join(
      ", ",
    );
  } catch {
    return undefined;
  }
}

export function backdropSrcSet(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("unsplash.com")) {
      const mk = (w: number) => {
        const x = new URL(parsed.href);
        x.searchParams.set("w", String(w));
        x.searchParams.set("h", String(Math.round(w * 0.5625)));
        x.searchParams.set("q", "92");
        x.searchParams.set("auto", "format");
        x.searchParams.set("fit", "crop");
        return `${x.href} ${w}w`;
      };
      return [mk(1280), mk(1920), mk(2560), mk(3840)].join(", ");
    }
    if (parsed.hostname === "image.tmdb.org") {
      const path = parsed.pathname.replace(/\/t\/p\/(?:original|w\d+)\//, "/");
      return [
        `https://image.tmdb.org/t/p/w1280${path} 1280w`,
        `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces${path} 1920w`,
        `https://image.tmdb.org/t/p/original${path} 3840w`,
      ].join(", ");
    }
    return undefined;
  } catch {
    return undefined;
  }
}

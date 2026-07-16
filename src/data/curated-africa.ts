import type { CatalogItem } from "@/data/types";

const SABC1 =
  "https://sabconeta.cdn.mangomolo.com/sabc1/smil:sabc1.stream.smil/master.m3u8";
const SABC2 =
  "https://sabctwota.cdn.mangomolo.com/sabc2/smil:sabc2.stream.smil/master.m3u8";
const SABC3 =
  "https://sabctreta.cdn.mangomolo.com/sabc3/smil:sabc3.stream.smil/master.m3u8";
const SABC3_CHUNK =
  "https://sabctreta.cdn.mangomolo.com/sabc3/smil:sabc3.stream.smil/chunklist_b1600000_t64NzIwcA==.m3u8";
const SABC_NEWS =
  "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8";
const LN24 =
  "https://cdnstack.internetmultimediaonline.org/ln24/ln24.stream/playlist.m3u8";
const HOPE_AFRICA = "https://jstre.am/live/jsl:i1onRBELcGV.m3u8";
const WILDEARTH = "https://wildearth-xumo.amagi.tv/master.m3u8";

/** Trace+ CDN is often filtered (e.g. ZA grouptag). Prefer open Amagi FAST. */
const TRACE_URBAN = [
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-traceurban-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 10,
    label: "amagi-tcl",
  },
  {
    url: "https://amg01131-tracetv-amg01131c1-rakuten-us-1081.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg01131-tracetvfast-traceurban-rakutenus/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 20,
    label: "amagi-rakuten",
  },
  {
    url: "https://lightning-traceurban-samsungau.amagi.tv/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 30,
    label: "amagi-au",
  },
];
const TRACE_LATINA = [
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-tracelatina-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 10,
    label: "amagi-tcl",
  },
  {
    url: "https://amg01131-tracetv-tracelatina-klowdtv-v10em.amagi.tv/playlist/amg01131-tracetv-tracelatina-klowdtv/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 20,
    label: "amagi-klowd",
  },
];
const TRACE_BRAZUCA = [
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-tracebrazuca-tcl/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 10,
    label: "amagi-tcl",
  },
  {
    url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01131-tracetv-tracebrazuca-xiaomi/playlist.m3u8",
    quality: "HD",
    format: "hls" as const,
    priority: 20,
    label: "amagi-xiaomi",
  },
];
const AFROBEATS = {
  url: "https://stream.ecable.tv/afrobeats/tracks-v1a1/mono.m3u8",
  quality: "Auto",
  format: "hls" as const,
  priority: 40,
  label: "afrobeats-failover",
};

/**
 * Hand-curated southern Africa FTA / community feeds.
 *
 * SABC 3 is geo-blocked outside ZA more strictly than SABC 1/2.
 * It is labelled Geo and played directly where the broadcaster permits it.
 * Encrypted e.tv main linear is not listed — open ZA news alternatives instead.
 */
export const CURATED_AFRICA: CatalogItem[] = [
  {
    id: "curated-sabc1-za",
    slug: "sabc-1",
    title: "SABC 1",
    type: "live",
    description: "SABC public FTA · mangomolo CDN (geo-sensitive).",
    countries: ["za"],
    categories: [
      "General",
      "Africa",
      "Entertainment",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Geo",
      "ProxyOk",
    ],
    languages: ["en", "zu"],
    poster: "https://i.imgur.com/G8OXWe4.png",
    backdrop: "https://i.imgur.com/G8OXWe4.png",
    license: "fta_public",
    isLive: true,
    featured: true,
    sources: [
      {
        url: SABC1,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "mangomolo",
      },
    ],
  },
  {
    id: "curated-sabc2-za",
    slug: "sabc-2",
    title: "SABC 2",
    type: "live",
    description: "SABC public FTA · mangomolo CDN (geo-sensitive).",
    countries: ["za"],
    categories: [
      "General",
      "Africa",
      "Entertainment",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Geo",
    ],
    languages: ["en", "af"],
    poster: "https://i.imgur.com/rj6i9sn.png",
    backdrop: "https://i.imgur.com/rj6i9sn.png",
    license: "fta_public",
    isLive: true,
    featured: true,
    sources: [
      { url: SABC2, quality: "Auto", format: "hls", priority: 10, label: "mangomolo" },
    ],
  },
  {
    id: "curated-sabc3-za",
    slug: "sabc-3",
    title: "SABC 3",
    type: "live",
    description:
      "Regional channel · availability depends on the broadcaster and viewer location. If unavailable, open SABC News or LN24 separately.",
    countries: ["za"],
    categories: [
      "General",
      "Africa",
      "Entertainment",
      "Geo",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en"],
    poster: "https://i.imgur.com/Y8FK1Kk.png",
    backdrop: "https://i.imgur.com/Y8FK1Kk.png",
    license: "fta_public",
    isLive: true,
    featured: true,
    sources: [
      {
        url: SABC3,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "sabc3-mangomolo",
      },
      {
        url: SABC3_CHUNK,
        quality: "720p",
        format: "hls",
        priority: 20,
        label: "sabc3-chunk",
      },
    ],
  },
  {
    id: "curated-sabc-news-za",
    slug: "sabc-news",
    title: "SABC News",
    type: "live",
    description: "SABC News 24 · open mangomolo CDN.",
    countries: ["za"],
    categories: [
      "News",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Geo",
    ],
    languages: ["en"],
    poster: "https://i.imgur.com/liLta8j.png",
    backdrop: "https://i.imgur.com/liLta8j.png",
    license: "fta_public",
    isLive: true,
    featured: true,
    sources: [
      {
        url: SABC_NEWS,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "mangomolo",
      },
    ],
  },
  {
    id: "curated-ln24-za",
    slug: "ln24-sa",
    title: "LN24SA",
    type: "live",
    description: "South African news · open HLS.",
    countries: ["za"],
    categories: [
      "News",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
    ],
    languages: ["en"],
    poster: "https://i.imgur.com/Hg5YTwu.png",
    backdrop: "https://i.imgur.com/Hg5YTwu.png",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      { url: LN24, quality: "Auto", format: "hls", priority: 10, label: "primary" },
    ],
  },
  {
    id: "curated-za-news-pack",
    slug: "etv-news-za",
    title: "ZA News (open pack)",
    type: "live",
    description:
      "Hard note: e.tv / eNCA main linear is DRM / app-only — not available as open HLS. This tile is SABC News + LN24 only (honest open substitutes).",
    countries: ["za"],
    categories: [
      "News",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en"],
    poster: "https://i.imgur.com/lXMzsNM.png",
    backdrop: "https://i.imgur.com/lXMzsNM.png",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: SABC_NEWS,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "sabc-news",
      },
      {
        url: LN24,
        quality: "Auto",
        format: "hls",
        priority: 20,
        label: "ln24",
      },
    ],
  },
  {
    id: "curated-hope-africa",
    slug: "hope-channel-africa",
    title: "Hope Channel Africa",
    type: "live",
    description: "Religious · open stream listed for ZA.",
    countries: ["za"],
    categories: ["Religious", "Africa", "Playable", "Verified", "Curated"],
    languages: ["en"],
    poster: "https://i.imgur.com/Y8FK1Kk.png",
    backdrop: "https://i.imgur.com/Y8FK1Kk.png",
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: HOPE_AFRICA,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "jstream",
      },
    ],
  },
  {
    id: "curated-wildearth",
    slug: "wildearth",
    title: "WildEarth",
    type: "live",
    description: "Wildlife live · open FAST feed.",
    countries: ["za", "world"],
    categories: [
      "Documentary",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
    ],
    languages: ["en"],
    poster: "https://i.imgur.com/Y8FK1Kk.png",
    backdrop: "https://i.imgur.com/Y8FK1Kk.png",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [
      {
        url: WILDEARTH,
        quality: "Auto",
        format: "hls",
        priority: 10,
        label: "xumo",
      },
    ],
  },
  // —— Trace Music (Amagi FAST — Trace+ CDN often blocked / sticky proxy) ——
  {
    id: "curated-trace-urban-africa",
    slug: "trace-urban-africa",
    title: "Trace Urban Africa",
    type: "live",
    description: "Trace Urban · healed Amagi FAST mirrors (Trace+ CDN filtered on many networks).",
    countries: ["za", "world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en", "fr"],
    poster:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_URBAN],
  },
  {
    id: "curated-trace-africa",
    slug: "trace-africa",
    title: "Trace Africa",
    type: "live",
    description:
      "Trace Africa lineup · Amagi Urban + AfroBeats failover (Trace+ CDN blocked on many networks).",
    countries: ["za", "world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en", "fr"],
    poster:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_URBAN, AFROBEATS],
  },
  {
    id: "curated-trace-urban-international",
    slug: "trace-urban-international",
    title: "Trace Urban International",
    type: "live",
    description: "Trace Urban International · healed Amagi FAST mirrors.",
    countries: ["world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en"],
    poster:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_URBAN],
  },
  {
    id: "curated-trace-urban-france",
    slug: "trace-urban-france",
    title: "Trace Urban France",
    type: "live",
    description: "Trace Urban France · healed Amagi FAST mirrors.",
    countries: ["fr", "world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Curated",
      "Healed",
    ],
    languages: ["fr"],
    poster:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    sources: [...TRACE_URBAN],
  },
  {
    id: "curated-trace-mziki",
    slug: "trace-mziki",
    title: "Trace Mziki",
    type: "live",
    description:
      "Trace Mziki lineup · Amagi Urban + AfroBeats failover (Trace+ CDN blocked).",
    countries: ["ke", "tz", "ug", "world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en", "sw"],
    poster:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_URBAN, AFROBEATS],
  },
  {
    id: "curated-trace-latina",
    slug: "trace-latina",
    title: "Trace Latina",
    type: "live",
    description: "Trace Latina · healed Amagi FAST mirrors.",
    countries: ["world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Curated",
      "Healed",
    ],
    languages: ["es", "en"],
    poster:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    sources: [...TRACE_LATINA, ...TRACE_URBAN.slice(0, 1)],
  },
  {
    id: "curated-trace-ayiti",
    slug: "trace-ayiti",
    title: "Trace Ayiti",
    type: "live",
    description:
      "Trace Ayiti lineup · Brazuca + Urban Amagi failover (Trace+ CDN blocked).",
    countries: ["world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Curated",
      "Healed",
    ],
    languages: ["ht", "fr", "en"],
    poster:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    sources: [...TRACE_BRAZUCA, ...TRACE_URBAN.slice(0, 1)],
  },
  {
    id: "curated-trace-caribbean",
    slug: "trace-caribbean",
    title: "Trace Caribbean",
    type: "live",
    description:
      "Trace Caribbean lineup · Brazuca + Urban Amagi failover (Trace+ CDN blocked).",
    countries: ["world"],
    categories: [
      "Music",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en"],
    poster:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_BRAZUCA, ...TRACE_URBAN.slice(0, 1)],
  },
  {
    id: "curated-trace-gospel",
    slug: "trace-gospel",
    title: "Trace Gospel",
    type: "live",
    description:
      "Trace Gospel lineup · healed Amagi Urban failover (Trace+ Gospel CDN blocked).",
    countries: ["world", "za"],
    categories: [
      "Music",
      "Religious",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en"],
    poster:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_URBAN],
  },
  {
    id: "curated-tracegospel-fr-southernafrica",
    slug: "tracegospel-fr-southernafrica",
    title: "Trace Gospel Southern Africa",
    type: "live",
    description:
      "Trace Gospel Southern Africa · healed Amagi Urban FAST (Trace+ GOSPEL_SA CDN blocked).",
    countries: ["za", "fr", "world"],
    categories: [
      "Music",
      "Religious",
      "Africa",
      "Playable",
      "Verified",
      "Popular",
      "Curated",
      "Healed",
    ],
    languages: ["en", "fr"],
    poster:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: true,
    sources: [...TRACE_URBAN],
  },
  {
    id: "curated-tracegospel-fr-sd",
    slug: "tracegospel-fr-sd",
    title: "Trace Gospel Africa Franco",
    type: "live",
    description:
      "Trace Gospel Africa Franco · healed Amagi Urban FAST (Trace+ GOSPEL_FR CDN blocked).",
    countries: ["fr", "za", "world"],
    categories: [
      "Music",
      "Religious",
      "Africa",
      "Playable",
      "Verified",
      "Curated",
      "Healed",
    ],
    languages: ["fr", "en"],
    poster:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: false,
    sources: [...TRACE_URBAN],
  },
  {
    id: "curated-tracegospel-fr-nigeriaandeastafrica",
    slug: "tracegospel-fr-nigeriaandeastafrica",
    title: "Trace Gospel Nigeria and East Africa",
    type: "live",
    description:
      "Trace Gospel Nigeria & East Africa · healed Amagi Urban FAST (Trace+ GOSPEL_ROA CDN blocked).",
    countries: ["ng", "fr", "za", "world"],
    categories: [
      "Music",
      "Religious",
      "Africa",
      "Playable",
      "Verified",
      "Curated",
      "Healed",
    ],
    languages: ["en", "fr"],
    poster:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=1600&h=2400&q=92",
    backdrop:
      "https://images.unsplash.com/photo-1501618669935-18b6ecb13d6d?auto=format&fit=crop&w=3840&h=2160&q=92",
    license: "open_stream",
    isLive: true,
    featured: false,
    sources: [...TRACE_URBAN],
  },
];

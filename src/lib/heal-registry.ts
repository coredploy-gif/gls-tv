import type { MediaSource } from "@/data/types";
import overridesJson from "@/data/generated/channel-overrides.json";
import playableSportsJson from "@/data/generated/playable-sports.json";
import playableKidsJson from "@/data/generated/playable-kids.json";
import playableFoodJson from "@/data/generated/playable-food.json";
import playableFoodCompJson from "@/data/generated/playable-food-competitions.json";
import playableWrestlingJson from "@/data/generated/playable-wrestling.json";
import playableAfricaJson from "@/data/generated/playable-africa.json";
import playableAsiaJson from "@/data/generated/playable-asia.json";
import corsPlayableJson from "@/data/generated/cors-playable.json";

/**
 * System-wide channel heal registry.
 *
 * Prefer primary → known-good open FAST/FTA mirror → clear sister notice.
 * Never invent pirate pay-TV URLs — only curated / probed open feeds already
 * in playable JSON, overrides, or verified CDN rewrites below.
 *
 * Extend by:
 *  1. Adding a HEAL_BRANDS entry (slug/title regex → open mirrors)
 *  2. Adding a HOST_REWRITES rule (dead CDN host → known-good URL)
 *  3. Re-running `npm run heal` to refresh playable JSON (feeds VERIFIED_BY_SLUG)
 */

export const SISTER_FALLBACK_TAG = "SisterFallback";

type HealMirror = {
  url: string;
  label: string;
  priority?: number;
  quality?: string;
};

export type HealBrand = {
  id: string;
  note: string;
  match: (slug: string, title?: string | null) => boolean;
  mirrors: (slug: string, title?: string | null) => HealMirror[];
  /** When primary is remapped onto a sister network feed. */
  sisterNotice?: (slug: string, title?: string | null) => string | null;
};

export type HostRewrite = {
  id: string;
  note: string;
  test: (url: string) => boolean;
  /** Return replacement URL, or null to keep original (still flagged fragile). */
  rewrite?: (url: string) => string | null;
  fragile?: boolean;
};

const channelOverrides = overridesJson as Record<
  string,
  { title?: string; url?: string; note?: string }
>;

function hay(slug: string, title?: string | null) {
  return `${slug} ${title || ""}`.toLowerCase();
}

function m(
  url: string,
  label: string,
  priority = 5,
  quality = "Auto",
): HealMirror {
  return { url, label, priority, quality };
}

/**
 * Official France 24 Akamai live media playlists (HTTPS, relative segments, CORS *).
 * Do NOT use static.france24.com/live_web.m3u8 — that master points at cleartext
 * http://f24hls-i.akamaihd.net children and fails mixed-content in browsers.
 */
const F24_EN =
  "https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8";
const F24_EN_B =
  "https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_5000.m3u8";
const F24_FR =
  "https://live.france24.com/hls/live/2037179-b/F24_FR_HI_HLS/master_5000.m3u8";
const F24_FR_B =
  "https://live.france24.com/hls/live/2037179/F24_FR_HI_HLS/master_5000.m3u8";
const F24_AR =
  "https://live.france24.com/hls/live/2037222-b/F24_AR_HI_HLS/master_5000.m3u8";
const F24_AR_B =
  "https://live.france24.com/hls/live/2037222/F24_AR_HI_HLS/master_5000.m3u8";
const F24_ES =
  "https://live.france24.com/hls/live/2037220-b/F24_ES_HI_HLS/master_5000.m3u8";
const F24_ES_B =
  "https://live.france24.com/hls/live/2037220/F24_ES_HI_HLS/master_5000.m3u8";

const AJ_EN = "https://cdn-7.pishow.tv/live/429/master.m3u8";
const DW_EN =
  "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8";
const CGTN = "https://live.cgtn.com/1000e/prog_index.m3u8";
const FOX_WEATHER = "https://247wlive.foxweather.com/stream/index.m3u8";
const ACCUWEATHER_NOW =
  "https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00684-accuweather-accuweather-plex/playlist.m3u8";
const LIVENOW_FOX =
  "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00488-foxdigital-livenowbyfox-lgus/playlist.m3u8";
const RED_BULL =
  "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8";
const TENNIS =
  "https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg01444-tennischannelth-tennischannelnl-samsungnl/playlist.m3u8";
const BEIN_XTRA = "https://bein-xtra-bein.amagi.tv/playlist.m3u8";
const BEIN_XTRA_ES =
  "https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8";
const ESPN8 =
  "https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8";
const TSN_OCHO =
  "https://d3pnbvng3bx2nj.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-rds8g35qfqrnv/TSN_The_Ocho.m3u8";
const FUEL_AU =
  "https://amg01074-fueltv-fueltvau-samsungau-g09kq.amagi.tv/playlist/amg01074-fueltv-fueltvau-samsungau/playlist.m3u8";
const FUEL_EMEA =
  "https://amg01074-fueltv-fueltvemeaen-rakuten-b6j62.amagi.tv/hls/amagi_hls_data_rakutenAA-fueltvemeaen/CDN/master.m3u8";
const STADIUM =
  "https://wurl120sports.global.transmit.live/hls/679a907dce42a042c23ace37/v1/stadium_gracenote/samsung_us/latest/main/hls/playlist.m3u8";
const RALLY =
  "https://rally-tv-live.akamaized.net/hls/live/2117704/RallyTV-Pri/master.m3u8";
const WPT =
  "https://amg00477-samsungelectron-worldpokertour-samsunguk-81igb.amagi.tv/playlist/amg00477-samsungelectron-worldpokertour-samsunguk/playlist.m3u8";
const DRAFTKINGS =
  "https://na.linear.zype.com/e0bd0e23-a958-4e43-8164-4f2fef8876a8/fd3614bd-90bf-4530-a277-65ae3a1720c8-zype/live.m3u8";

/** Kids / cartoon open FAST mirrors — probed Amagi / Wurl / CloudFront only. */
const MR_BEAN_EN =
  "https://amg00627-amg00627c40-rakuten-uk-5725.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanpopupcc-rakutenuk/playlist.m3u8";
const MR_BEAN_FR =
  "https://amg00627-amg00627c31-rakuten-fr-3991.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanfrcc-rakutenfr/playlist.m3u8";
const MR_BEAN_IT =
  "https://amg00627-amg00627c29-rakuten-it-3989.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanitcc-rakutenit/playlist.m3u8";
const MR_BEAN_ES =
  "https://amg00627-amg00627c30-rakuten-es-3990.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanescc-rakutenes/playlist.m3u8";
const HAPPY_KIDS = "https://dil9xdvretp0f.cloudfront.net/index.m3u8";
const TOON_GOGGLES =
  "https://amg01329-otterainc-toongoggles-samsungau-ad-4c.amagi.tv/playlist/amg01329-otterainc-toongoggles-samsungau/playlist.m3u8";
const TG_JUNIOR =
  "https://d3i6upqaqzosi1.cloudfront.net/tg/jr_us/tg_jr_us.m3u8";
const NINJA_KIDZ = "https://d3868b4ny0rgdf.cloudfront.net/playlist.m3u8";
const LEGO_CHANNEL = "https://dltiqboxjw21d.cloudfront.net/index.m3u8";
const TELETUBBIES = "https://dv8lsrd8fecw9.cloudfront.net/master.m3u8";
const YUGIOH =
  "https://amg01796-amg01796c19-rakuten-gb-7486.playouts.now.amagi.tv/playlist/amg01796-fastmediafast-yugioh2en-rakutengb/playlist.m3u8";
const FILMRISE_ANIME = "https://dvu7aia8rjlfm.cloudfront.net/master.m3u8";
const KARTOON =
  "https://lightning-fnf-samsungaus.amagi.tv/playlist.m3u8";
const KETCHUP = "https://d24p9tv2w5yorn.cloudfront.net/vod.m3u8";
const MOONBUG = "https://moonbug-rokuus.amagi.tv/playlist.m3u8";
const RYAN_FRIENDS =
  "https://ryanandfriends-samsungau.amagi.tv/playlist.m3u8";
const ZOO_MOO = "https://zoomoo-samsungau.amagi.tv/playlist.m3u8";
const BABY_SHARK =
  "https://newidco-babysharktv-1-us.roku.wurl.tv/playlist.m3u8";
const BRAT_TV =
  "https://streams2.sofast.tv/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/04072b68-dc6a-4d5e-98af-f356ba8d5063/playlist.m3u8";
const KIKA =
  "https://kikahls.akamaized.net/hls/live/2022690/livetvkika_ww/master.m3u8";

const ALKASS: Record<string, string> = {
  one: "https://liveeu-gcp.alkassdigital.net/alkass1-p/main.m3u8",
  two: "https://liveeu-gcp.alkassdigital.net/alkass2-p/main.m3u8",
  three: "https://liveeu-gcp.alkassdigital.net/alkass3-p/main.m3u8",
  four: "https://liveeu-gcp.alkassdigital.net/alkass4-p/main.m3u8",
  five: "https://liveeu-gcp.alkassdigital.net/alkass5-p/main.m3u8",
  six: "https://liveeu-gcp.alkassdigital.net/alkass6-p/main.m3u8",
  seven: "https://liveeu-gcp.alkassdigital.net/alkass7-p/main.m3u8",
  shoof2: "https://liveeu-gcp.alkassdigital.net/shooflive2/main.m3u8",
  shoof: "https://liveeu-gcp.alkassdigital.net/shooflive/main.m3u8",
};

/** FIFA+ open Wurl/CloudFront feeds — URLs from playable-sports.json (probed). */
const FIFA_PLUS: Array<{ match: RegExp; url: string; label: string }> = [
  {
    match: /women/,
    url: "https://cffda8ff.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9GSUZBUGx1c3dvbWVuX0hMUw/playlist.m3u8",
    label: "heal-fifa-women",
  },
  {
    match: /french|france/,
    url: "https://37b4c228.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWZyX0ZJRkFQbHVzRnJlbmNoX0hMUw/playlist.m3u8",
    label: "heal-fifa-french",
  },
  {
    match: /german/,
    url: "https://4397879b.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw/playlist.m3u8",
    label: "heal-fifa-german",
  },
  {
    match: /hispanic/,
    url: "https://6c849fb3.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctbXhfRklGQVBsdXNTcGFuaXNoLTFfSExT/playlist.m3u8",
    label: "heal-fifa-hispanic",
  },
  {
    match: /ital/,
    url: "https://5d95f7d7.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWl0X0ZJRkFQbHVzSXRhbGlhbl9ITFM/playlist.m3u8",
    label: "heal-fifa-italy",
  },
  {
    match: /portug/,
    url: "https://e3be9ac5.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctYnJfRklGQVBsdXNQb3J0dWd1ZXNlX0hMUw/playlist.m3u8",
    label: "heal-fifa-portuguese",
  },
  {
    match: /spain|spanish/,
    url: "https://d63fabad.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWVzX0ZJRkFQbHVzU3BhbmlzaF9ITFM/playlist.m3u8",
    label: "heal-fifa-spain",
  },
  {
    match: /united.?states|usa|\bus\b/,
    url: "https://d2w9q46ikgrcwx.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-of5cbk3sav3w5/v1/sysdata_s_p_a_fifa_7/samsungheadend_us/latest/main/hls/playlist.m3u8",
    label: "heal-fifa-us",
  },
];

function alkassMirror(slug: string, title?: string | null): HealMirror[] {
  const h = hay(slug, title);
  if (/shoof\s*2|shoof2/.test(h)) return [m(ALKASS.shoof2!, "heal-alkass-shoof2")];
  if (/shoof/.test(h)) return [m(ALKASS.shoof!, "heal-alkass-shoof")];
  if (/\b7\b|seven/.test(h)) return [m(ALKASS.seven!, "heal-alkass-7")];
  if (/\b6\b|six/.test(h)) return [m(ALKASS.six!, "heal-alkass-6")];
  if (/\b5\b|five/.test(h)) return [m(ALKASS.five!, "heal-alkass-5")];
  if (/\b4\b|four/.test(h)) return [m(ALKASS.four!, "heal-alkass-4")];
  if (/\b3\b|three/.test(h)) return [m(ALKASS.three!, "heal-alkass-3")];
  if (/\b2\b|two/.test(h)) return [m(ALKASS.two!, "heal-alkass-2")];
  if (/\b1\b|one/.test(h)) return [m(ALKASS.one!, "heal-alkass-1")];
  return [m(ALKASS.one!, "heal-alkass-1")];
}

function france24Mirror(slug: string, title?: string | null): HealMirror[] {
  const h = hay(slug, title);
  if (/arabic|arabe|(?:^|[\s_-])ar(?:[\s_-]|$)/.test(h))
    return [
      m(F24_AR, "heal-france24-ar"),
      m(F24_AR_B, "heal-france24-ar-alt", 12),
    ];
  if (/spanish|espa[nñ]ol|espanol|(?:^|[\s_-])es(?:[\s_-]|$)/.test(h))
    return [
      m(F24_ES, "heal-france24-es"),
      m(F24_ES_B, "heal-france24-es-alt", 12),
    ];
  if (
    /french|fran[cç]ais|francais|(?:^|[\s_-])fr(?:[\s_-]|$)/.test(h) &&
    !/english|fast/.test(h)
  ) {
    return [
      m(F24_FR, "heal-france24-fr"),
      m(F24_FR_B, "heal-france24-fr-alt", 12),
    ];
  }
  return [
    m(F24_EN, "heal-france24-en"),
    m(F24_EN_B, "heal-france24-en-alt", 12),
  ];
}

function fifaMirror(slug: string, title?: string | null): HealMirror[] {
  const h = hay(slug, title);
  for (const row of FIFA_PLUS) {
    if (row.match.test(h)) return [m(row.url, row.label)];
  }
  return [m(FIFA_PLUS[FIFA_PLUS.length - 1]!.url, "heal-fifa-us")];
}

function mrBeanMirror(slug: string, title?: string | null): HealMirror[] {
  const h = hay(slug, title);
  if (/live.?action|popup/.test(h)) return [m(MR_BEAN_EN, "heal-mrbean-live")];
  if (/(?:^|[\s_-])fr(?:[\s_-]|$)|fran[cç]ais|anime.?fr/.test(h))
    return [m(MR_BEAN_FR, "heal-mrbean-fr")];
  if (/(?:^|[\s_-])it(?:[\s_-]|$)|ital/.test(h))
    return [m(MR_BEAN_IT, "heal-mrbean-it")];
  if (/(?:^|[\s_-])es(?:[\s_-]|$)|spain|espa[nñ]ol/.test(h))
    return [m(MR_BEAN_ES, "heal-mrbean-es")];
  return [m(MR_BEAN_EN, "heal-mrbean-en")];
}

/**
 * Brand / network families healed by slug+title match.
 * Trace stays in `trace-mirrors.ts` (regional Urban sister UX).
 */
export const HEAL_BRANDS: HealBrand[] = [
  {
    id: "france24",
    note: "France 24 live Akamai media playlists (HTTPS; avoid static HTTP children)",
    match: (slug, title) => /france[\s_-]?24/.test(hay(slug, title)),
    mirrors: france24Mirror,
  },
  {
    id: "trt-world",
    note: "TRT World official medya.trt.com.tr public master",
    match: (slug, title) => /trt[\s_-]?world/.test(hay(slug, title)),
    mirrors: () => [
      m(
        "https://tv-trtworld.medya.trt.com.tr/master_1080.m3u8",
        "heal-trt-world",
      ),
      m(
        "https://tv-trtworld.medya.trt.com.tr/master.m3u8",
        "heal-trt-world-alt",
        12,
      ),
    ],
  },
  {
    id: "trt-haber",
    note: "TRT Haber official medya.trt.com.tr public master",
    match: (slug, title) => /trt[\s_-]?haber/.test(hay(slug, title)),
    mirrors: () => [
      m(
        "https://tv-trthaber.medya.trt.com.tr/master_1080.m3u8",
        "heal-trt-haber",
      ),
    ],
  },
  {
    id: "al-arabiya",
    note: "Al Arabiya Dubai official publish CDN",
    match: (slug, title) => {
      const h = hay(slug, title);
      return /al[\s_-]?arabiya/.test(h) && !/business|hadath|aswaaq/.test(h);
    },
    mirrors: () => [
      m(
        "https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8",
        "heal-al-arabiya",
      ),
    ],
  },
  {
    id: "al-jazeera-en",
    note: "Al Jazeera English open pishow FAST (not Arabic remaps)",
    match: (slug, title) => {
      const h = hay(slug, title);
      return /al[\s_-]?jazeera/.test(h) && /english|en\b/.test(h);
    },
    mirrors: () => [m(AJ_EN, "heal-al-jazeera-en")],
  },
  {
    id: "dw-english",
    note: "Deutsche Welle English Akamai",
    match: (slug, title) =>
      /deutsche.?welle|dw[\s_-]?english|dwenglish|(?:^|[\s_-])dw(?:[\s_-]english|\b)/.test(
        hay(slug, title),
      ),
    mirrors: () => [m(DW_EN, "heal-dw-english")],
  },
  {
    id: "cgtn-en",
    note: "CGTN English official live CDN",
    match: (slug, title) => {
      const h = hay(slug, title);
      return (
        /\bcgtn\b/.test(h) &&
        !/arabic|espa[nñ]ol|french|fran[cç]ais|russian|documentary|global.?biz/.test(
          h,
        )
      );
    },
    mirrors: () => [m(CGTN, "heal-cgtn")],
  },
  {
    id: "fox-weather",
    note: "Official Fox Weather HLS (xumo Amagi often degraded)",
    match: (slug, title) => /fox[\s_-]?weather/.test(hay(slug, title)),
    mirrors: () => [m(FOX_WEATHER, "heal-fox-weather")],
  },
  {
    id: "accuweather",
    note: "AccuWeather Now Amagi; Network raw-IP remaps onto Now",
    match: (slug, title) => /accuweather/.test(hay(slug, title)),
    mirrors: () => [m(ACCUWEATHER_NOW, "heal-accuweather-now")],
    sisterNotice: (slug, title) => {
      const h = hay(slug, title);
      if (/accuweather[\s_-]?now/.test(h)) return null;
      return "Switching to AccuWeather Now — AccuWeather Network feed unavailable";
    },
  },
  {
    id: "livenow-fox",
    note: "LiveNOW from FOX Amagi (not FS1/FS2)",
    match: (slug, title) => {
      const h = hay(slug, title);
      if (/fox\s*sports?\s*[12]\b|foxsports[12]/.test(h)) return false;
      return /livenow|live[\s_-]?now[\s_-]?from[\s_-]?fox/.test(h);
    },
    mirrors: () => [
      m(LIVENOW_FOX, "heal-livenow-fox"),
      m("https://fox-foxnewsnow-vizio.amagi.tv/playlist.m3u8", "heal-livenow-vizio", 12),
    ],
  },
  {
    id: "red-bull",
    note: "Red Bull TV official Akamai (prefer over mediatailor/wurl variants)",
    match: (slug, title) => /red[\s_-]?bull/.test(hay(slug, title)),
    mirrors: () => [m(RED_BULL, "heal-red-bull")],
  },
  {
    id: "tennis-channel",
    note: "Tennis Channel Amagi FAST",
    match: (slug, title) => {
      const h = hay(slug, title);
      if (/t2[\s_-]?tennis|tennis[\s_-]?channel[\s_-]?2/.test(h)) return false;
      return /tennis[\s_-]?channel/.test(h);
    },
    mirrors: () => [m(TENNIS, "heal-tennis-channel")],
  },
  {
    id: "bein-xtra",
    note: "beIN XTRA open Amagi / CloudFront Español",
    match: (slug, title) => {
      const h = hay(slug, title);
      if (!/bein/.test(h)) return false;
      return /xtra|extra/.test(h) || /beinsportsusa|bein[\s_-]?sports[\s_-]?usa\b/.test(h);
    },
    mirrors: (slug, title) => {
      const h = hay(slug, title);
      if (/espa[nñ]ol|espanol|spanish/.test(h))
        return [m(BEIN_XTRA_ES, "heal-bein-xtra-es")];
      return [m(BEIN_XTRA, "heal-bein-xtra")];
    },
    sisterNotice: (slug, title) => {
      const h = hay(slug, title);
      if (/xtra|extra/.test(h)) return null;
      if (/beinsportsusa|bein[\s_-]?sports[\s_-]?usa\b/.test(h)) {
        return "Switching to beIN SPORTS XTRA — beIN Sports USA open feed unavailable";
      }
      return null;
    },
  },
  {
    id: "espn8-ocho",
    note: "ESPN8 The Ocho CloudFront FAST only",
    match: (slug, title) => {
      const h = hay(slug, title);
      return /espn[\s_-]?8|espn8|the[\s_-]?ocho/.test(h) && /espn/.test(h);
    },
    mirrors: () => [m(ESPN8, "heal-espn8-ocho")],
  },
  {
    id: "tsn-ocho",
    note: "TSN The Ocho CloudFront FAST only",
    match: (slug, title) => /tsn[\s_-]?the[\s_-]?ocho|tsntheocho/.test(hay(slug, title)),
    mirrors: () => [m(TSN_OCHO, "heal-tsn-ocho")],
  },
  {
    id: "alkass",
    note: "Alkass official GCP HLS family",
    match: (slug, title) => /alkass/.test(hay(slug, title)),
    mirrors: alkassMirror,
  },
  {
    id: "fifa-plus",
    note: "FIFA+ open Wurl / CloudFront language feeds",
    match: (slug, title) => /fifa\+|fifaplus|fifa[\s_-]?plus/.test(hay(slug, title)),
    mirrors: fifaMirror,
  },
  {
    id: "fuel-tv",
    note: "Fuel TV Amagi AU/EMEA",
    match: (slug, title) => /fuel[\s_-]?tv/.test(hay(slug, title)),
    mirrors: (slug, title) => {
      const h = hay(slug, title);
      if (/\bau\b|australia/.test(h)) return [m(FUEL_AU, "heal-fuel-au")];
      return [
        m(FUEL_EMEA, "heal-fuel-emea"),
        m(FUEL_AU, "heal-fuel-au", 12),
      ];
    },
  },
  {
    id: "stadium",
    note: "Stadium sports FAST",
    match: (slug, title) => {
      const h = hay(slug, title);
      return /\bstadium\b/.test(h) && !/world.?stadium|stadium.?of/.test(h);
    },
    mirrors: () => [m(STADIUM, "heal-stadium")],
  },
  {
    id: "rally-tv",
    note: "Rally TV Akamai",
    match: (slug, title) => /rally[\s_-]?tv/.test(hay(slug, title)),
    mirrors: () => [m(RALLY, "heal-rally-tv")],
  },
  {
    id: "world-poker-tour",
    note: "World Poker Tour Amagi (prefer over jmp2 Pluto when branded WPT)",
    match: (slug, title) => /world[\s_-]?poker[\s_-]?tour|\bwpt\b/.test(hay(slug, title)),
    mirrors: () => [m(WPT, "heal-wpt")],
  },
  {
    id: "draftkings",
    note: "DraftKings Network Zype linear",
    match: (slug, title) => /draft.?kings/.test(hay(slug, title)),
    mirrors: () => [m(DRAFTKINGS, "heal-draftkings")],
  },
  // —— Kids / cartoon FAST families (playable-kids + cors-probed) ——
  {
    id: "mr-bean",
    note: "Banijay Mr Bean Amagi FAST language packs",
    match: (slug, title) => /mr[\s_-]?bean/.test(hay(slug, title)),
    mirrors: mrBeanMirror,
  },
  {
    id: "happykids",
    note: "HappyKids CloudFront FAST",
    match: (slug, title) => /happy[\s_-]?kids/.test(hay(slug, title)),
    mirrors: () => [m(HAPPY_KIDS, "heal-happykids")],
  },
  {
    id: "toongoggles",
    note: "ToonGoggles / TG Junior Amagi + CloudFront",
    match: (slug, title) => {
      const h = hay(slug, title);
      return /toon[\s_-]?goggles|tg[\s_-]?junior|tgjunior/.test(h);
    },
    mirrors: (slug, title) => {
      const h = hay(slug, title);
      if (/junior|tgjunior|tg[\s_-]?jr/.test(h))
        return [m(TG_JUNIOR, "heal-tg-junior")];
      return [m(TOON_GOGGLES, "heal-toongoggles")];
    },
  },
  {
    id: "ninja-kidz",
    note: "Ninja Kidz CloudFront FAST",
    match: (slug, title) => /ninja[\s_-]?kidz/.test(hay(slug, title)),
    mirrors: () => [m(NINJA_KIDZ, "heal-ninja-kidz")],
  },
  {
    id: "lego-channel",
    note: "LEGO Channel CloudFront FAST",
    match: (slug, title) => /lego[\s_-]?channel|legochannel/.test(hay(slug, title)),
    mirrors: () => [m(LEGO_CHANNEL, "heal-lego")],
  },
  {
    id: "teletubbies",
    note: "Teletubbies CloudFront FAST",
    match: (slug, title) => /teletubbies/.test(hay(slug, title)),
    mirrors: () => [m(TELETUBBIES, "heal-teletubbies")],
  },
  {
    id: "yugioh",
    note: "Yu-Gi-Oh! Amagi FAST English",
    match: (slug, title) => /yu[\s_-]?gi[\s_-]?oh|yugioh/.test(hay(slug, title)),
    mirrors: () => [m(YUGIOH, "heal-yugioh")],
  },
  {
    id: "filmrise-anime",
    note: "FilmRise Anime CloudFront FAST",
    match: (slug, title) => /filmrise[\s_-]?anime/.test(hay(slug, title)),
    mirrors: () => [m(FILMRISE_ANIME, "heal-filmrise-anime")],
  },
  {
    id: "kartoon-channel",
    note: "Kartoon Channel Amagi FAST",
    match: (slug, title) => /kartoon/.test(hay(slug, title)),
    mirrors: () => [m(KARTOON, "heal-kartoon")],
  },
  {
    id: "ketchup-tv",
    note: "Ketchup TV CloudFront FAST",
    match: (slug, title) => /ketchup[\s_-]?tv/.test(hay(slug, title)),
    mirrors: () => [m(KETCHUP, "heal-ketchup")],
  },
  {
    id: "moonbug",
    note: "Moonbug Kids Amagi FAST",
    match: (slug, title) => /moonbug/.test(hay(slug, title)),
    mirrors: () => [m(MOONBUG, "heal-moonbug")],
  },
  {
    id: "ryan-and-friends",
    note: "Ryan and Friends Amagi FAST",
    match: (slug, title) => /ryan[\s_-]?and[\s_-]?friends|ryanandfriends/.test(hay(slug, title)),
    mirrors: () => [m(RYAN_FRIENDS, "heal-ryan-friends")],
  },
  {
    id: "zoo-moo",
    note: "Zoo Moo Amagi FAST",
    match: (slug, title) => /zoo[\s_-]?moo|zoomoo/.test(hay(slug, title)),
    mirrors: () => [m(ZOO_MOO, "heal-zoomoo")],
  },
  {
    id: "baby-shark",
    note: "Baby Shark TV Wurl FAST",
    match: (slug, title) => /baby[\s_-]?shark/.test(hay(slug, title)),
    mirrors: () => [m(BABY_SHARK, "heal-baby-shark")],
  },
  {
    id: "brat-tv",
    note: "Brat TV Sofast FAST",
    match: (slug, title) => /\bbrat[\s_-]?tv\b/.test(hay(slug, title)),
    mirrors: () => [m(BRAT_TV, "heal-brat-tv")],
  },
  {
    id: "kika",
    note: "KiKA Akamai (DE kids public)",
    match: (slug, title) => /\bkika\b/.test(hay(slug, title)),
    mirrors: () => [m(KIKA, "heal-kika")],
  },
];

/** CDN host rewrites that fix many rows without per-slug ifs. */
export const HOST_REWRITES: HostRewrite[] = [
  {
    id: "france24-static-to-live",
    note: "static.france24.com live_web (HTTP Akamai children) → live HTTPS media",
    test: (url) => /static\.france24\.com/i.test(url),
    rewrite: (url) => {
      if (/F24_AR/i.test(url)) return F24_AR;
      if (/F24_ES/i.test(url)) return F24_ES;
      if (/F24_FR/i.test(url)) return F24_FR;
      if (/F24_EN/i.test(url)) return F24_EN;
      return F24_EN;
    },
    fragile: true,
  },
  {
    id: "fox-weather-xumo",
    note: "foxweather-xumo.amagi → official 247wlive",
    test: (url) => /foxweather-xumo\.amagi\.tv/i.test(url),
    rewrite: () => FOX_WEATHER,
    fragile: true,
  },
  {
    id: "al-jazeera-getaj-en",
    note: "getaj AJE → pishow English",
    test: (url) => /getaj\.net\/AJE\b/i.test(url),
    rewrite: () => AJ_EN,
    fragile: true,
  },
  {
    id: "trace-encrypted-ads",
    note: "Trace encrypted.m3u8?ads CloudFront is dead",
    test: (url) => /encrypted\.m3u8\?ads/i.test(url),
    fragile: true,
  },
  {
    id: "fragile-hosts",
    note: "Known sticky / geo-fragile / pirate restream hosts",
    test: (url) =>
      /channels\.trace\.plus|blocked\.grouptag|streamvidex|qzz\.io|live20\.bozztv\.com|nghk\.ai|sinalmycn\.com|lb\.dstvmultimedia\.com|getaj\.net|thehlive\.com/i.test(
        url,
      ),
    fragile: true,
  },
];

/** Build verified slug → URL from playable packs + overrides (probe-backed). */
function buildVerifiedBySlug(): Map<string, { url: string; label: string }> {
  const map = new Map<string, { url: string; label: string }>();
  const packs = [
    playableSportsJson,
    playableKidsJson,
    playableFoodJson,
    playableFoodCompJson,
    playableWrestlingJson,
    playableAfricaJson,
    playableAsiaJson,
  ] as { slug?: string; sources?: { url?: string }[] }[][];

  for (const pack of packs) {
    for (const item of pack) {
      const slug = item.slug?.trim();
      const url = item.sources?.[0]?.url?.trim();
      if (!slug || !url || !/^https:\/\//i.test(url)) continue;
      if (!map.has(slug)) {
        map.set(slug, { url, label: `heal-playable-${slug}` });
      }
    }
  }

  // CORS-probed kids/family rows (Baby Shark, Brat TV, …) not always in playable-kids
  const corsBuckets = corsPlayableJson as Record<
    string,
    { slug?: string; url?: string }[]
  >;
  for (const bucket of Object.values(corsBuckets)) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const slug = item.slug?.trim();
      const url = item.url?.trim();
      if (!slug || !url || !/^https:\/\//i.test(url)) continue;
      if (!map.has(slug)) {
        map.set(slug, { url, label: `heal-cors-${slug}` });
      }
    }
  }

  for (const [slug, row] of Object.entries(channelOverrides)) {
    const url = row.url?.trim();
    if (!url || !/^https:\/\//i.test(url)) continue;
    map.set(slug, { url, label: `heal-override-${slug}` });
  }

  return map;
}

export const VERIFIED_BY_SLUG = buildVerifiedBySlug();

export function verifiedHealUrl(slug: string): string | null {
  return VERIFIED_BY_SLUG.get(slug)?.url ?? null;
}

export function brandHealPack(
  slug: string,
  title?: string | null,
): { sources: MediaSource[]; tags: string[]; notice: string | null } | null {
  for (const brand of HEAL_BRANDS) {
    if (!brand.match(slug, title)) continue;
    const mirrors = brand.mirrors(slug, title);
    if (!mirrors.length) continue;
    const notice = brand.sisterNotice?.(slug, title) ?? null;
    const tags = ["Healed", "Playable"];
    if (notice) tags.push(SISTER_FALLBACK_TAG);
    return {
      sources: mirrors.map((x) => ({
        url: x.url,
        quality: x.quality || "Auto",
        format: "hls" as const,
        priority: x.priority ?? 5,
        label: x.label,
      })),
      tags,
      notice,
    };
  }
  return null;
}

export function verifiedSlugPack(slug: string): MediaSource[] | null {
  const hit = VERIFIED_BY_SLUG.get(slug);
  if (!hit) return null;
  return [
    {
      url: hit.url,
      quality: "Auto",
      format: "hls",
      priority: 4,
      label: hit.label,
    },
  ];
}

/** Apply host rewrites; returns rewritten sources + whether any were fragile.
 * Prefer rewritten URLs first; keep originals as demoted last-resort mirrors.
 */
export function applyHostRewrites(sources: MediaSource[]): {
  sources: MediaSource[];
  rewritten: number;
  fragileHits: number;
} {
  let rewritten = 0;
  let fragileHits = 0;
  const preferred: MediaSource[] = [];
  const demoted: MediaSource[] = [];
  const seen = new Set<string>();

  const push = (list: MediaSource[], s: MediaSource) => {
    if (!s.url || seen.has(s.url)) return;
    seen.add(s.url);
    list.push(s);
  };

  for (const s of sources) {
    let url = s.url;
    let label = s.label;
    let didRewrite = false;
    const originalUrl = s.url;

    for (const rule of HOST_REWRITES) {
      if (!rule.test(url)) continue;
      if (rule.fragile) fragileHits += 1;
      if (rule.rewrite) {
        const next = rule.rewrite(url);
        if (next && next !== url) {
          url = next;
          label = `heal-host-${rule.id}`;
          didRewrite = true;
          rewritten += 1;
        }
      }
    }

    if (didRewrite) {
      push(preferred, { ...s, url, label, priority: Math.min(s.priority ?? 10, 8) });
      push(demoted, {
        ...s,
        url: originalUrl,
        priority: (s.priority ?? 100) + 900,
        label: s.label || "fragile-fallback",
      });
    } else {
      push(preferred, { ...s, url, label });
    }
  }

  return {
    sources: [...preferred, ...demoted],
    rewritten,
    fragileHits,
  };
}

export function isRegistryFragileHost(url: string): boolean {
  return HOST_REWRITES.some((r) => r.fragile && r.test(url));
}

export function hasSisterFallbackTag(
  categories: string[] | null | undefined,
): boolean {
  return Boolean(categories?.some((c) => c === SISTER_FALLBACK_TAG));
}

/** Ops / tests: which brand would heal this slug. */
export function matchHealBrandId(
  slug: string,
  title?: string | null,
): string | null {
  return HEAL_BRANDS.find((b) => b.match(slug, title))?.id ?? null;
}

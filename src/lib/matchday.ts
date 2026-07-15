import type { CatalogItem } from "@/data/types";
import { getSportsChannels, getWrestlingChannels } from "@/lib/channels";

export type MatchSport =
  | "soccer"
  | "tennis"
  | "cricket"
  | "rugby"
  | "basketball"
  | "golf"
  | "mma"
  | "baseball"
  | "american-football"
  | "hockey"
  | "other";

export type MatchItem = {
  id: string;
  sport: MatchSport;
  sportLabel: string;
  league: string;
  title: string;
  status: "live" | "upcoming" | "final" | "unknown";
  statusText: string;
  /** ISO-8601 UTC instant when known */
  startsAt?: string;
  /** Human date in viewer TZ — e.g. Tue, 14 Jul 2026 */
  kickoffDate?: string;
  /** Human time in viewer TZ — e.g. 21:00 */
  kickoffTime?: string;
  /** Timezone short name — e.g. SAST */
  kickoffTz?: string;
  /** Relative hint — e.g. Starts in 2h 15m · Live now */
  whenHint?: string;
  home?: string;
  away?: string;
  score?: string;
  source: "espn" | "thesportsdb";
  /** High-confidence open channel tip (verified FAST / playable pack). */
  watchSlug?: string;
  watchTitle?: string;
  watchHint?: string;
  watchConfidence?: "high" | "medium";
};

/** Viewer TZ — SADC-friendly default; override via ?tz= */
export const DEFAULT_MATCHDAY_TZ = "Africa/Johannesburg";

const ESPN_BOARDS: {
  sport: MatchSport;
  label: string;
  path: string;
}[] = [
  { sport: "soccer", label: "Soccer", path: "soccer/eng.1/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/esp.1/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/ger.1/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/ita.1/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/fra.1/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/uefa.champions/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/uefa.europa/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/usa.1/scoreboard" },
  { sport: "soccer", label: "Soccer", path: "soccer/fifa.world/scoreboard" },
  { sport: "basketball", label: "Basketball", path: "basketball/nba/scoreboard" },
  { sport: "basketball", label: "Basketball", path: "basketball/wnba/scoreboard" },
  { sport: "tennis", label: "Tennis", path: "tennis/atp/scoreboard" },
  { sport: "tennis", label: "Tennis", path: "tennis/wta/scoreboard" },
  { sport: "golf", label: "Golf", path: "golf/pga/scoreboard" },
  { sport: "mma", label: "MMA", path: "mma/ufc/scoreboard" },
  {
    sport: "american-football",
    label: "American Football",
    path: "football/nfl/scoreboard",
  },
  { sport: "baseball", label: "Baseball", path: "baseball/mlb/scoreboard" },
  { sport: "hockey", label: "Hockey", path: "hockey/nhl/scoreboard" },
];

const TSDB_SPORTS: { sport: MatchSport; label: string; query: string }[] = [
  { sport: "cricket", label: "Cricket", query: "Cricket" },
  { sport: "rugby", label: "Rugby", query: "Rugby" },
];

/**
 * Prefer curated open FAST / verified playable packs — not IP pay restreams.
 * Order = preference. Only high-confidence tips surface as “watch this”.
 */
const CURATED_WATCH: Record<
  MatchSport,
  { slugs: string[]; hint: string; keywords: RegExp }
> = {
  soccer: {
    slugs: [
      "beinsportsxtra-us-sd",
      "beinsportsxtraenespanol-us-sd",
      "stadium-us-sd",
      "espn8-the-ocho",
      "espn8theocho-us-espn8theochohd",
    ],
    hint: "Open soccer FAST (not pay linear)",
    keywords: /bein|stadium|soccer|football|espn.?8|ocho/i,
  },
  tennis: {
    slugs: ["tennischannel-us-sd"],
    hint: "Tennis Channel · open stream",
    keywords: /tennis/i,
  },
  cricket: {
    slugs: ["stadium-us-sd", "red-bull-tv"],
    hint: "Related open sports channel",
    keywords: /cricket|stadium|sport/i,
  },
  rugby: {
    slugs: ["stadium-us-sd", "red-bull-tv"],
    hint: "Related open sports channel",
    keywords: /rugby|stadium|sport/i,
  },
  basketball: {
    slugs: ["stadium-us-sd", "espn8-the-ocho", "espn8theocho-us-espn8theochohd"],
    hint: "Open sports FAST while tip-off runs",
    keywords: /stadium|nba|basket|espn.?8|ocho/i,
  },
  golf: {
    slugs: ["red-bull-tv", "stadium-us-sd"],
    hint: "Open sports companion stream",
    keywords: /golf|stadium|red.?bull/i,
  },
  mma: {
    slugs: ["red-bull-tv", "stadium-us-sd"],
    hint: "Open fight / sports FAST",
    keywords: /mma|ufc|fight|wrestling|red.?bull|stadium/i,
  },
  baseball: {
    slugs: ["stadium-us-sd", "livenow-from-fox"],
    hint: "Open sports / LiveNOW FAST",
    keywords: /stadium|baseball|mlb|livenow|fox/i,
  },
  "american-football": {
    slugs: ["stadium-us-sd", "espn8-the-ocho", "livenow-from-fox"],
    hint: "Open sports FAST (not NFL Network pay)",
    keywords: /stadium|espn.?8|ocho|livenow|nfl/i,
  },
  hockey: {
    slugs: ["stadium-us-sd", "tsntheocho-ca-sd", "espn8-the-ocho"],
    hint: "Open sports FAST",
    keywords: /stadium|hockey|nhl|ocho|tsn/i,
  },
  other: {
    slugs: ["red-bull-tv", "stadium-us-sd"],
    hint: "Verified open sports channel",
    keywords: /sport|stadium|red.?bull/i,
  },
};

function catalogBySlug() {
  const map = new Map<string, CatalogItem>();
  for (const c of [...getSportsChannels(), ...getWrestlingChannels()]) {
    map.set(c.slug, c);
  }
  return map;
}

function isVerifiedOpen(c: CatalogItem) {
  return (
    (c.categories.includes("Playable") || c.categories.includes("Verified")) &&
    c.sources.some((s) => /^https:\/\//i.test(s.url))
  );
}

function pickWatchTip(sport: MatchSport): {
  slug: string;
  title: string;
  hint: string;
  confidence: "high" | "medium";
} | null {
  const curated = CURATED_WATCH[sport];
  const bySlug = catalogBySlug();

  for (const slug of curated.slugs) {
    const c = bySlug.get(slug);
    if (c && isVerifiedOpen(c)) {
      return {
        slug: c.slug,
        title: c.title,
        hint: curated.hint,
        confidence: "high",
      };
    }
  }

  const pool =
    sport === "mma"
      ? [...getWrestlingChannels(), ...getSportsChannels()]
      : getSportsChannels();
  const ranked = pool
    .filter(isVerifiedOpen)
    .map((c) => {
      const hay = `${c.title} ${c.categories.join(" ")}`;
      let score = 0;
      if (curated.keywords.test(hay)) score += 12;
      if (c.categories.includes("Playable")) score += 6;
      if (c.categories.includes("Verified")) score += 4;
      if (c.categories.includes("Popular")) score += 2;
      if (c.sources.some((s) => /amagi|cloudfront|akamai/i.test(s.url)))
        score += 3;
      return { c, score };
    })
    .filter((x) => x.score >= 12)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.c;
  if (!best) return null;
  return {
    slug: best.slug,
    title: best.title,
    hint: curated.hint,
    confidence: ranked[0].score >= 18 ? "high" : "medium",
  };
}

function calendarDayInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatKickoff(iso: string | undefined, timeZone: string) {
  if (!iso) {
    return {
      kickoffDate: undefined as string | undefined,
      kickoffTime: undefined as string | undefined,
      kickoffTz: undefined as string | undefined,
      whenHint: undefined as string | undefined,
    };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      kickoffDate: undefined,
      kickoffTime: undefined,
      kickoffTz: undefined,
      whenHint: undefined,
    };
  }

  const kickoffDate = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);

  const kickoffTime = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  const kickoffTz =
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value || timeZone;

  const now = Date.now();
  const diffMin = Math.round((d.getTime() - now) / 60000);
  let whenHint: string | undefined;
  if (diffMin <= -180) whenHint = undefined;
  else if (diffMin <= 0) whenHint = "Live window";
  else if (diffMin < 60) whenHint = `Starts in ${diffMin} min`;
  else if (diffMin < 24 * 60) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    whenHint = m ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`;
  } else whenHint = kickoffDate;

  return { kickoffDate, kickoffTime, kickoffTz, whenHint };
}

function refineStatus(
  status: MatchItem["status"],
  startsAt?: string,
): MatchItem["status"] {
  if (!startsAt || status === "live" || status === "final") return status;
  const t = new Date(startsAt).getTime();
  if (Number.isNaN(t)) return status;
  const now = Date.now();
  if (t <= now && now - t < 3.5 * 3600_000) return "live";
  if (t > now) return "upcoming";
  return status;
}

function attachWatch(
  m: MatchItem,
  tip: ReturnType<typeof pickWatchTip>,
): MatchItem {
  if (!tip || tip.confidence !== "high") return m;
  return {
    ...m,
    watchSlug: tip.slug,
    watchTitle: tip.title,
    watchHint: tip.hint,
    watchConfidence: tip.confidence,
  };
}

function espnStatus(state?: string): MatchItem["status"] {
  const s = (state || "").toLowerCase();
  if (s === "in" || s.includes("live")) return "live";
  if (s === "pre") return "upcoming";
  if (s === "post") return "final";
  return "unknown";
}

type EspnEvent = {
  id: string;
  name?: string;
  shortName?: string;
  date?: string;
  status?: {
    type?: { state?: string; description?: string; shortDetail?: string };
  };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: { displayName?: string; shortDisplayName?: string };
    }>;
    status?: {
      type?: { state?: string; description?: string; shortDetail?: string };
    };
  }>;
};

async function fetchEspn(
  path: string,
  sport: MatchSport,
  label: string,
  day: string,
  timeZone: string,
  tip: ReturnType<typeof pickWatchTip>,
): Promise<MatchItem[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 180 },
      headers: { "User-Agent": "GLS-TV/1.0 (matchday)" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      events?: EspnEvent[];
      leagues?: Array<{ name?: string }>;
    };
    const league = data.leagues?.[0]?.name || label;
    const out: MatchItem[] = [];

    for (const ev of data.events || []) {
      if (ev.date) {
        const eventDay = calendarDayInTz(new Date(ev.date), timeZone);
        const state = (
          ev.competitions?.[0]?.status?.type?.state ||
          ev.status?.type?.state ||
          ""
        ).toLowerCase();
        if (eventDay !== day && state !== "in") continue;
      }

      const comp = ev.competitions?.[0];
      const statusType = comp?.status?.type || ev.status?.type;
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      const hs = home?.score;
      const as = away?.score;
      const status = refineStatus(espnStatus(statusType?.state), ev.date);
      const score =
        hs != null && as != null && status !== "upcoming"
          ? `${as}–${hs}`
          : undefined;
      const kick = formatKickoff(ev.date, timeZone);
      const statusText =
        status === "live"
          ? statusType?.shortDetail || "Live"
          : status === "final"
            ? statusType?.shortDetail || "FT"
            : kick.kickoffTime
              ? `${kick.kickoffTime} ${kick.kickoffTz || ""}`.trim()
              : statusType?.shortDetail ||
                statusType?.description ||
                "Scheduled";

      out.push(
        attachWatch(
          {
            id: `espn-${path}-${ev.id}`,
            sport,
            sportLabel: label,
            league,
            title:
              ev.name ||
              ev.shortName ||
              `${away?.team?.displayName || "TBD"} vs ${home?.team?.displayName || "TBD"}`,
            status,
            statusText,
            startsAt: ev.date,
            ...kick,
            whenHint:
              status === "live"
                ? "Live now"
                : status === "final"
                  ? "Final"
                  : kick.whenHint,
            home: home?.team?.displayName,
            away: away?.team?.displayName,
            score,
            source: "espn",
          },
          tip,
        ),
      );
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchTsdbDay(
  day: string,
  sport: MatchSport,
  label: string,
  query: string,
  timeZone: string,
  tip: ReturnType<typeof pickWatchTip>,
): Promise<MatchItem[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${day}&s=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { "User-Agent": "GLS-TV/1.0 (matchday)" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      events?: Array<{
        idEvent?: string;
        strEvent?: string;
        strLeague?: string;
        strHomeTeam?: string;
        strAwayTeam?: string;
        strTime?: string;
        strStatus?: string;
        strProgress?: string;
        intHomeScore?: string | null;
        intAwayScore?: string | null;
        dateEvent?: string;
        strTimestamp?: string;
      }> | null;
    };

    return (data.events || []).slice(0, 16).map((ev) => {
      const st = (ev.strStatus || ev.strProgress || "").toLowerCase();
      let status: MatchItem["status"] = "upcoming";
      if (/live|in play|1h|2h|ht|q\d/i.test(st)) status = "live";
      else if (/ft|finished|aet|pen/i.test(st)) status = "final";

      let startsAt: string | undefined;
      if (ev.strTimestamp) startsAt = new Date(ev.strTimestamp).toISOString();
      else if (ev.dateEvent && ev.strTime) {
        const t = ev.strTime.length === 5 ? `${ev.strTime}:00` : ev.strTime;
        startsAt = new Date(`${ev.dateEvent}T${t}Z`).toISOString();
      } else if (ev.dateEvent) {
        startsAt = new Date(`${ev.dateEvent}T12:00:00Z`).toISOString();
      }

      status = refineStatus(status, startsAt);
      const kick = formatKickoff(startsAt, timeZone);
      const score =
        ev.intHomeScore != null && ev.intAwayScore != null
          ? `${ev.intAwayScore}–${ev.intHomeScore}`
          : undefined;

      return attachWatch(
        {
          id: `tsdb-${ev.idEvent || ev.strEvent}`,
          sport,
          sportLabel: label,
          league: ev.strLeague || label,
          title: ev.strEvent || `${ev.strAwayTeam} vs ${ev.strHomeTeam}`,
          status,
          statusText:
            status === "live"
              ? ev.strProgress || "Live"
              : status === "final"
                ? "FT"
                : kick.kickoffTime
                  ? `${kick.kickoffTime} ${kick.kickoffTz || ""}`.trim()
                  : ev.strTime || "Scheduled",
          startsAt,
          ...kick,
          whenHint:
            status === "live"
              ? "Live now"
              : status === "final"
                ? "Final"
                : kick.whenHint,
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          score,
          source: "thesportsdb",
        },
        tip,
      );
    });
  } catch {
    return [];
  }
}

const SPORT_ORDER: MatchSport[] = [
  "soccer",
  "tennis",
  "cricket",
  "rugby",
  "basketball",
  "golf",
  "mma",
  "baseball",
  "american-football",
  "hockey",
  "other",
];

function statusRank(s: MatchItem["status"]) {
  if (s === "live") return 0;
  if (s === "upcoming") return 1;
  if (s === "unknown") return 2;
  return 3;
}

export async function getTodaysMatches(options?: {
  day?: string;
  limit?: number;
  timeZone?: string;
}): Promise<{
  day: string;
  dayLabel: string;
  timeZone: string;
  generatedAt: string;
  matches: MatchItem[];
  bySport: Record<string, MatchItem[]>;
  sources: string[];
}> {
  const timeZone = options?.timeZone || DEFAULT_MATCHDAY_TZ;
  const day = options?.day || calendarDayInTz(new Date(), timeZone);
  const limit = options?.limit ?? 48;

  const tipBySport = Object.fromEntries(
    SPORT_ORDER.map((s) => [s, pickWatchTip(s)]),
  ) as Record<MatchSport, ReturnType<typeof pickWatchTip>>;

  const espnLists = await Promise.all(
    ESPN_BOARDS.map((b) =>
      fetchEspn(b.path, b.sport, b.label, day, timeZone, tipBySport[b.sport]),
    ),
  );

  const tsdbLists = await Promise.all(
    TSDB_SPORTS.map((s) =>
      fetchTsdbDay(
        day,
        s.sport,
        s.label,
        s.query,
        timeZone,
        tipBySport[s.sport],
      ),
    ),
  );

  const seen = new Set<string>();
  const all: MatchItem[] = [];
  for (const list of [...espnLists, ...tsdbLists]) {
    for (const m of list) {
      const key = `${m.sport}|${(m.home || "").toLowerCase()}|${(m.away || "").toLowerCase()}|${m.league.toLowerCase()}|${(m.startsAt || "").slice(0, 13)}`;
      if (seen.has(key)) continue;
      const soft = `${m.sport}|${m.title.toLowerCase()}`;
      if (seen.has(soft) && m.source !== "espn") continue;
      seen.add(key);
      seen.add(soft);
      all.push(m);
    }
  }

  all.sort((a, b) => {
    const sr = statusRank(a.status) - statusRank(b.status);
    if (sr !== 0) return sr;
    const so = SPORT_ORDER.indexOf(a.sport) - SPORT_ORDER.indexOf(b.sport);
    if (so !== 0) return so;
    return (a.startsAt || "").localeCompare(b.startsAt || "");
  });

  const matches = all.slice(0, limit);
  const bySport: Record<string, MatchItem[]> = {};
  for (const m of matches) {
    (bySport[m.sportLabel] ||= []).push(m);
  }

  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));

  return {
    day,
    dayLabel,
    timeZone,
    generatedAt: new Date().toISOString(),
    matches,
    bySport,
    sources: ["ESPN scoreboard API", "TheSportsDB (cricket/rugby)"],
  };
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MatchItem } from "@/lib/matchday";

type Payload = {
  day: string;
  dayLabel?: string;
  timeZone?: string;
  matches: MatchItem[];
  bySport: Record<string, MatchItem[]>;
};

const SPORT_CHIPS = [
  "All",
  "Soccer",
  "Tennis",
  "Cricket",
  "Rugby",
  "Basketball",
  "Golf",
  "MMA",
  "Baseball",
  "American Football",
  "Hockey",
] as const;

function viewerTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg";
  } catch {
    return "Africa/Johannesburg";
  }
}

export function MatchDayStrip() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState<(typeof SPORT_CHIPS)[number]>("All");

  useEffect(() => {
    let cancelled = false;
    const tz = encodeURIComponent(viewerTz());
    (async () => {
      try {
        const res = await fetch(`/api/matchday?limit=60&tz=${tz}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError("Today’s fixtures are unavailable right now.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (sport === "All") return data.matches;
    return data.matches.filter(
      (m) => m.sportLabel.toLowerCase() === sport.toLowerCase(),
    );
  }, [data, sport]);

  return (
    <section className="mb-8 px-4 sm:px-8 lg:px-12">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gls-red">
            Match Day
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            Playing today
            {data?.dayLabel || data?.day ? (
              <span className="ml-2 text-sm font-normal text-gls-muted">
                {data.dayLabel || data.day}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gls-muted">
            Kick-offs shown in your local time
            {data?.timeZone ? ` (${data.timeZone})` : ""}. Watch opens a
            available sports coverage.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {SPORT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setSport(chip)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              sport === chip
                ? "bg-white text-black"
                : "border border-white/20 text-gls-body hover:border-white"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-gls-muted">{error}</p>
      )}
      {!data && !error && (
        <p className="text-sm text-gls-muted">Loading today’s matches…</p>
      )}

      {data && (
        <div className="gls-row-scroll gap-3">
          {filtered.length === 0 && (
            <p className="text-sm text-gls-muted">
              No fixtures in this sport today.
            </p>
          )}
          {filtered.map((m) => (
            <article
              key={m.id}
              className="w-[78vw] shrink-0 rounded-sm border border-white/10 bg-gls-elevated/80 p-4 sm:w-[340px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                  {m.sportLabel} · {m.league}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    m.status === "live"
                      ? "bg-gls-red text-white"
                      : m.status === "final"
                        ? "bg-white/10 text-gls-muted"
                        : "bg-white/15 text-white"
                  }`}
                >
                  {m.status === "live"
                    ? "Live"
                    : m.status === "final"
                      ? "Final"
                      : "Upcoming"}
                </span>
              </div>

              <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">
                {m.title}
              </h3>

              {(m.kickoffDate || m.kickoffTime) && (
                <p className="mt-2 text-sm tabular-nums text-white">
                  {m.kickoffDate}
                  {m.kickoffDate && m.kickoffTime ? " · " : null}
                  {m.kickoffTime}
                  {m.kickoffTz ? (
                    <span className="text-gls-muted"> {m.kickoffTz}</span>
                  ) : null}
                </p>
              )}

              {m.whenHint && m.status !== "final" && (
                <p className="mt-0.5 text-xs text-gls-muted">{m.whenHint}</p>
              )}

              {m.score && (
                <p className="mt-1 text-lg font-bold tabular-nums text-white">
                  {m.score}
                </p>
              )}

              {m.watchSlug ? (
                <div className="mt-3">
                  {m.watchHint && (
                    <p className="mb-1.5 text-[11px] text-gls-muted">
                      {m.watchHint}
                    </p>
                  )}
                  <Link
                    href={`/watch/${m.watchSlug}`}
                    className="inline-flex rounded bg-white px-3 py-1.5 text-xs font-bold text-black transition hover:bg-gls-red hover:text-white"
                  >
                    Open {m.watchTitle || "related channel"} ›
                  </Link>
                </div>
              ) : (
                <Link
                  href="/sports"
                  className="mt-3 inline-flex text-xs text-gls-muted hover:text-white"
                >
                  Browse sports ›
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

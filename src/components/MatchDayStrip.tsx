"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MatchItem } from "@/lib/matchday";

type Payload = { day: string; dayLabel?: string; timeZone?: string; matches: MatchItem[] };
const SPORTS = ["All", "Soccer", "Tennis", "Cricket", "Rugby", "Basketball", "Golf", "MMA"] as const;
const REMINDER_KEY = "gls-match-reminders-v1";
const SPORT_STYLE: Record<string, { icon: string; gradient: string }> = {
  soccer: { icon: "⚽", gradient: "from-emerald-500/25 via-emerald-950/20" },
  tennis: { icon: "◉", gradient: "from-lime-400/25 via-lime-950/20" },
  cricket: { icon: "◆", gradient: "from-cyan-400/25 via-cyan-950/20" },
  rugby: { icon: "⬭", gradient: "from-amber-400/25 via-amber-950/20" },
  basketball: { icon: "●", gradient: "from-orange-500/25 via-orange-950/20" },
  golf: { icon: "⚑", gradient: "from-teal-400/25 via-teal-950/20" },
  mma: { icon: "✦", gradient: "from-red-500/25 via-red-950/20" },
};

function viewerTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg"; }
  catch { return "Africa/Johannesburg"; }
}

function teamInitials(name?: string) {
  if (!name) return "—";
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase();
}

function countdown(startsAt: string | undefined, now: number | null) {
  if (!startsAt || now === null) return null;
  const minutes = Math.ceil((new Date(startsAt).getTime() - now) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

export function MatchDayStrip() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState<(typeof SPORTS)[number]>("All");
  const [view, setView] = useState<"all" | "live" | "upcoming">("all");
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    try {
      const saved = JSON.parse(localStorage.getItem(REMINDER_KEY) || "[]");
      if (Array.isArray(saved)) {
        queueMicrotask(() => setReminders(new Set(saved.map(String))));
      }
    } catch { /* ignore an invalid local preference */ }
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/matchday?limit=60&tz=${encodeURIComponent(viewerTz())}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch { if (!cancelled) setError("Today’s fixtures are unavailable right now."); }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => (data?.matches || []).filter((match) => {
    if (sport !== "All" && match.sportLabel.toLowerCase() !== sport.toLowerCase()) return false;
    return view === "all" || match.status === view;
  }), [data, sport, view]);

  const counts = useMemo(() => ({
    live: data?.matches.filter((match) => match.status === "live").length || 0,
    upcoming: data?.matches.filter((match) => match.status === "upcoming").length || 0,
  }), [data]);

  const toggleReminder = (id: string) => setReminders((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem(REMINDER_KEY, JSON.stringify([...next]));
    return next;
  });

  return (
    <section className="mb-10 px-4 sm:px-8 lg:px-12">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(239,68,68,0.18),transparent_32%),linear-gradient(145deg,rgba(20,20,20,0.98),rgba(7,7,7,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-5 border-b border-white/10 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.26em] text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> GLS Sports Centre
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Live & upcoming</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/55">Scores, local kick-off times and verified open coverage for {data?.dayLabel || "today"}.</p>
          </div>
          <div className="flex gap-2" role="tablist" aria-label="Match status">
            {([ ["all", "All", data?.matches.length || 0], ["live", "Live", counts.live], ["upcoming", "Starting soon", counts.upcoming] ] as const).map(([key, label, count]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
                className={`rounded-full px-3 py-2 text-xs font-bold transition sm:px-4 ${view === key ? (key === "live" ? "bg-red-600 text-white" : "bg-white text-black") : "border border-white/15 bg-white/[0.04] text-white/65 hover:border-white/35 hover:text-white"}`}>
                {label} <span className="ml-1 opacity-60">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-5 py-4 sm:px-7">
          {SPORTS.map((chip) => (
            <button key={chip} type="button" onClick={() => setSport(chip)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${sport === chip ? "bg-red-600 text-white shadow-lg shadow-red-950/40" : "bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white"}`}>{chip}</button>
          ))}
        </div>

        <div className="px-5 pb-6 sm:px-7 sm:pb-7">
          {error && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</p>}
          {!data && !error && <div className="h-56 animate-pulse rounded-2xl bg-white/[0.05]" aria-label="Loading today’s matches" />}
          {data && <div className="gls-row-scroll gap-4 pb-2">
            {filtered.length === 0 && <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-white/45">No matching fixtures right now.</div>}
            {filtered.map((match) => {
              const style = SPORT_STYLE[match.sport] || { icon: "◆", gradient: "from-violet-500/25 via-violet-950/20" };
              const isReminded = reminders.has(match.id);
              const startsIn = countdown(match.startsAt, now);
              const titleTeams = match.title.split(/\s+v(?:s)?\s+/i);
              return (
                <article key={match.id} className={`group relative w-[84vw] shrink-0 overflow-hidden rounded-2xl border bg-gradient-to-br ${style.gradient} to-black/90 p-5 transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_18px_45px_rgba(0,0,0,0.48)] sm:w-[370px] ${match.status === "live" ? "border-red-500/45" : "border-white/10"}`}>
                  <div className="absolute -right-8 -top-10 text-[8rem] opacity-[0.055] transition group-hover:scale-110 group-hover:opacity-10">{style.icon}</div>
                  <div className="relative flex items-center justify-between gap-3">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">{match.league}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${match.status === "live" ? "bg-red-600 text-white" : match.status === "final" ? "bg-white/10 text-white/45" : "bg-white text-black"}`}>
                      {match.status === "live" ? "● Live" : match.status === "final" ? "Final" : startsIn ? `In ${startsIn}` : "Upcoming"}
                    </span>
                  </div>
                  <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <Team name={match.away || titleTeams[0]} />
                    <div><p className="text-2xl font-black tabular-nums text-white">{match.score || "VS"}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">{match.statusText}</p></div>
                    <Team name={match.home || titleTeams[1]} />
                  </div>
                  <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div><p className="text-xs font-semibold text-white">{match.kickoffTime ? `${match.kickoffTime} ${match.kickoffTz || ""}` : match.whenHint || match.sportLabel}</p><p className="mt-0.5 text-[10px] text-white/40">{match.sportLabel} · Local time</p></div>
                    <div className="flex gap-2">
                      {match.status === "upcoming" && <button type="button" onClick={() => toggleReminder(match.id)} aria-pressed={isReminded} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${isReminded ? "border-amber-300/50 bg-amber-300 text-black" : "border-white/15 bg-black/20 text-white/70 hover:text-white"}`}>{isReminded ? "✓ Saved" : "+ Remind"}</button>}
                      {match.watchSlug ? <Link href={`/watch/${match.watchSlug}`} data-tv-focus className="rounded-full bg-white px-4 py-2 text-xs font-black text-black transition hover:bg-red-600 hover:text-white">Watch</Link> : <Link href="/sports" className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:text-white">Channels</Link>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>}
        </div>
      </div>
    </section>
  );
}

function Team({ name }: { name?: string }) {
  return <div className="min-w-0"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/35 text-sm font-black text-white shadow-inner">{teamInitials(name)}</div><p className="mt-2 line-clamp-2 text-xs font-semibold text-white/85">{name || "TBD"}</p></div>;
}

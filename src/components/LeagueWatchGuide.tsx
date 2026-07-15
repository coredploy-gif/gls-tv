"use client";

const LEAGUES = [
  {
    name: "Premier League",
    provider: "SuperSport Premier League",
    detail: "Dedicated coverage is carried on SuperSport Premier League, channel 223.",
    href: "https://www.dstv.com/en-za/",
  },
  {
    name: "UEFA Champions League",
    provider: "SuperSport",
    detail: "Selected UEFA Champions League matches are available by DStv package.",
    href: "https://www.dstv.com/en-za/",
  },
  {
    name: "La Liga & Serie A",
    provider: "SuperSport Football",
    detail: "League and overflow fixtures are scheduled across SuperSport channels.",
    href: "https://www.dstv.com/en-za/",
  },
  {
    name: "FIFA World Cup 2026",
    provider: "Official broadcasters",
    detail: "Use FIFA's match guide for the licensed broadcaster in your territory.",
    href: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
  },
] as const;

/** Official destinations for rights-managed competitions, without pretending an open HLS feed is licensed. */
export function LeagueWatchGuide() {
  return (
    <section className="relative z-10 px-4 py-4 sm:px-8 lg:px-12">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <p className="gls-eyebrow">League central</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Big football, official coverage</h2>
            <p className="mt-1 max-w-2xl text-sm text-gls-muted">Rights change by territory. These links take South African viewers to the licensed viewing destination instead of unstable unofficial streams.</p>
          </div>
          <span className="gls-quality-pill">4K READY</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {LEAGUES.map((league) => (
            <a
              key={league.name}
              href={league.href}
              target="_blank"
              rel="noreferrer"
              className="gls-card-lift rounded-xl border border-white/10 bg-black/25 p-4"
            >
              <p className="font-semibold text-white">{league.name}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/70">{league.provider}</p>
              <p className="mt-3 text-xs leading-relaxed text-gls-muted">{league.detail}</p>
              <p className="mt-4 text-xs font-semibold text-gls-pink-soft">Open official guide ↗</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

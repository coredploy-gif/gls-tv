import Link from "next/link";
import { BrowseNav } from "@/components/BrowseNav";
import {
  AUDIENCE_META,
  GLS_GAMES,
  PACK_META,
  gamesByAudience,
  gamesByPack,
  type GameAudience,
  type GlsGame,
} from "@/lib/games";

const SECTIONS: GameAudience[] = ["kids", "all", "challenge"];

function GameCard({ game, badge }: { game: GlsGame; badge?: string }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="group relative flex min-h-[168px] flex-col overflow-hidden rounded-sm border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-5 transition duration-300 hover:border-white/28 hover:from-white/[0.1]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35 transition duration-300 group-hover:opacity-55"
        style={{
          background: `radial-gradient(circle at top left, ${game.accent}, transparent 58%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40"
        style={{ background: game.accent }}
      />
      <div className="relative flex flex-1 flex-col">
        <span
          className="inline-flex w-fit rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black"
          style={{ background: game.accent }}
        >
          {badge || AUDIENCE_META[game.audience].label}
        </span>
        <h3 className="mt-3 text-xl font-bold tracking-tight text-white">
          {game.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-white/60">
          {game.blurb}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition group-hover:gap-2.5">
          Play now
          <span aria-hidden className="text-white/70">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export default function GamesPage() {
  const brickGames = gamesByPack("brick");

  return (
    <main className="min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.22),transparent_55%)]"
        />
        <div className="relative mx-auto max-w-[1200px] px-4 pt-28 sm:px-8 lg:px-12 lg:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
            Entertainment
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Games
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/65">
            {GLS_GAMES.length} free HTML5 games hosted on GLS TV — kids-easy to
            challenge-hard. Sign in to climb the community leaderboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {brickGames.length > 0 && (
              <a
                href="#brick"
                className="rounded-sm border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-gls-red/50 hover:text-white"
              >
                {PACK_META.brick.label}
              </a>
            )}
            {SECTIONS.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="rounded-sm border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-gls-red/50 hover:text-white"
              >
                {AUDIENCE_META[key].label}
              </a>
            ))}
          </div>

          <div className="mt-14 space-y-14">
            {brickGames.length > 0 && (
              <section id="brick" className="scroll-mt-28">
                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">
                      {PACK_META.brick.label}
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      {PACK_META.brick.description}
                    </p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                    {brickGames.length} game{brickGames.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {brickGames.map((game) => (
                    <GameCard
                      key={`brick-${game.id}`}
                      game={game}
                      badge="Brick"
                    />
                  ))}
                </div>
              </section>
            )}

            {SECTIONS.map((audience) => {
              const games = gamesByAudience(audience);
              if (!games.length) return null;
              const meta = AUDIENCE_META[audience];
              return (
                <section key={audience} id={audience} className="scroll-mt-28">
                  <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-white">
                        {meta.label}
                      </h2>
                      <p className="mt-1 text-sm text-white/55">
                        {meta.description}
                      </p>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                      {games.length} game{games.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {games.map((game) => (
                      <GameCard key={game.id} game={game} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

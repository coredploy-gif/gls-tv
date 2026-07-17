"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AUDIENCE_META,
  GLS_GAMES,
  PACK_META,
  gamesByAudience,
  gamesByPack,
  isPhoneFriendly,
  needsVirtualPad,
  searchGames,
  type GameAudience,
  type GlsGame,
} from "@/lib/games";

const SECTIONS: GameAudience[] = ["kids", "all", "challenge"];

function GameCard({ game, badge }: { game: GlsGame; badge?: string }) {
  const phone = isPhoneFriendly(game);
  const pad = needsVirtualPad(game);
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
      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-wrap gap-1.5">
          <span
            className="inline-flex w-fit rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black"
            style={{ background: game.accent }}
          >
            {badge || AUDIENCE_META[game.audience].label}
          </span>
          {phone && (
            <span className="inline-flex rounded-sm border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
              {pad ? "Touch pad" : "Touch OK"}
            </span>
          )}
        </div>
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

export function GamesHub() {
  const [q, setQ] = useState("");
  const [phoneOnly, setPhoneOnly] = useState(false);
  const brickGames = gamesByPack("brick");

  const filtered = useMemo(() => {
    let list = searchGames(q);
    if (phoneOnly) list = list.filter(isPhoneFriendly);
    return list;
  }, [q, phoneOnly]);

  const searching = q.trim().length > 0 || phoneOnly;

  return (
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
          {GLS_GAMES.length} free HTML5 games — kids-easy to challenge-hard.
          Phone and tablet get on-screen pads for Snake, Brick Stack, and more.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games — snake, brick, kids…"
            className="w-full flex-1 rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-gls-red"
          />
          <button
            type="button"
            onClick={() => setPhoneOnly((v) => !v)}
            className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold ${
              phoneOnly
                ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                : "border-white/15 text-white/70"
            }`}
          >
            Phone-friendly
          </button>
        </div>

        {!searching && (
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
        )}

        {searching ? (
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between gap-3">
              <h2 className="text-2xl font-black tracking-tight text-white">
                Results
              </h2>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                {filtered.length} game{filtered.length === 1 ? "" : "s"}
              </p>
            </div>
            {filtered.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-white/55">
                No games match. Try “snake”, “brick”, or clear Phone-friendly.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </section>
        ) : (
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
                    {brickGames.length} games
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
                      {games.length} games
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
        )}
      </div>
    </div>
  );
}

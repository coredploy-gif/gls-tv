import Link from "next/link";
import { notFound } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { GamePlayer } from "@/components/GamePlayer";
import { AUDIENCE_META, PACK_META, getGame } from "@/lib/games";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();
  const audience = AUDIENCE_META[game.audience];
  const pack = game.pack ? PACK_META[game.pack] : null;

  return (
    <main className="min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-8 lg:px-12 lg:pt-24">
        <Link
          href="/games"
          className="inline-flex text-sm font-semibold text-white/60 transition hover:text-white"
        >
          ← All games
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black"
            style={{ background: game.accent }}
          >
            {audience.label}
          </span>
          {pack && (
            <span className="inline-flex rounded-sm border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              {pack.label}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
          {game.title}
        </h1>
        <p className="mt-2 max-w-2xl text-white/65">{game.blurb}</p>
        <div className="mt-8">
          <GamePlayer
            gameId={game.id}
            src={game.path}
            title={game.title}
            howToPlay={game.howToPlay}
          />
        </div>
      </div>
    </main>
  );
}

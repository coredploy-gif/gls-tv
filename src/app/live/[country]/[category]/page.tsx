import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { getCountry } from "@/data/catalog";
import { getLiveTvByCountry, isLiveTvEligible } from "@/lib/channels";

type Props = {
  params: Promise<{ country: string; category: string }>;
};

function isMoviesCategory(name: string) {
  return /^(movies?|film|cinema)$/i.test(name.trim());
}

function isSeriesCategory(name: string) {
  return /^(series|drama|liveseries|24\/7)$/i.test(name.trim());
}

export default async function LiveCategoryPage({ params }: Props) {
  const { country: code, category } = await params;
  const country = getCountry(code);
  if (!country) notFound();

  const decoded = decodeURIComponent(category);

  // 24/7 movie & series FASTs live under /movies and /series, not Live TV.
  if (isMoviesCategory(decoded)) redirect("/movies");
  if (isSeriesCategory(decoded)) redirect("/series");

  const channels = getLiveTvByCountry(code)
    .filter(isLiveTvEligible)
    .filter((ch) =>
      ch.categories.some((c) => c.toLowerCase() === decoded.toLowerCase()),
    );
  if (!channels.length) notFound();

  const label =
    decoded.charAt(0).toUpperCase() + decoded.slice(1).toLowerCase();

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <Link
          href={`/live/${code}`}
          className="text-sm text-gls-muted transition hover:text-white"
        >
          ← {country.name}
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-gls-red">
          {country.flag} {country.name} · Live
        </p>
        <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">
          {label}
        </h1>
        <p className="mt-2 text-gls-muted">{channels.length} channels</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/watch/${ch.slug}`}
              className="group overflow-hidden rounded-sm border border-white/10 bg-gls-elevated transition hover:border-white/25"
            >
              <div className="relative aspect-video overflow-hidden bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ch.poster || ch.backdrop}
                  alt=""
                  className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded bg-gls-red px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  Live
                </span>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-white">{ch.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-gls-muted">
                  {ch.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

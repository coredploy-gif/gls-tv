import Link from "next/link";
import { notFound } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import {
  getCountry,
  getLiveByCountry,
  getLiveCategoriesForCountry,
} from "@/data/catalog";
import { getUsChannels } from "@/lib/channels";
import { groupByCategory } from "@/lib/iptv";

type Props = { params: Promise<{ country: string }> };

export default async function LiveCountryPage({ params }: Props) {
  const { country: code } = await params;
  const country = getCountry(code);
  if (!country) notFound();

  const iptvUs = code === "us" ? getUsChannels() : [];
  const seedChannels = getLiveByCountry(code);
  const channels = code === "us" ? [...iptvUs, ...seedChannels] : seedChannels;

  const categoryMap = groupByCategory(channels);
  const categories =
    categoryMap.length > 0
      ? categoryMap.map(([name]) => name)
      : getLiveCategoriesForCountry(code);

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <Link
          href="/live"
          className="text-sm text-gls-muted transition hover:text-white"
        >
          ← All countries
        </Link>
        <div className="mt-4 flex items-end gap-4">
          <span className="text-5xl" aria-hidden>
            {country.flag}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gls-red">
              Live TV
            </p>
            <h1 className="gls-display text-5xl text-white sm:text-6xl">
              {country.name}
            </h1>
            <p className="mt-1 text-sm text-gls-muted">
              {channels.length} channels
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-white">Categories</h2>
        {categories.length === 0 ? (
          <p className="mt-3 text-gls-muted">No live channels yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/live/${code}/${encodeURIComponent(cat.toLowerCase())}`}
                className="rounded border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-gls-red hover:bg-gls-red/20"
              >
                {cat}
              </Link>
            ))}
          </div>
        )}

        <h2 className="mt-12 text-lg font-semibold text-white">
          Channels ({Math.min(channels.length, 48)}
          {channels.length > 48 ? ` of ${channels.length}` : ""})
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channels.slice(0, 48).map((ch) => (
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
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-gls-red px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  Live
                </span>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-white">{ch.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-gls-muted">
                  {ch.categories.join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

import { BrowseNav } from "@/components/BrowseNav";
import { TitleCard } from "@/components/TitleCard";
import { getMovieChannels } from "@/lib/channels";

export default function MoreMoviesPage() {
  const items = getMovieChannels();
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <p className="gls-eyebrow">Complete catalogue</p>
        <h1 className="gls-display mt-3 text-5xl text-white">Movie channels</h1>
        <p className="mt-2 text-sm text-gls-muted">
          {items.length} movie and cinema channels (including 24/7 FASTs moved
          out of Live TV).
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => <div key={item.id} className="w-full [&_a]:w-full"><TitleCard item={item} /></div>)}
        </div>
      </div>
    </main>
  );
}

import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import { HomeLibraryRows } from "@/components/HubExtras";
import { getByType } from "@/data/catalog";
import { TOP10, getPopularFirst, getUkTop } from "@/data/top10";
import { VERIFIED_LIVE } from "@/data/verified";
import { getAllChannels } from "@/lib/channels";
import { getRelatedChannels } from "@/lib/hubs";

export default function BrowsePage() {
  const popular = getPopularFirst();
  const featured = TOP10.sports[0] ?? popular[0]!;
  const movies = getByType("movie");
  const series = getByType("series");
  const demo = VERIFIED_LIVE.filter((c) => !c.isLive);
  const uk = getUkTop();
  const recommended = getRelatedChannels(featured, 12);
  const allChannels = getAllChannels();
  const bySlug = new Map(allChannels.map((channel) => [channel.slug, channel]));
  const southAfricanPriority = [
    "sabc-news",
    "ln24-sa",
    "sabc-1",
    "sabc-2",
    "sabc-3",
    "etv-news-za",
    "wildearth",
    "trace-urban-africa",
    "trace-africa",
  ];
  const southAfricanPicks = [
    ...southAfricanPriority
      .map((slug) => bySlug.get(slug))
      .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel)),
    ...allChannels.filter(
      (channel) =>
        channel.countries.includes("za") &&
        !southAfricanPriority.includes(channel.slug),
    ),
    ...recommended,
  ].filter(
    (channel, index, list) =>
      list.findIndex((candidate) => candidate.slug === channel.slug) === index,
  );

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />
      <HeroBillboard item={featured} />
      <div className="relative z-20 -mt-20 space-y-2">
        <HomeLibraryRows />

        <ContentRow
          title="Popular in South Africa"
          items={southAfricanPicks}
          limit={12}
          viewMoreHref="/live"
        />

        <ContentRow
          title="Top 10 Sports"
          items={[...TOP10.sports]}
          ranked
          limit={10}
          viewMoreHref="/sports"
        />
        <ContentRow
          title="Top 10 Kids"
          items={[...TOP10.kids]}
          ranked
          limit={10}
          viewMoreHref="/kids"
        />
        <ContentRow
          title="Top 10 News"
          items={[...TOP10.news]}
          ranked
          limit={10}
          viewMoreHref="/news"
        />
        <ContentRow
          title="Top 10 Food & competitions"
          items={[...TOP10.food]}
          ranked
          limit={10}
          viewMoreHref="/food"
        />
        <ContentRow
          title="Popular channels"
          items={popular}
          limit={12}
          viewMoreHref="/live/more/popular"
        />
        <ContentRow
          title="UK picks"
          items={uk}
          limit={12}
          viewMoreHref="/live/more/all?country=uk"
        />
        <ContentRow title="Player demo" items={demo} limit={6} />
        <ContentRow
          title="Movies"
          items={movies}
          limit={12}
          viewMoreHref="/movies"
        />
        <ContentRow
          title="Series"
          items={series}
          limit={12}
          viewMoreHref="/series"
        />
      </div>
    </main>
  );
}

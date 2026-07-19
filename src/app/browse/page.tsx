import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import { HomeLibraryRows } from "@/components/HubExtras";
import { LastChannelResume } from "@/components/LastChannelResume";
import { getByType } from "@/data/catalog";
import { TOP10, getPopularFirst, getUkTop } from "@/data/top10";
import { VERIFIED_LIVE } from "@/data/verified";
import { getAllChannels, getReligionChannels } from "@/lib/channels";
import { getRelatedChannels } from "@/lib/hubs";
import { getMalawiBrowseItems, getAfricaRadioBrowseItems } from "@/lib/radio";
import { getReligionBrowseItems } from "@/lib/religion";
import { isTraceChannel } from "@/lib/trace-mirrors";

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
  const tracePriority = [
    "trace-urban-africa",
    "trace-africa",
    "trace-gospel",
    "trace-mziki",
    "trace-urban-international",
    "trace-latina",
    "tracegospel-fr-southernafrica",
    "trace-urban-france",
    "trace-ayiti",
    "trace-caribbean",
  ];
  const traceChannels = [
    ...tracePriority
      .map((slug) => bySlug.get(slug))
      .filter((channel): channel is NonNullable<typeof channel> =>
        Boolean(channel),
      ),
    ...allChannels.filter(
      (channel) =>
        isTraceChannel(channel.slug, channel.title) &&
        !tracePriority.includes(channel.slug),
    ),
  ].filter(
    (channel, index, list) =>
      list.findIndex((candidate) => candidate.slug === channel.slug) === index,
  );

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

  const malawiItems = getMalawiBrowseItems();
  const africaRadioItems = getAfricaRadioBrowseItems();
  const religionItems = getReligionBrowseItems(getReligionChannels());

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />
      <HeroBillboard item={featured} />
      <div className="relative z-20 -mt-20 space-y-2">
        <div className="px-4 sm:px-8 lg:px-12">
          <LastChannelResume />
        </div>
        <HomeLibraryRows />

        <ContentRow
          title="Popular in South Africa"
          items={southAfricanPicks}
          limit={12}
          viewMoreHref="/live"
        />

        <ContentRow
          title="🎵 Trace Music · Africa & urban"
          items={traceChannels}
          limit={12}
          viewMoreHref="/africa/more/all?q=trace"
        />

        {malawiItems.length > 0 && (
          <ContentRow
            title="🇲🇼 Malawi · MBC TV & radio"
            items={malawiItems}
            limit={12}
            viewMoreHref="/radio"
          />
        )}

        {africaRadioItems.length > 0 && (
          <ContentRow
            title="🌍 Africa · Kenya, Nigeria, Tanzania & more"
            items={africaRadioItems}
            limit={8}
            viewMoreHref="/radio"
          />
        )}

        {religionItems.length > 0 && (
          <ContentRow
            title="🙏 Religion · Islam, Gospel & more"
            items={religionItems}
            limit={8}
            viewMoreHref="/religion"
          />
        )}

        <ContentRow
          title="Top 10 Sports"
          items={[...TOP10.sports]}
          ranked
          limit={10}
          viewMoreHref="/sports"
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
          title="Top 10 Kids · English"
          items={[...TOP10.kids]}
          ranked
          limit={10}
          viewMoreHref="/kids"
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

import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { TitleCard } from "@/components/TitleCard";
import { getByType } from "@/data/catalog";
import { getAsiaSeries, getSeriesChannels } from "@/lib/channels";
import { CURATED_SERIES_SEEDS } from "@/data/curated-public-fast";
import { KoreanDramaGuide } from "@/components/KoreanDramaGuide";

export default function SeriesPage() {
  const classic = getByType("series");
  const seeded = CURATED_SERIES_SEEDS;
  const seriesChannels = getSeriesChannels();
  const asia = getAsiaSeries();
  const korea = asia.filter(
    (i) =>
      i.countries.includes("kr") ||
      /korea|k-?drama|korean/i.test(`${i.title} ${i.categories.join(" ")}`),
  );
  const india = asia.filter((i) => i.countries.includes("in"));
  const japan = asia.filter(
    (i) =>
      i.countries.includes("jp") || /anime|japan/i.test(i.title),
  );
  const china = asia.filter((i) =>
    ["cn", "tw", "hk"].includes(i.countries[0] || ""),
  );

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] space-y-2 px-0">
        <div className="px-4 sm:px-8 lg:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gls-red">
            Catalog
          </p>
          <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">
            Series
          </h1>
          <p className="mt-3 max-w-2xl text-gls-muted">
            Asian drama & entertainment linear channels (Korea, India, China,
            Japan…) plus public-domain anthologies. Open feeds only — not Netflix
            K-drama catalogs.
          </p>
        </div>

        <KoreanDramaGuide />

        {korea.length > 0 && (
          <ContentRow
            title="Korea"
            items={korea}
            limit={12}
            viewMoreHref="/asia?country=kr"
          />
        )}
        {india.length > 0 && (
          <ContentRow title="India" items={india} limit={12} />
        )}
        {japan.length > 0 && (
          <ContentRow title="Japan" items={japan} limit={12} />
        )}
        {china.length > 0 && (
          <ContentRow title="China · TW · HK" items={china} limit={12} />
        )}
        {asia.length > 0 && (
          <ContentRow
            title="All Asia series & drama"
            items={asia}
            limit={12}
            viewMoreHref="/asia"
          />
        )}

        <ContentRow title="Featured series channels" items={seeded} limit={12} />
        <ContentRow
          title="Series & drama channels"
          items={seriesChannels}
          limit={12}
          viewMoreHref="/series/more"
        />

        <div className="px-4 pt-6 sm:px-8 lg:px-12">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Public anthologies
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {classic.map((item) => (
              <div key={item.id} className="w-full [&_a]:w-full">
                <TitleCard item={item} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchBackButton } from "@/components/WatchBackButton";
import { WatchLibrarySync } from "@/components/HubExtras";
import { getChannelBySlug } from "@/lib/channels";
import { withLiveSources } from "@/lib/supabase/live-sources";
import { getSeedCatalogItem } from "@/lib/stream-seeds-catalog";
import { getDbCatalogItem } from "@/lib/db-catalog";
import {
  fallbackHubHref,
  getRelatedChannels,
  hubKeyForItem,
  ROW_LIMIT,
} from "@/lib/hubs";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const base =
    getChannelBySlug(slug) ??
    (await getSeedCatalogItem(slug)) ??
    (await getDbCatalogItem(slug));
  if (!base) notFound();
  const item = await withLiveSources(base);

  const related = getRelatedChannels(item, 24);
  const hubKey = hubKeyForItem(item);
  const moreTitle =
    hubKey === "kids"
      ? "More Kids"
      : hubKey === "sports"
        ? "More Sports"
        : hubKey === "news"
          ? "More News"
          : hubKey === "food"
            ? "More Food"
            : "More like this";
  const fallbackHref = fallbackHubHref(item);
  const viewMoreHref =
    hubKey && hubKey !== "live" ? `/${hubKey}` : fallbackHref;

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />

      {/* Clear of fixed nav + mobile tab strip */}
      <div className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-8 sm:pt-28 lg:px-12 lg:pt-24">
        <WatchBackButton fallbackHref={fallbackHref} label="Back" />

        <div className="mt-4 overflow-hidden rounded-sm border border-white/10 shadow-2xl shadow-black/60">
          <VideoPlayer item={item} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            {item.isLive && (
              <span className="inline-flex items-center gap-1.5 rounded bg-gls-red px-2 py-1 text-xs font-bold uppercase text-white">
                Live
              </span>
            )}
            <h1 className="gls-display text-4xl text-white sm:text-5xl">
              {item.title}
            </h1>
          </div>
          <WatchLibrarySync
            slug={item.slug}
            title={item.title}
            poster={item.poster}
            backdrop={item.backdrop}
          />
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gls-body">
            {item.year && <span>{item.year}</span>}
            {item.sources[0] && (
              <span className="text-gls-muted">{item.sources[0].quality}</span>
            )}
          </div>
          <p className="mt-4 text-base leading-relaxed text-gls-body">
            {item.description}
          </p>
          <p className="mt-3 text-sm text-gls-muted">
            {item.categories.join(" · ")} ·{" "}
            {item.countries.map((c) => c.toUpperCase()).join(", ")}
          </p>
        </div>
        <aside className="gls-glass h-fit rounded-xl p-5">
          <p className="gls-eyebrow">Now playing</p>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-gls-muted">Playback</dt><dd className="font-medium text-white">{item.isLive ? "Live stream" : "On demand"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-gls-muted">Quality</dt><dd className="font-medium text-white">{item.sources[0]?.quality || "Auto"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-gls-muted">Sources</dt><dd className="font-medium text-white">{item.sources.length || 0} available</dd></div>
          </dl>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-gls-muted">If playback pauses, GLS TV automatically attempts the next available source.</p>
        </aside>
        </div>
      </div>

      {related.length > 0 && (
        <div className="relative z-10 mt-10">
          <ContentRow
            title={moreTitle}
            items={related}
            limit={ROW_LIMIT}
            viewMoreHref={viewMoreHref}
          />
        </div>
      )}
    </main>
  );
}

import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchBackButton } from "@/components/WatchBackButton";
import { createClient } from "@/lib/supabase/server";
import {
  channelRowToCatalog,
  type UserPlaylistChannelRow,
} from "@/lib/playlists";
import {
  hasTraceUrbanFallbackTag,
  TRACE_URBAN_FALLBACK_NOTICE,
} from "@/lib/trace-mirrors";
import { hasSisterFallbackTag } from "@/lib/heal-registry";
import { getAccountEntitlement } from "@/lib/membership/account";
import { playlistHealthRank } from "@/lib/playlist-health";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

export default async function WatchMinePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/watch/mine/${encodeURIComponent(slug)}`);
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) redirect("/pricing?reason=membership-required");

  const { data: row } = await supabase
    .from("user_playlist_channels")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", slug)
    .maybeSingle();

  if (!row) notFound();

  const [{ data: mirrorRows }, { data: relatedRows }] = await Promise.all([
    supabase
      .from("user_playlist_channels")
      .select("*")
      .eq("user_id", user.id)
      .eq("playlist_id", row.playlist_id)
      .eq("title", row.title)
      .neq("id", slug)
      .order("sort_order", { ascending: true })
      .limit(12),
    supabase
      .from("user_playlist_channels")
      .select("*")
      .eq("user_id", user.id)
      .eq("playlist_id", row.playlist_id)
      .neq("id", slug)
      .order("sort_order", { ascending: true })
      .limit(24),
  ]);

  const primaryItem = channelRowToCatalog(row as UserPlaylistChannelRow);
  const sourceCandidates = [
    row as UserPlaylistChannelRow,
    ...((mirrorRows || []) as UserPlaylistChannelRow[]),
  ].sort(
    (a, b) =>
      playlistHealthRank(a.health_status) -
      playlistHealthRank(b.health_status),
  );
  const seenSources = new Set<string>();
  const item = {
    ...primaryItem,
    sources: sourceCandidates
      .map((candidate) => channelRowToCatalog(candidate))
      .flatMap((candidate) => candidate.sources)
      .filter((source) => {
        if (seenSources.has(source.url)) return false;
        seenSources.add(source.url);
        return true;
      }),
  };

  const related = (relatedRows || []).map((r) =>
    channelRowToCatalog(r as UserPlaylistChannelRow),
  );

  const playlistOrdered = [
    ...(relatedRows || []).map((r) => r as UserPlaylistChannelRow),
    row as UserPlaylistChannelRow,
  ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const playIdx = playlistOrdered.findIndex((r) => r.id === slug);
  const prevRow = playIdx > 0 ? playlistOrdered[playIdx - 1] : null;
  const nextRow =
    playIdx >= 0 && playIdx < playlistOrdered.length - 1
      ? playlistOrdered[playIdx + 1]
      : null;
  const prevChannel = prevRow
    ? {
        href: `/watch/mine/${prevRow.id}`,
        title: prevRow.title,
      }
    : null;
  const nextChannel = nextRow
    ? {
        href: `/watch/mine/${nextRow.id}`,
        title: nextRow.title,
      }
    : null;

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />

      <div className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-8 sm:pt-28 lg:px-12 lg:pt-24">
        <WatchBackButton fallbackHref="/playlists" label="Back to playlists" />

        <div className="mt-4 overflow-hidden rounded-sm border border-white/10 shadow-2xl shadow-black/60">
          <VideoPlayer
            item={item}
            prevChannel={prevChannel}
            nextChannel={nextChannel}
          />
        </div>

        <div className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded bg-gls-red px-2 py-1 text-xs font-bold uppercase text-white">
              Live
            </span>
            <span className="rounded bg-white/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/90">
              My playlist
            </span>
            <h1 className="gls-display text-4xl text-white sm:text-5xl">
              {item.title}
            </h1>
          </div>
          {hasTraceUrbanFallbackTag(item.categories) ||
          hasSisterFallbackTag(item.categories) ? (
            <p
              className="mt-4 rounded border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-100"
              role="status"
            >
              {item.description?.trim() ||
                (hasTraceUrbanFallbackTag(item.categories)
                  ? TRACE_URBAN_FALLBACK_NOTICE
                  : "Switching to a working sister feed — primary stream unavailable")}
            </p>
          ) : (
            <p className="mt-4 text-base leading-relaxed text-gls-body">
              {item.description}
            </p>
          )}
          <p className="mt-3 text-sm text-gls-muted">
            {item.categories.join(" · ")} · Imported stream
          </p>
          <p className="mt-4 text-xs text-gls-muted">
            Manage sources in{" "}
            <Link href="/playlists/saved" className="text-white underline">
              Saved playlists
            </Link>
            .
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <div className="relative z-10 mt-10">
          <ContentRow
            title="More from this playlist"
            items={related}
            limit={24}
            viewMoreHref="/playlists"
            hrefPrefix="/watch/mine/"
          />
        </div>
      )}
    </main>
  );
}

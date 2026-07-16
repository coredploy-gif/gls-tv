"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { MyPlaylistHomeRow } from "@/components/MyPlaylistHomeRow";
import { TitleCard } from "@/components/TitleCard";
import { useLibrary } from "@/lib/library";
import { useActiveViewer } from "@/lib/membership/active-viewer";
import { writeLastChannel } from "@/lib/last-channel";
import { getChannelBySlug } from "@/lib/channels";
import {
  filterByCountry,
  getHub,
  getHubChannels,
  popularFirst,
  type HubKey,
} from "@/lib/hubs";
import type { CatalogItem } from "@/data/types";

type Props = {
  hubKey: HubKey;
  row: string;
};

export function CategoryMore({ hubKey, row }: Props) {
  const hub = getHub(hubKey);
  const params = useSearchParams();
  const country = params.get("country") || "all";
  const q = (params.get("q") || "").toLowerCase();

  const all = useMemo(() => popularFirst(getHubChannels(hubKey)), [hubKey]);
  let items = filterByCountry(all, country);
  if (q) {
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.categories.join(" ").toLowerCase().includes(q),
    );
  }
  if (row === "playable") {
    items = items.filter((i) => i.categories.includes("Playable"));
  } else if (row === "popular") {
    const popular = items.filter(
      (i) =>
        i.categories.includes("Popular") || i.categories.includes("Playable"),
    );
    items = popular.length ? popular : filterByCountry(all, country);
  }

  const title =
    row === "playable"
      ? `Playable · ${hub.title}`
      : row === "popular"
        ? `Popular · ${hub.title}`
        : `All · ${hub.title}`;

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <Link
          href={hub.href}
          className="text-sm text-gls-muted transition hover:text-white"
        >
          ← Back to {hub.title}
        </Link>
        <h1 className="gls-display mt-4 text-5xl text-white">{title}</h1>
        <p className="mt-2 text-sm text-gls-muted">
          {items.length} channels
          {country !== "all" ? ` · ${country.toUpperCase()}` : ""}
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <div key={item.id} className="w-full [&_a]:w-full">
              <TitleCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function HomeLibraryRows() {
  const lib = useLibrary();
  const continueItems = lib.continueWatching
    .map((c) => getChannelBySlug(c.slug))
    .filter((i): i is CatalogItem => Boolean(i));
  const myList = lib.myList
    .map((s) => getChannelBySlug(s))
    .filter((i): i is CatalogItem => Boolean(i));
  const favorites = lib.favorites
    .map((s) => getChannelBySlug(s))
    .filter((i): i is CatalogItem => Boolean(i));

  return (
    <>
      <MyPlaylistHomeRow />
      {continueItems.length > 0 && (
        <ContentRow
          title="Continue Watching"
          items={continueItems}
          onRemove={(slug) => lib.removeContinue(slug)}
          viewMoreHref="/my-list?tab=continue"
        />
      )}
      {myList.length > 0 && (
        <ContentRow title="My List" items={myList} viewMoreHref="/my-list" />
      )}
      {favorites.length > 0 && (
        <ContentRow
          title="My Favorites"
          items={favorites}
          viewMoreHref="/my-list?tab=favorites"
        />
      )}
    </>
  );
}

export function WatchLibrarySync({
  slug,
  title,
  poster,
  backdrop,
  href,
}: {
  slug: string;
  title: string;
  poster: string;
  backdrop: string;
  href?: string;
}) {
  const lib = useLibrary();
  const { viewer } = useActiveViewer();

  useEffect(() => {
    lib.addContinue({ slug, title, poster, backdrop, progress: 0 });
    if (viewer?.id) {
      writeLastChannel(viewer.id, {
        slug,
        title,
        href: href || `/watch/${encodeURIComponent(slug)}`,
        poster,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, viewer?.id]);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => lib.toggleMyList(slug)}
        className="gls-cta-ghost rounded-md px-4 py-2 text-sm"
      >
        {lib.inMyList(slug) ? "✓ On My List" : "+ My List"}
      </button>
      <button
        type="button"
        onClick={() => lib.toggleFavorite(slug)}
        className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:border-gls-pink/50 hover:bg-gls-pink/10"
      >
        {lib.inFavorites(slug) ? "♥ Favorited" : "♡ Favorite"}
      </button>
      <button
        type="button"
        onClick={() => lib.removeContinue(slug)}
        className="rounded-md border border-white/10 px-4 py-2 text-sm text-gls-muted transition hover:border-white/25 hover:text-white"
      >
        Remove from Continue
      </button>
    </div>
  );
}

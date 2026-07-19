"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { TitleCard } from "@/components/TitleCard";
import { ContentRow } from "@/components/ContentRow";
import { useLibrary } from "@/lib/library";
import { getChannelBySlug } from "@/lib/channels";
import type { CatalogItem } from "@/data/types";

type Tab = "list" | "favorites" | "continue";

export default function MyListClient() {
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "list";
  const [tab, setTab] = useState<Tab>(
    initial === "favorites" || initial === "continue" ? initial : "list",
  );
  const lib = useLibrary();

  const continueItems = useMemo(
    () =>
      lib.continueWatching
        .map((c) => getChannelBySlug(c.slug))
        .filter((i): i is CatalogItem => Boolean(i)),
    [lib.continueWatching],
  );

  const listItems = useMemo(
    () =>
      lib.myList
        .map((s) => getChannelBySlug(s))
        .filter((i): i is CatalogItem => Boolean(i)),
    [lib.myList],
  );

  const favItems = useMemo(
    () =>
      lib.favorites
        .map((s) => getChannelBySlug(s))
        .filter((i): i is CatalogItem => Boolean(i)),
    [lib.favorites],
  );

  const active =
    tab === "continue"
      ? continueItems
      : tab === "favorites"
        ? favItems
        : listItems;

  return (
    <main className="gls-below-nav min-h-screen bg-gls-black pb-20">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <h1 className="gls-display text-5xl text-white">My List</h1>
        <p className="mt-2 text-gls-muted">
          Saved titles, favorites, and continue watching.
        </p>

        <div className="mt-6 flex gap-2">
          {(
            [
              ["list", "My List"],
              ["favorites", "Favorites"],
              ["continue", "Continue"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === id
                  ? "bg-white text-black"
                  : "border border-white/20 text-gls-body"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "continue" && continueItems.length > 0 && (
          <div className="mt-8">
            <ContentRow
              title="Continue Watching"
              items={continueItems}
              onRemove={(slug) => lib.removeContinue(slug)}
              limit={24}
            />
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {active.map((item) => (
            <div key={item.id} className="relative w-full [&_a]:w-full">
              <TitleCard item={item} />
              {tab === "continue" && (
                <button
                  type="button"
                  onClick={() => lib.removeContinue(item.slug)}
                  className="absolute right-1 top-1 z-10 rounded bg-black/80 px-2 py-1 text-[10px] uppercase text-white hover:bg-gls-red"
                >
                  Remove
                </button>
              )}
              {tab === "list" && (
                <button
                  type="button"
                  onClick={() => lib.toggleMyList(item.slug)}
                  className="absolute right-1 top-1 z-10 rounded bg-black/80 px-2 py-1 text-[10px] uppercase text-white hover:bg-gls-red"
                >
                  Remove
                </button>
              )}
              {tab === "favorites" && (
                <button
                  type="button"
                  onClick={() => lib.toggleFavorite(item.slug)}
                  className="absolute right-1 top-1 z-10 rounded bg-black/80 px-2 py-1 text-[10px] uppercase text-white hover:bg-gls-red"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {!active.length && (
          <p className="mt-10 text-gls-muted">
            Nothing here yet. Play something or tap + My List on a title.{" "}
            <Link href="/browse" className="text-white underline">
              Browse Home
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

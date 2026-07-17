"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import { TitleCard } from "@/components/TitleCard";
import { getReligionChannels } from "@/lib/channels";
import {
  countriesFor,
  filterByCountry,
  popularFirst,
  ROW_LIMIT,
} from "@/lib/hubs";
import {
  getReligionChannelsForFolder,
  getReligionFolder,
  isReligionFolderKey,
  RELIGION_FOLDERS,
  type ReligionFolderKey,
} from "@/lib/religion";
import type { CatalogItem } from "@/data/types";

function FolderCard({
  title,
  blurb,
  emoji,
  href,
  count,
  comingSoon,
}: {
  title: string;
  blurb: string;
  emoji: string;
  href: string;
  count: number;
  comingSoon?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-sm border border-white/10 bg-gls-elevated/80 p-6 transition hover:border-gls-red/50 hover:bg-gls-elevated"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30 transition group-hover:opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 100% 0%, rgba(229,9,20,0.35), transparent 70%)",
        }}
      />
      <div className="relative">
        <span className="text-4xl" aria-hidden>
          {emoji}
        </span>
        <h2 className="gls-display mt-4 text-3xl text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gls-muted">{blurb}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gls-red">
          {comingSoon && count === 0
            ? "Coming soon"
            : `${count} channel${count === 1 ? "" : "s"}`}
        </p>
      </div>
    </Link>
  );
}

export function ReligionIndexHub() {
  const pool = useMemo(() => getReligionChannels(), []);
  const folderCounts = useMemo(
    () =>
      Object.fromEntries(
        RELIGION_FOLDERS.map((folder) => [
          folder.key,
          getReligionChannelsForFolder(pool, folder.key).length,
        ]),
      ) as Record<ReligionFolderKey, number>,
    [pool],
  );
  const hero =
    getReligionChannelsForFolder(pool, "islam").find((c) => c.featured) ??
    getReligionChannelsForFolder(pool, "islam")[0] ??
    pool[0];

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />
      {hero && <HeroBillboard item={hero} />}

      <div className="relative z-20 -mt-16 space-y-8 px-4 sm:px-8 lg:px-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gls-red">
            Religion
          </p>
          <h1 className="gls-display mt-1 text-4xl text-white sm:text-5xl">
            Religion
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gls-muted">
            Browse by faith — Islamic channels from Makkah and Madinah, Gospel
            ministry and music, and Hindu devotional (coming soon).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RELIGION_FOLDERS.map((folder) => (
            <FolderCard
              key={folder.key}
              title={folder.title}
              blurb={folder.blurb}
              emoji={folder.emoji}
              href={folder.href}
              count={folderCounts[folder.key]}
              comingSoon={folder.comingSoon}
            />
          ))}
        </div>

        {RELIGION_FOLDERS.map((folder) => {
          const items = getReligionChannelsForFolder(pool, folder.key);
          if (items.length === 0) return null;
          return (
            <ContentRow
              key={folder.key}
              title={`${folder.emoji} ${folder.title}`}
              items={popularFirst(items)}
              limit={ROW_LIMIT}
              viewMoreHref={folder.href}
            />
          );
        })}
      </div>
    </main>
  );
}

type FolderHubProps = {
  folderKey: ReligionFolderKey;
};

export function ReligionFolderHub({ folderKey }: FolderHubProps) {
  const folder = getReligionFolder(folderKey)!;
  const pool = useMemo(() => getReligionChannels(), []);
  const all = useMemo(
    () => popularFirst(getReligionChannelsForFolder(pool, folderKey)),
    [pool, folderKey],
  );
  const countries = useMemo(() => countriesFor(all), [all]);
  const [country, setCountry] = useState<string>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let list = filterByCountry(all, country);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.categories.join(" ").toLowerCase().includes(query),
      );
    }
    return list;
  }, [all, country, q]);

  const hero = all.find((c) => c.featured) ?? all[0];
  const playable = filtered.filter((i) => i.categories.includes("Playable"));
  const moreBase = `${folder.href}/more`;

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />
      {hero && <HeroBillboard item={hero} />}

      <div className="relative z-20 -mt-16 space-y-1">
        <div className="px-4 sm:px-8 lg:px-12">
          <Link
            href="/religion"
            className="text-sm text-gls-muted transition hover:text-white"
          >
            ← All Religion folders
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-gls-red">
            Religion · {folder.title}
          </p>
          <h1 className="gls-display mt-1 text-4xl text-white sm:text-5xl">
            {folder.emoji} {folder.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gls-muted">{folder.blurb}</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${folder.title.toLowerCase()}…`}
              className="w-full max-w-md rounded-sm border-0 bg-gls-elevated px-4 py-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-gls-muted focus:ring-gls-red"
            />
          </div>

          {countries.length > 0 && (
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => setCountry("all")}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  country === "all"
                    ? "bg-white text-black"
                    : "border border-white/20 text-gls-body hover:border-white"
                }`}
              >
                All countries
              </button>
              {countries.slice(0, 12).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCountry(c.code)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    country === c.code
                      ? "bg-white text-black"
                      : "border border-white/20 text-gls-body hover:border-white"
                  }`}
                >
                  {c.flag} {c.name} ({c.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="mx-4 mt-8 rounded-sm border border-white/10 bg-white/[0.03] px-6 py-16 text-center sm:mx-8 lg:mx-12">
            <p className="text-lg text-white/80">
              {folder.comingSoon
                ? "Verified Hindu channels coming soon."
                : "No channels match your filters yet."}
            </p>
            {folder.comingSoon && (
              <p className="mt-2 text-sm text-gls-muted">
                We only list official public streams once verified — check back
                later.
              </p>
            )}
          </div>
        ) : (
          <>
            {playable.length > 0 && (
              <ContentRow
                title="Playable in browser"
                items={playable}
                limit={ROW_LIMIT}
                viewMoreHref={`${moreBase}/playable?country=${country}`}
              />
            )}

            <ContentRow
              title={`All ${folder.title}`}
              items={filtered}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=${country}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            />
          </>
        )}
      </div>
    </main>
  );
}

type FolderMoreProps = {
  folderKey: ReligionFolderKey;
  row: string;
};

export function ReligionFolderMore({ folderKey, row }: FolderMoreProps) {
  const folder = getReligionFolder(folderKey)!;
  const pool = useMemo(() => getReligionChannels(), []);
  const params = useSearchParams();
  const country = params.get("country") || "all";
  const q = (params.get("q") || "").toLowerCase();

  let items = filterByCountry(
    popularFirst(getReligionChannelsForFolder(pool, folderKey)),
    country,
  );
  if (q) {
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.categories.join(" ").toLowerCase().includes(q),
    );
  }
  if (row === "playable") {
    items = items.filter((i) => i.categories.includes("Playable"));
  }

  const title =
    row === "playable"
      ? `Playable · ${folder.title}`
      : `All · ${folder.title}`;

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <Link
          href={folder.href}
          className="text-sm text-gls-muted transition hover:text-white"
        >
          ← Back to {folder.title}
        </Link>
        <h1 className="gls-display mt-4 text-5xl text-white">{title}</h1>
        <p className="mt-2 text-sm text-gls-muted">{items.length} channels</p>
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

export function parseReligionFolderParam(
  folder: string,
): ReligionFolderKey | null {
  return isReligionFolderKey(folder) ? folder : null;
}

export function folderPreviewItems(
  pool: CatalogItem[],
  folderKey: ReligionFolderKey,
  limit = 4,
): CatalogItem[] {
  return popularFirst(getReligionChannelsForFolder(pool, folderKey)).slice(
    0,
    limit,
  );
}

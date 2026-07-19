"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrowseNav } from "@/components/BrowseNav";
import { ContentRow } from "@/components/ContentRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import { MatchDayStrip } from "@/components/MatchDayStrip";
import { LeagueWatchGuide } from "@/components/LeagueWatchGuide";
import { useLibrary } from "@/lib/library";
import {
  countriesFor,
  filterByCountry,
  getHub,
  getHubChannels,
  popularFirst,
  type HubKey,
  ROW_LIMIT,
} from "@/lib/hubs";
import { getChannelBySlug, getWrestlingChannels, getAsiaSeries } from "@/lib/channels";
import { catalogFromSeed } from "@/lib/stream-seeds-catalog";
import { isLinearPayCategory } from "@/lib/linear-pay";
import type { CatalogItem } from "@/data/types";
import { getEnglishKidsTop10 } from "@/data/top10";

type Props = {
  hubKey: HubKey;
};

export function CategoryHub({ hubKey }: Props) {
  const hub = getHub(hubKey);
  const [seedExtras, setSeedExtras] = useState<CatalogItem[]>([]);
  const staticAll = useMemo(
    () => popularFirst(getHubChannels(hubKey)),
    [hubKey],
  );
  const all = useMemo(() => {
    if (!seedExtras.length) return staticAll;
    const map = new Map(staticAll.map((c) => [c.slug, c]));
    for (const s of seedExtras) {
      const prev = map.get(s.slug);
      if (!prev) map.set(s.slug, s);
      else if (s.sources[0]?.url) {
        map.set(s.slug, {
          ...prev,
          title: s.title || prev.title,
          sources: s.sources.length ? s.sources : prev.sources,
          categories: [
            ...new Set([
              ...prev.categories.filter((c) => c !== "NeedsUrl"),
              ...s.categories,
            ]),
          ],
        });
      }
    }
    return popularFirst([...map.values()]);
  }, [staticAll, seedExtras]);

  useEffect(() => {
    if (hubKey !== "sports") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/seeds");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const rows = (json.channels || []) as Array<{
          slug: string;
          title: string;
          url: string;
          categories?: string[];
          countries?: string[];
          poster?: string;
          backdrop?: string;
        }>;
        setSeedExtras(rows.map(catalogFromSeed));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hubKey]);

  const countries = useMemo(() => countriesFor(all), [all]);
  const [country, setCountry] = useState<string>("all");
  const [q, setQ] = useState("");

  const lib = useLibrary();

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

  const resolveSlugs = (slugs: string[]) =>
    slugs
      .map((s) => getChannelBySlug(s) || seedExtras.find((x) => x.slug === s))
      .filter((i): i is CatalogItem => Boolean(i))
      .filter((i) => hub.match(i) || hub.top10.some((t) => t.slug === i.slug));

  const continueItems = lib.continueWatching
    .map(
      (c) =>
        getChannelBySlug(c.slug) || seedExtras.find((x) => x.slug === c.slug),
    )
    .filter((i): i is CatalogItem => Boolean(i))
    .filter((i) => filtered.some((f) => f.slug === i.slug) || country === "all");

  const myListItems = resolveSlugs(lib.myList).filter((i) =>
    filtered.some((f) => f.slug === i.slug) || (!q && country === "all" && hub.match(i)),
  );
  const favoriteItems = resolveSlugs(lib.favorites).filter((i) =>
    filtered.some((f) => f.slug === i.slug) || (!q && country === "all" && hub.match(i)),
  );

  const playable = filtered.filter((i) => i.categories.includes("Playable"));
  const proxyOk = filtered.filter(
    (i) =>
      i.categories.includes("ProxyOk") && !i.categories.includes("Playable"),
  );
  const rightsManaged = filtered.filter((i) =>
    isLinearPayCategory(i.categories),
  );
  const popular = filtered.filter(
    (i) =>
      i.categories.includes("Popular") || i.categories.includes("Playable"),
  );
  const hero = hub.top10[0] ?? filtered[0] ?? all[0];

  const moreBase = `${hub.href}/more`;

  return (
    <main className="min-h-screen bg-gls-black pb-20">
      <BrowseNav />
      {hero && <HeroBillboard item={hero} />}

      <div className="relative z-20 -mt-16 space-y-1">
        {hubKey === "sports" && <MatchDayStrip />}
        {hubKey === "sports" && <LeagueWatchGuide />}

        <div className="px-4 sm:px-8 lg:px-12">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gls-red">
            {hub.title}
          </p>
          <h1 className="gls-display mt-1 text-4xl text-white sm:text-5xl">
            {hub.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gls-muted">{hub.blurb}</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${hub.title.toLowerCase()}…`}
              className="w-full max-w-md rounded-sm border-0 bg-gls-elevated px-4 py-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-gls-muted focus:ring-gls-red"
            />
            <Link
              href={`/search?q=${encodeURIComponent(hub.title)}`}
              className="text-sm text-gls-muted hover:text-white"
            >
              System search ›
            </Link>
          </div>

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
            {countries.slice(0, 16).map((c) => (
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
        </div>

        {continueItems.length > 0 && (
          <ContentRow
            title="Continue Watching"
            items={continueItems}
            limit={ROW_LIMIT}
            onRemove={(slug) => lib.removeContinue(slug)}
            viewMoreHref="/my-list?tab=continue"
          />
        )}

        {myListItems.length > 0 && (
          <ContentRow
            title="My List"
            items={myListItems}
            limit={ROW_LIMIT}
            viewMoreHref="/my-list"
          />
        )}

        {favoriteItems.length > 0 && (
          <ContentRow
            title="My Favorites"
            items={favoriteItems}
            limit={ROW_LIMIT}
            viewMoreHref="/my-list?tab=favorites"
          />
        )}

        {/* Kids hub: Popular first, then fixed English Top 10 under it */}
        {hubKey === "kids" ? (
          <>
            <ContentRow
              title="Popular"
              items={popular.length ? popular : filtered}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/popular?country=${country}`}
            />
            <ContentRow
              title="Top 10 Kids · English"
              items={getEnglishKidsTop10()}
              ranked
              limit={10}
              viewMoreHref="/kids"
            />
          </>
        ) : (
          <ContentRow
            title={`Top 10 ${hub.title}`}
            items={hub.top10}
            ranked
            limit={10}
          />
        )}

        {hubKey === "sports" && (
          <>
            <ContentRow
              title="Arena linear pay TV · official subscription required"
              items={rightsManaged}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?q=arena`}
            />
            <ContentRow
              title="Free football & sports · FIFA+ / beIN XTRA / FOX"
              items={popularFirst(
                filtered.filter((i) =>
                  /fifa\+|fifa plus|bein sports xtra|stadium|livenow from fox|fox weather|dd sports|alkass|sportitalia/i.test(
                    `${i.title} ${i.categories.join(" ")}`,
                  ),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?q=fifa`}
            />
            <ContentRow
              title="India · sports channels"
              items={popularFirst(
                filtered.filter(
                  (i) =>
                    i.countries.includes("in") ||
                    /star sports|dd sports|sports18|sony sports|eurosport india|jio sports/i.test(
                      `${i.title} ${i.categories.join(" ")}`,
                    ),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=in&q=sport`}
            />
            <ContentRow
              title="⚽ Soccer · FIFA+ / beIN XTRA / Alkass"
              items={popularFirst(
                filtered.filter((i) =>
                  /soccer|football|fifa|bein|alkass|tyc|gol |futbol|fútbol|stadium|shoof|xtra/i.test(
                    `${i.title} ${i.categories.join(" ")}`,
                  ),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?q=soccer`}
            />
            <ContentRow
              title="US · Fox / ESPN / Stadium (open FAST)"
              items={popularFirst(
                filtered.filter(
                  (i) =>
                    /fox|espn|tsn|stadium|ocho|bein|red bull|tennis|draft.?king|fuel|rally|fifa/i.test(
                      `${i.title} ${i.categories.join(" ")}`,
                    ) ||
                    i.countries.includes("us") ||
                    i.countries.includes("ca"),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=us&q=espn`}
            />
            <ContentRow
              title="Wrestling & combat"
              items={getWrestlingChannels().filter(
                (i) =>
                  country === "all" ||
                  i.countries.includes(country) ||
                  i.countries.includes("world"),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=${country}&q=wrestling`}
            />
          </>
        )}

        {hubKey === "asia" && (
          <>
            <ContentRow
              title="🇮🇳 India · news & entertainment"
              items={popularFirst(
                all.filter(
                  (i) =>
                    i.countries.includes("in") ||
                    /india|ndtv|news18|zee |etv|republic|aaj|wion|sansad/i.test(
                      i.title,
                    ),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=in`}
            />
            <ContentRow
              title="Korean & Asian series"
              items={getAsiaSeries().filter(
                (i) =>
                  country === "all" ||
                  i.countries.includes(country) ||
                  i.countries.includes("kr"),
              )}
              limit={ROW_LIMIT}
              viewMoreHref="/series"
            />
            <ContentRow
              title="Food · Asia"
              items={filtered.filter(
                (i) =>
                  i.categories.some((c) => /food|cook|chef|kitchen/i.test(c)) ||
                  /food|cook|chef|kitchen/i.test(i.title),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=${country}&q=food`}
            />
            <ContentRow
              title="Kids · Asia"
              items={filtered.filter(
                (i) =>
                  i.categories.some((c) =>
                    /kid|cartoon|animation|anime|family/i.test(c),
                  ) || /kid|cartoon|anime|baby/i.test(i.title),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=${country}&q=kids`}
            />
            <ContentRow
              title="Sports · Asia"
              items={filtered.filter(
                (i) =>
                  i.categories.some((c) => /sport/i.test(c)) ||
                  /sport/i.test(i.title),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=${country}&q=sport`}
            />
            <ContentRow
              title="News · Asia"
              items={filtered.filter(
                (i) =>
                  i.categories.some((c) => /news/i.test(c)) ||
                  /news/i.test(i.title),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=${country}&q=news`}
            />
          </>
        )}

        {hubKey !== "kids" && (
          <ContentRow
            title="Popular"
            items={popular.length ? popular : filtered}
            limit={ROW_LIMIT}
            viewMoreHref={`${moreBase}/popular?country=${country}`}
          />
        )}

        {/* Live TV: English kids Top 10 always under Popular */}
        {hubKey === "live" && (
          <ContentRow
            title="Top 10 Kids · English"
            items={getEnglishKidsTop10()}
            ranked
            limit={10}
            viewMoreHref="/kids"
          />
        )}

        {hubKey === "food" && (
          <ContentRow
            title="Food competitions"
            items={filtered.filter((i) =>
              /chef|competition|masterchef|iron|cook.?off|challenge|battle|chopped|champion/i.test(
                `${i.title} ${i.categories.join(" ")}`,
              ),
            )}
            limit={ROW_LIMIT}
            viewMoreHref={`${moreBase}/all?country=${country}&q=chef`}
          />
        )}

        {hubKey === "africa" && country === "all" && (
          <>
            <ContentRow
              title="🇿🇦 South Africa · SABC & news"
              items={popularFirst(
                all.filter(
                  (i) =>
                    i.countries.includes("za") ||
                    /sabc|etv|za news|ln24|soweto|cape town|tshwane|wildearth|hope channel/i.test(
                      i.title,
                    ),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?country=za`}
            />
            <ContentRow
              title="🎵 Trace Music · Africa & urban"
              items={popularFirst(
                all.filter(
                  (i) =>
                    i.categories.includes("Music") ||
                    /^trace\b/i.test(i.title),
                ),
              )}
              limit={ROW_LIMIT}
              viewMoreHref={`${moreBase}/all?q=trace`}
            />
          </>
        )}

        {playable.length > 0 && (
          <ContentRow
            title="Playable in browser"
            items={playable}
            limit={ROW_LIMIT}
            viewMoreHref={`${moreBase}/playable?country=${country}`}
          />
        )}

        {proxyOk.length > 0 && (
          <ContentRow
            title="More to explore"
            items={proxyOk}
            limit={ROW_LIMIT}
            viewMoreHref={`${moreBase}/all?country=${country}`}
          />
        )}

        <ContentRow
          title={country === "all" ? `All ${hub.title}` : `${hub.title} here`}
          items={filtered}
          limit={ROW_LIMIT}
          viewMoreHref={`${moreBase}/all?country=${country}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
        />

        {/* Country spotlight rows (Netflix-style) — pin ZA on Africa */}
        {country === "all" &&
          (() => {
            const ordered =
              hubKey === "africa"
                ? [
                    ...countries.filter((c) => c.code === "za"),
                    ...countries.filter((c) => c.code !== "za"),
                  ]
                : countries;
            return ordered.slice(0, hubKey === "africa" ? 6 : 4).map((c) => {
              const list = popularFirst(
                all.filter((i) => i.countries.includes(c.code)),
              );
              if (list.length < 3) return null;
              return (
                <ContentRow
                  key={c.code}
                  title={`${c.flag} ${c.name}`}
                  items={list}
                  limit={ROW_LIMIT}
                  viewMoreHref={`${moreBase}/all?country=${c.code}`}
                />
              );
            });
          })()}
      </div>
    </main>
  );
}

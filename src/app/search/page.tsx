"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { TitleCard } from "@/components/TitleCard";
import { TOP10 } from "@/data/top10";
import { getSearchIndex } from "@/lib/channels";
import {
  CATALOG_CATEGORIES,
  CATALOG_COUNTRIES,
} from "@/lib/catalog-facets";
import type { CatalogItem } from "@/data/types";

const ALL = getSearchIndex();

const HINT_CHIPS = [
  "ESPN",
  "Fox Sports",
  "TSN",
  "Vivo TV",
  "Survivor",
  "ducktv",
  "ETV",
  "Euronews",
  "The L Word",
  "Star Trek",
  "Walking Dead",
  "Euro",
  "beIN",
  "Tennis",
  "Red Bull",
];

function scoreItem(item: CatalogItem, q: string) {
  const title = item.title.toLowerCase();
  const cats = item.categories.join(" ").toLowerCase();
  const desc = item.description.toLowerCase();
  let score = 0;
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 50;
  if (title.includes(q)) score += 30;
  if (cats.includes(q)) score += 20;
  if (desc.includes(q)) score += 5;
  if (item.categories.includes("Popular")) score += 8;
  if (item.categories.includes("Verified") || item.id.startsWith("top-"))
    score += 10;
  return score;
}

function searchLocal(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of ALL) {
    if (seen.has(item.slug)) continue;
    const score = scoreItem(item, q);
    if (score <= 0) continue;
    seen.add(item.slug);
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 48)
    .map((x) => x.item);
}

function toCard(r: {
  slug: string;
  title: string;
  categories?: string[];
  countries?: string[];
  poster?: string;
}): CatalogItem {
  return {
    id: `db-${r.slug}`,
    slug: r.slug,
    title: r.title,
    type: "live",
    description: "iptv-org catalog",
    countries: r.countries || ["world"],
    categories: r.categories || ["IptvOrg"],
    languages: [],
    poster:
      r.poster ||
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=800&q=80",
    backdrop:
      r.poster ||
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1600&q=80",
    license: "open_stream",
    isLive: true,
    sources: [],
  };
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") || "");
  const [country, setCountry] = useState(params.get("country") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [remote, setRemote] = useState<CatalogItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const localResults = useMemo(() => {
    // Name search: only keep local hits that match title/slug (don't pollute with Popular pack)
    if (country || category) return [];
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return searchLocal(query).filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.slug.toLowerCase().includes(query.replace(/\s+/g, "-")) ||
        item.slug.toLowerCase().includes(query.replace(/\s+/g, "")),
    );
  }, [q, country, category]);

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (country) sp.set("country", country);
      if (category) sp.set("category", category);
      const next = sp.toString();
      const current = params.toString();
      if (next === current) return;
      router.replace(next ? `/search?${next}` : "/search", { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [q, country, category, params, router]);

  const fetchRemote = useCallback(
    async (nextOffset: number, append: boolean) => {
      const hasFilter = Boolean(q.trim() || country || category);
      if (!hasFilter) {
        setRemote([]);
        setHasMore(false);
        return;
      }
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (q.trim()) sp.set("q", q.trim());
        if (country) sp.set("country", country);
        if (category) sp.set("category", category);
        sp.set("limit", "48");
        sp.set("offset", String(nextOffset));
        const res = await fetch(`/api/catalog/search?${sp}`);
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json.channels || []) as Array<{
          slug: string;
          title: string;
          categories?: string[];
          countries?: string[];
          poster?: string;
        }>;
        const mapped = rows.map(toCard);
        setRemote((prev) => (append ? [...prev, ...mapped] : mapped));
        setOffset(nextOffset);
        setHasMore(mapped.length >= 48);
      } catch {
        if (!append) setRemote([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [q, country, category],
  );

  useEffect(() => {
    const t = setTimeout(() => void fetchRemote(0, false), 280);
    return () => clearTimeout(t);
  }, [fetchRemote]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const out: CatalogItem[] = [];
    // Prefer DB/seed hits first so heal overrides don't rename ESPN→Ocho in Find
    for (const item of [...remote, ...localResults]) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      out.push(item);
    }
    return out;
  }, [localResults, remote]);

  const browsing = Boolean(q.trim() || country || category);

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
      <h1 className="gls-display text-5xl text-white">Find a channel</h1>
      <p className="mt-2 max-w-2xl text-sm text-gls-body">
        Full iptv-org list (~13k) is here — filter by category/country or type
        the VLC name (e.g. <span className="text-white">Fox Sports 1</span>,{" "}
        <span className="text-white">TSN1</span>). Sports hub only shows curated
        FAST tiles; everything else is Find. If a channel was under
        “Undefined” in the playlist, use All categories or Uncategorized /
        type its name.
      </p>

      <div className="relative mt-6 max-w-2xl">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Channel name — e.g. TSN, BBC, SABC…"
          autoFocus
          className="w-full rounded-sm border-0 bg-gls-elevated px-5 py-4 text-lg text-white outline-none ring-1 ring-white/15 placeholder:text-gls-muted focus:ring-gls-red"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-gls-muted">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-w-[10rem] rounded border border-white/15 bg-gls-elevated px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-gls-red"
          >
            <option value="">All categories</option>
            {CATALOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-gls-muted">
          Country
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="min-w-[10rem] rounded border border-white/15 bg-gls-elevated px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-gls-red"
          >
            <option value="">All countries</option>
            {CATALOG_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {(q || country || category) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setCountry("");
              setCategory("");
            }}
            className="self-end rounded border border-white/20 px-3 py-2.5 text-sm text-gls-body hover:border-white hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {!browsing && (
        <>
          <div className="mt-8">
            <p className="text-sm text-gls-muted">Quick categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["Sports", "News", "Kids", "Movies", "Music", "Entertainment"] as const).map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gls-body transition hover:border-gls-red hover:text-white"
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="mt-6">
            <p className="text-sm text-gls-muted">Quick countries</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CATALOG_COUNTRIES.slice(0, 10).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCountry(c.code)}
                  className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gls-body transition hover:border-gls-red hover:text-white"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {HINT_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQ(chip)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gls-body transition hover:border-gls-red hover:text-white"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="mt-10 space-y-8">
            <p className="text-sm text-gls-muted">Popular on GLS (curated)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {[...TOP10.sports, ...TOP10.kids, ...TOP10.food]
                .filter((c) => c.categories.includes("Popular"))
                .slice(0, 10)
                .map((item) => (
                  <div key={item.id} className="w-full [&_a]:w-full">
                    <TitleCard item={item} />
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {browsing && (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {loading && results.length === 0
              ? Array.from({ length: 12 }, (_, i) => <div key={i} className="gls-skeleton aspect-[2/3] rounded-md" aria-hidden />)
              : results.map((item) => (
                  <div key={item.id} className="w-full [&_a]:w-full">
                    <TitleCard item={item} />
                  </div>
                ))}
          </div>
          {loading && (
            <p className="mt-6 text-sm text-gls-muted">Loading channels…</p>
          )}
          {!loading && results.length === 0 && (
            <div className="mt-8 max-w-md rounded-xl border border-white/10 bg-white/[0.035] p-6 text-gls-muted">
              <p className="font-medium text-white">Nothing matched this search</p>
              <p className="mt-2 text-sm">Try a shorter name, another spelling, or clear one of the filters.</p>
              <button type="button" onClick={() => { setQ(""); setCountry(""); setCategory(""); }} className="mt-4 text-sm font-semibold text-gls-pink-soft hover:text-white">Clear all filters</button>
              <p className="mt-3 text-sm">
              No matches
              {q ? ` for “${q}”` : ""}
              {category ? ` in ${category}` : ""}
              {country
                ? ` · ${CATALOG_COUNTRIES.find((c) => c.code === country)?.label || country}`
                : ""}
              .</p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <p className="mt-6 text-sm text-gls-muted">
              Showing {results.length}
              {hasMore ? "+" : ""} channels
              {category ? ` · ${category}` : ""}
              {country
                ? ` · ${CATALOG_COUNTRIES.find((c) => c.code === country)?.label || country}`
                : ""}
            </p>
          )}
          {hasMore && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void fetchRemote(offset + 48, true)}
              className="mt-4 rounded border border-white/25 px-5 py-2.5 text-sm text-white hover:border-white disabled:opacity-60"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}

      <Link
        href="/browse"
        className="mt-10 inline-block text-sm text-gls-muted hover:text-white"
      >
        ← Browse
      </Link>
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <Suspense fallback={null}>
        <SearchInner />
      </Suspense>
    </main>
  );
}

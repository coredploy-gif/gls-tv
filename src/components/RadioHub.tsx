"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogItem } from "@/data/types";
import { ContentRow } from "@/components/ContentRow";
import { getRadioStations } from "@/lib/radio";

const FILTERS = [
  { id: "all", label: "All stations" },
  { id: "za", label: "South Africa" },
  { id: "mw", label: "Malawi" },
  { id: "sabc", label: "SABC" },
  { id: "primedia", label: "Primedia" },
  { id: "community", label: "Community" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matchesFilter(station: CatalogItem, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "za") return station.countries.includes("za");
  if (filter === "mw") return station.countries.includes("mw");
  if (filter === "sabc") {
    return station.categories.some((c) => /sabc/i.test(c));
  }
  if (filter === "primedia") {
    return station.categories.some((c) => /primedia/i.test(c));
  }
  return station.categories.some((c) => /community/i.test(c));
}

export function RadioHub() {
  const stations = getRadioStations();
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stations.filter((station) => {
      if (!matchesFilter(station, filter)) return false;
      if (!needle) return true;
      return (
        station.title.toLowerCase().includes(needle) ||
        station.description.toLowerCase().includes(needle) ||
        station.categories.some((c) => c.toLowerCase().includes(needle))
      );
    });
  }, [stations, filter, q]);

  const sabc = filtered.filter((s) => matchesFilter(s, "sabc"));
  const malawi = filtered.filter((s) => s.countries.includes("mw"));
  const southAfrica = filtered.filter(
    (s) => s.countries.includes("za") && !matchesFilter(s, "sabc"),
  );
  const other = filtered.filter(
    (s) => !s.countries.includes("mw") && !matchesFilter(s, "sabc") && !s.countries.includes("za"),
  );

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,90,106,0.55), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 pt-28 sm:px-8 lg:px-12 lg:pt-24">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gls-pink/80">
            South Africa
          </p>
          <h1 className="gls-display mt-2 text-4xl text-white sm:text-5xl">
            Radio
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/65">
            Curated legal live streams from official broadcasters — SABC, Primedia,
            MBC Malawi, and community stations. Tap a station to listen in the GLS
            player.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  filter === f.id
                    ? "border-gls-red/60 bg-gls-red/20 text-white"
                    : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search stations</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stations…"
              className="w-full rounded-sm border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-gls-pink/50 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-10 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-sm border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
              <p className="text-white/70">No stations match your search.</p>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setFilter("all");
                }}
                className="mt-4 text-sm font-semibold text-gls-pink hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : filter === "all" && !q.trim() ? (
            <>
              {malawi.length > 0 && (
                <ContentRow
                  title="🇲🇼 Malawi · MBC"
                  items={malawi}
                  limit={24}
                />
              )}
              {sabc.length > 0 && (
                <ContentRow
                  title="SABC national & regional"
                  items={sabc}
                  limit={24}
                />
              )}
              {southAfrica.length > 0 && (
                <ContentRow
                  title="More South African radio"
                  items={southAfrica}
                  limit={24}
                />
              )}
              {other.length > 0 && (
                <ContentRow
                  title="More stations"
                  items={other}
                  limit={24}
                />
              )}
            </>
          ) : (
            <ContentRow title="Stations" items={filtered} limit={24} />
          )}
        </div>

        <p className="mt-12 max-w-3xl text-sm leading-relaxed text-white/45">
          Streams are sourced from official broadcaster endpoints (StreamTheWorld /
          station CDNs). If a station changes its stream URL, staff can refresh it
          via{" "}
          <Link href="/admin/links" className="text-gls-pink/80 hover:underline">
            Admin → Links
          </Link>{" "}
          under the Radio category.
        </p>
      </div>
    </div>
  );
}

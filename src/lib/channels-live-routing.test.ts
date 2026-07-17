import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/data/types";
import {
  getLiveMovieChannels,
  getLiveSeriesChannels,
  getLiveTvChannels,
  getMovieChannels,
  getSeriesChannels,
  isLiveTvEligible,
  isMovieFast,
  isSeriesFast,
} from "@/lib/channels";

function stub(partial: Partial<CatalogItem> & Pick<CatalogItem, "slug" | "title" | "type">): CatalogItem {
  return {
    id: partial.id || `test-${partial.slug}`,
    description: partial.description || "",
    countries: partial.countries || ["us"],
    categories: partial.categories || [],
    languages: partial.languages || ["en"],
    poster: partial.poster || "",
    backdrop: partial.backdrop || "",
    license: partial.license || "open_stream",
    sources: partial.sources || [],
    isLive: partial.isLive,
    ...partial,
  };
}

describe("live vs movies/series FAST routing", () => {
  it("classifies movie FASTs for /movies", () => {
    const movie = stub({
      slug: "plutotvhorror-us-us",
      title: "Pluto TV Horror",
      type: "live",
      categories: ["Movies", "Entertainment"],
      isLive: true,
    });
    expect(isMovieFast(movie)).toBe(true);
    expect(isSeriesFast(movie)).toBe(false);
    expect(isLiveTvEligible(movie)).toBe(false);
  });

  it("classifies series FASTs for /series", () => {
    const series = stub({
      slug: "the-l-word",
      title: "The L Word",
      type: "series",
      categories: ["Series", "LiveSeries", "24/7"],
      isLive: true,
    });
    expect(isSeriesFast(series)).toBe(true);
    expect(isMovieFast(series)).toBe(false);
    expect(isLiveTvEligible(series)).toBe(false);
  });

  it("keeps news live TV eligible", () => {
    const news = stub({
      slug: "nasa-tv-public",
      title: "NASA TV Public",
      type: "live",
      categories: ["News", "Documentary"],
      isLive: true,
    });
    expect(isLiveTvEligible(news)).toBe(true);
    expect(isMovieFast(news)).toBe(false);
    expect(isSeriesFast(news)).toBe(false);
  });

  it("does not treat news mis-tags as series", () => {
    const zee = stub({
      slug: "zeenews-in-sd",
      title: "Zee News",
      type: "live",
      categories: ["News", "Series"],
      isLive: true,
    });
    // Category Series alone still marks series FAST (explicit Series tag).
    // News-primary without Series category stays out:
    const newsDrama = stub({
      slug: "zee24taas-in-sd",
      title: "Zee 24 Taas",
      type: "live",
      categories: ["News", "Drama"],
      isLive: true,
    });
    expect(isSeriesFast(newsDrama)).toBe(false);
    expect(isLiveTvEligible(newsDrama)).toBe(true);
    expect(isSeriesFast(zee)).toBe(true);
  });

  it("surfaces movie and series pools and strips them from live TV pool", () => {
    const movies = getMovieChannels();
    const series = getSeriesChannels();
    const live = getLiveTvChannels();
    const liveMovies = getLiveMovieChannels();
    const liveSeries = getLiveSeriesChannels();

    expect(movies.length).toBeGreaterThan(20);
    expect(series.length).toBeGreaterThan(20);
    expect(liveMovies.length).toBeGreaterThan(10);
    expect(liveSeries.length).toBeGreaterThan(10);

    expect(live.some(isMovieFast)).toBe(false);
    expect(live.some(isSeriesFast)).toBe(false);
    expect(live.every(isLiveTvEligible)).toBe(true);
  });
});

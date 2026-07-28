import { describe, expect, it } from "vitest";
import {
  RED_BULL_TV_SLUG,
  firstOfComingMonth,
  isRedBullOnlySlug,
  pathAllowedForRedBullOnly,
} from "@/lib/membership/exception-grace";

describe("exception-grace", () => {
  it("computes the 1st of the coming month in UTC", () => {
    const from = new Date(Date.UTC(2026, 6, 28, 22, 0, 0)); // 28 Jul
    const next = firstOfComingMonth(from);
    expect(next.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("recognises Red Bull slugs", () => {
    expect(isRedBullOnlySlug(RED_BULL_TV_SLUG)).toBe(true);
    expect(isRedBullOnlySlug("redbulltv-at-sd")).toBe(true);
    expect(isRedBullOnlySlug("tsn-1")).toBe(false);
  });

  it("allows pricing and Red Bull watch for restricted members", () => {
    expect(pathAllowedForRedBullOnly("/pricing")).toBe(true);
    expect(pathAllowedForRedBullOnly("/watch/red-bull-tv")).toBe(true);
    expect(pathAllowedForRedBullOnly("/watch/tsn-1")).toBe(false);
    expect(pathAllowedForRedBullOnly("/browse")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { readTvOverrideFromSearch } from "./tv-detect";

describe("tv-detect helpers", () => {
  it("reads tv=1 override from search strings", () => {
    expect(readTvOverrideFromSearch("?tv=1")).toBe(true);
    expect(readTvOverrideFromSearch("tv=1&next=/profiles")).toBe(true);
    expect(readTvOverrideFromSearch("?tv=0")).toBe(false);
    expect(readTvOverrideFromSearch("")).toBe(false);
    expect(readTvOverrideFromSearch(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { getCountry } from "@/data/catalog";
import { getChannelBySlug, getLiveTvByCountry } from "@/lib/channels";

describe("MENA live country hubs", () => {
  it("registers sa, ae, tr in COUNTRIES", () => {
    expect(getCountry("sa")?.name).toMatch(/Saudi/i);
    expect(getCountry("ae")?.name).toMatch(/Emirates|UAE/i);
    expect(getCountry("tr")?.name).toMatch(/Turkey/i);
  });

  it("seeds Saudi public news + religion", () => {
    const titles = getLiveTvByCountry("sa").map((c) => c.title);
    expect(titles).toEqual(expect.arrayContaining(["Al Ekhbariya", "Al Quran Al Kareem TV"]));
    expect(titles.length).toBeGreaterThanOrEqual(7);
  });

  it("seeds UAE public news + MBC 5", () => {
    const titles = getLiveTvByCountry("ae").map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Al Arabiya", "Sky News Arabia", "MBC 5"]),
    );
    expect(titles.length).toBeGreaterThanOrEqual(5);
  });

  it("seeds Turkey TRT public + A Spor; Mekameleen not Turkey", () => {
    const titles = getLiveTvByCountry("tr").map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining(["TRT World", "TRT Haber", "A Spor"]),
    );
    expect(titles.some((t) => /mekameleen/i.test(t))).toBe(false);
    expect(getChannelBySlug("mekameleentv-tr-sd")?.countries).toContain("eg");
    expect(titles.length).toBeGreaterThanOrEqual(7);
  });
});

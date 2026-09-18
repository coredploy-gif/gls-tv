import { describe, expect, it } from "vitest";
import { databaseSearchQuery, normalizeSearchText, searchQueryTerms } from "./search-aliases";

describe("search aliases", () => {
  it("normalizes compact channel numbers", () => {
    expect(normalizeSearchText("TSN1 HD")).toBe("tsn 1 hd");
    expect(databaseSearchQuery("ESPN8")).toBe("espn 8");
  });

  it("expands common sport names", () => {
    expect(searchQueryTerms("football")).toContain("soccer");
    expect(searchQueryTerms("Formula One")).toContain("f 1");
  });

  it("ignores accents and punctuation", () => {
    expect(normalizeSearchText("Fútbol+ TV")).toBe("futbol tv");
  });
});

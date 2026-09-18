const ALIASES: Record<string, string[]> = {
  football: ["soccer", "futbol", "fútbol"],
  soccer: ["football", "futbol", "fútbol"],
  rugby: ["rugby union", "rugby league"],
  racing: ["motorsport", "motor sport", "formula 1", "f1"],
  "formula one": ["formula 1", "f1", "motorsport"],
  news: ["live news", "breaking news"],
  kids: ["children", "family", "animation"],
};

/** Comparable search text: case/accent/punctuation agnostic and channel-number friendly. */
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchQueryTerms(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return [...new Set([normalized, ...(ALIASES[normalized] || []).map(normalizeSearchText)])];
}

/** Best database query while retaining number separation (TSN1 → TSN 1). */
export function databaseSearchQuery(query: string) {
  return searchQueryTerms(query)[0] || "";
}

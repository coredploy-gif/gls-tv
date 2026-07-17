const pages = [
  "https://radio.securenetsystems.net/cwa/ZNBC",
  "https://radio.securenetsystems.net/cwa/ZNBC1",
  "https://radio.securenetsystems.net/cwa/0079",
];

for (const page of pages) {
  try {
    const res = await fetch(page, {
      headers: { "User-Agent": "Mozilla/5.0 GLS-TV-Probe/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const ice = [...html.matchAll(/https?:\/\/ice\d+\.securenetsystems\.net\/[A-Za-z0-9_/-]+/gi)].map(
      (m) => m[0],
    );
    const uniq = [...new Set(ice)];
    console.log(`\n=== ${page} ===`);
    console.log(uniq.join("\n") || "(no ice URLs in HTML)");
  } catch (e) {
    console.log(`\n=== ${page} === FAIL ${e.message}`);
  }
}

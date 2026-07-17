const pages = [
  ["radiobotswana", "https://www.radiobotswana.gov.bw/"],
  ["lnbs-radio", "https://lnbs.gov.ls/radio-lesotho"],
  ["znbc-live", "https://znbc.co.zm/znbc-media/?page_id=3826"],
  ["ebc-live", "https://www.ebc.et/Home/Live"],
  ["cloudsfm", "https://cloudsfm.co.tz/"],
  ["tbc-bongo", "https://www.tbc.go.tz/station.html?station=bongofm"],
  ["rtnc-direct", "https://rtnc.cd/direct/"],
  ["radiomuqdisho", "https://radiomuqdisho.so/"],
];

for (const [name, page] of pages) {
  try {
    const res = await fetch(page, {
      headers: { "User-Agent": "Mozilla/5.0 GLS-TV-Probe/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const urls = [
      ...html.matchAll(/https?:\/\/[^\s"'<>]+\.(?:mp3|m3u8|aac|pls|m3u)(?:\?[^\s"'<>]*)?/gi),
      ...html.matchAll(/https?:\/\/(?:ice\d+|eu\d+|stream|radio|live)[^\s"'<>]+/gi),
      ...html.matchAll(/<source[^>]+src=["']([^"']+)["']/gi),
      ...html.matchAll(/<audio[^>]+src=["']([^"']+)["']/gi),
    ].flatMap((m) => (m[1] ? [m[1]] : [m[0]]));
    const uniq = [...new Set(urls.map((u) => u.replace(/\\u0026/g, "&")))].slice(0, 20);
    console.log(`\n=== ${name} (${res.status}) ===`);
    console.log(uniq.join("\n") || "(no stream URLs found)");
  } catch (e) {
    console.log(`\n=== ${name} FAIL === ${e.message}`);
  }
}

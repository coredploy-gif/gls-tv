const UA = "GLS-TV-Probe/1.0";

async function probe(url) {
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if ([403, 405, 501].includes(res.status)) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": UA, Range: "bytes=0-0" },
        signal: AbortSignal.timeout(12000),
      });
    }
    return { url, status: res.status, type: res.headers.get("content-type") ?? "" };
  } catch (e) {
    return { url, status: "fail", type: String(e.cause?.code ?? e.message).slice(0, 40) };
  }
}

const urls = [
  // Tanzania — Clouds Media official fastcast4u (cloudsfm.co.tz player)
  "http://eu6.fastcast4u.com:5306/",
  "http://eu6.fastcast4u.com:5308/",
  // Botswana — try gov site patterns + Yarona/Duma
  "https://ice31.securenetsystems.net/YARONAFM",
  "https://ice31.securenetsystems.net/DUMAFM",
  "https://ice31.securenetsystems.net/RB1",
  "https://ice31.securenetsystems.net/RB2",
  "https://ice31.securenetsystems.net/RADIOBOTSWANA",
  // Zambia ZNBC mounts (from player hunt)
  "https://ice31.securenetsystems.net/ZNBC",
  "https://ice31.securenetsystems.net/ZNBC1",
  "https://ice31.securenetsystems.net/ZNBCFM1",
  "https://ice31.securenetsystems.net/ZNBCFM",
  "https://ice31.securenetsystems.net/ZNBC_R1",
  // Lesotho
  "https://ice31.securenetsystems.net/RADIOLESOTHO",
  "https://ice31.securenetsystems.net/HARVESTFM",
  "https://ice31.securenetsystems.net/ULTIMATERADIO",
  // Ethiopia EBC
  "https://ice31.securenetsystems.net/EBC",
  "https://ice31.securenetsystems.net/ENR",
  // Somalia
  "https://ice31.securenetsystems.net/RADIOMUQDISHO",
  "https://ice31.securenetsystems.net/MUQDISHO",
  // DRC
  "https://ice31.securenetsystems.net/RTNC",
  "https://ice31.securenetsystems.net/RADIOOKAPI",
  // Congo Brazzaville
  "https://ice31.securenetsystems.net/RADIOCONGO",
  "https://ice31.securenetsystems.net/ORTM",
  // Heals
  "http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1",
  "http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1",
  "https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8",
  "https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8",
];

const results = await Promise.all(urls.map(probe));
for (const r of results.sort((a, b) => String(a.status).localeCompare(String(b.status)))) {
  const mark = r.status === 200 ? "PASS" : r.status === "fail" ? "FAIL" : String(r.status);
  console.log(`${mark}|${r.type}| ${r.url}`);
}

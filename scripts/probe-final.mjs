const UA = "GLS-TV-Probe/1.0";

async function probe(url) {
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if ([403, 405, 501].includes(res.status)) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": UA, Range: "bytes=0-0" },
        signal: AbortSignal.timeout(15000),
      });
    }
    return `${res.status}|${res.headers.get("content-type") ?? ""}| ${url}`;
  } catch (e) {
    return `fail|${String(e.cause?.code ?? e.message).slice(0, 50)}| ${url}`;
  }
}

const urls = [
  // NEW verified from official pages
  "http://168.167.134.26:8000/rb",
  "http://168.167.134.26:8000/rb2",
  "https://rtnc.cd/live/rtnclive.m3u8",
  "https://ap02.iqplay.tv:8082/ra4iomo6.aac",
  "https://ap02.iqplay.tv:8082/iqb8002/s4ne/playlist.m3u8",
  // Tanzania
  "http://eu6.fastcast4u.com:5306/",
  "http://eu6.fastcast4u.com:5308/",
  // Heals
  "http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1",
  "http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1",
  "https://ice31.securenetsystems.net/0079",
  "https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8",
  "https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8",
  "https://playerservices.streamtheworld.com/api/livestream-redirect/METROFM.mp3",
  "https://playerservices.streamtheworld.com/api/livestream-redirect/5FM.mp3",
  "https://atunwadigital.streamguys1.com/capitalfm",
  "https://coolfmlagos969-atunwadigital.streamguys1.com/coolfmlagos969",
  "https://peacefm-atunwadigital.streamguys1.com/peacefm",
  "https://mainradiostreaming.zbc.co.zw:8020/national.mp3",
  "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8",
  "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8",
];

for (const line of await Promise.all(urls.map(probe))) console.log(line);

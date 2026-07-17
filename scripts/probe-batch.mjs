const urls = process.argv.slice(2);
const UA = "GLS-TV-Probe/1.0";

async function probe(url) {
  const ctrl = AbortSignal.timeout(12000);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": UA }, signal: ctrl });
    if ([403, 405, 501].includes(res.status)) {
      res = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": UA, Range: "bytes=0-0" }, signal: ctrl });
    }
    return `${res.status}|${res.headers.get("content-type") ?? ""}| ${url}`;
  } catch (e) {
    const msg = String(e.cause?.code ?? e.message).slice(0, 55);
    return `fail|${msg}| ${url}`;
  }
}

const list = urls.length ? urls : [
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
  "http://eu6.fastcast4u.com:5306/",
  "https://rrsatrtmp.tulix.tv/addis1/addis1multi.smil/playlist.m3u8",
  "https://ap02.iqplay.tv:8082/iqb8002/s4ne/playlist.m3u8",
  "https://ap02.iqplay.tv:8082/iqb8002/s2tve/playlist.m3u8",
  "https://radio.okapi.org/radio.mp3",
  "https://stream.zeno.fm/0r0qx5k5hzzuv",
  "https://ice42.securenetsystems.net/GABZFM",
  "https://ice31.securenetsystems.net/GABZFM",
];

const results = await Promise.all(list.map(probe));
for (const line of results) console.log(line);

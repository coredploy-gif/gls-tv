process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "GLS-TV/1.0" } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return get(res.headers.location).then(resolve, reject);
        }
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}

const root = path.join(__dirname, "..");
const cache = path.join(root, "data-cache");
fs.mkdirSync(cache, { recursive: true });

const feeds = [
  ["sports", "https://iptv-org.github.io/iptv/categories/sports.m3u"],
  ["us", "https://iptv-org.github.io/iptv/countries/us.m3u"],
  ["kids", "https://iptv-org.github.io/iptv/categories/kids.m3u"],
  ["animation", "https://iptv-org.github.io/iptv/categories/animation.m3u"],
  ["cooking", "https://iptv-org.github.io/iptv/categories/cooking.m3u"],
];

for (const [name, url] of feeds) {
  const text = await get(url);
  fs.writeFileSync(path.join(cache, `${name}.m3u`), text);
  const count = (text.match(/^#EXTINF/gm) || []).length;
  console.log(`Downloaded ${name}: ${count} channels`);
}

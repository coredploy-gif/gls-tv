/**
 * Rasterize public/icon.svg → PWA / Apple / favicon PNGs.
 * Uses sharp if available (Next.js dependency), else @resvg/resvg-js.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "public", "icon.svg");
const svg = readFileSync(svgPath);

async function loadRenderer() {
  try {
    const sharp = (await import("sharp")).default;
    return {
      name: "sharp",
      async render(size, outPath, { pad = 0 } = {}) {
        let pipeline = sharp(svg).resize(size, size, {
          fit: "contain",
          background: { r: 10, g: 10, b: 14, alpha: 1 },
        });
        if (pad > 0) {
          const inner = Math.round(size * (1 - pad * 2));
          pipeline = sharp(svg)
            .resize(inner, inner, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .extend({
              top: Math.round(size * pad),
              bottom: Math.round(size * pad),
              left: Math.round(size * pad),
              right: Math.round(size * pad),
              background: { r: 10, g: 10, b: 14, alpha: 1 },
            });
        }
        await pipeline.png().toFile(outPath);
      },
    };
  } catch {
    const { Resvg } = await import("@resvg/resvg-js");
    return {
      name: "resvg",
      async render(size, outPath, { pad = 0 } = {}) {
        const resvg = new Resvg(svg, {
          fitTo: { mode: "width", value: size },
          background: "rgba(10,10,14,1)",
        });
        const png = resvg.render().asPng();
        writeFileSync(outPath, png);
        if (pad > 0) {
          // resvg path: simple full-bleed is fine for maskable fallback
        }
      },
    };
  }
}

const targets = [
  { file: "favicon-32.png", size: 32 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-1024.png", size: 1024 },
  { file: "apple-touch-icon.png", size: 180 },
  // Maskable: extra safe-zone padding so Android doesn't crop the wordmark
  { file: "icon-maskable-512.png", size: 512, pad: 0.12 },
];

const renderer = await loadRenderer();
console.log(`Rendering icons with ${renderer.name}…`);

for (const t of targets) {
  const out = join(root, "public", t.file);
  await renderer.render(t.size, out, { pad: t.pad || 0 });
  console.log(`  wrote ${t.file} (${t.size}px)`);
}

console.log("Done.");

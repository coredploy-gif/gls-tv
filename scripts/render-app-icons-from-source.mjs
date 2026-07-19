/**
 * Build all app icons from the Gemini glass wordmark (public/icon-source.png or argv).
 * Trims, squares, removes bottom-right sparkle, exports all PWA sizes.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSrc = join(
  process.env.USERPROFILE || "",
  ".cursor/projects/d-GLS-TV-gls-tv/assets/c__Users_Work_Machine_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Gemini_Generated_Image_57d3vy57d3vy57d3-a096d5ce-5f69-4a73-8f60-c3aa1ed35d2a.png",
);
const srcPath = process.argv[2] || defaultSrc;

async function prepareMaster(src) {
  let buf = await sharp(src)
    .rotate()
    .trim({ background: "#ffffff", threshold: 18 })
    .toBuffer();

  const m = await sharp(buf).metadata();
  const side = Math.max(m.width || 1024, m.height || 1024);
  buf = await sharp(buf)
    .resize(side, side, {
      fit: "contain",
      background: { r: 12, g: 10, b: 12, alpha: 1 },
    })
    .resize(1024, 1024, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = buf;
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  // Find brightest spark in bottom-right
  let maxLum = 0;
  let maxX = Math.floor(width * 0.95);
  let maxY = Math.floor(height * 0.9);
  for (let y = Math.floor(height * 0.7); y < height; y++) {
    for (let x = Math.floor(width * 0.7); x < width; x++) {
      const i = (y * width + x) * channels;
      const lum = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
      if (lum > maxLum) {
        maxLum = lum;
        maxX = x;
        maxY = y;
      }
    }
  }

  // Sample dark paint from mid-right (avoid spark)
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = 700; y < 820; y++) {
    for (let x = 780; x < 880; x++) {
      const i = (y * width + x) * channels;
      sr += out[i];
      sg += out[i + 1];
      sb += out[i + 2];
      n += 1;
    }
  }
  const br = Math.round(sr / n);
  const bg = Math.round(sg / n);
  const bb = Math.round(sb / n);

  const R = 110;
  for (let y = maxY - R; y <= maxY + R; y++) {
    for (let x = maxX - R; x <= maxX + R; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const d = Math.hypot(x - maxX, y - maxY);
      if (d > R) continue;
      const t = Math.min(1, (R - d) / 28);
      const i = (y * width + x) * channels;
      out[i] = Math.round(out[i] * (1 - t) + br * t);
      out[i + 1] = Math.round(out[i + 1] * (1 - t) + bg * t);
      out[i + 2] = Math.round(out[i + 2] * (1 - t) + bb * t);
    }
  }

  for (let y = Math.floor(height * 0.75); y < height; y++) {
    for (let x = Math.floor(width * 0.78); x < width; x++) {
      const i = (y * width + x) * channels;
      const lum = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
      if (lum > 60) {
        out[i] = br;
        out[i + 1] = bg;
        out[i + 2] = bb;
      }
    }
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

const master = await prepareMaster(srcPath);
const publicDir = join(root, "public");
writeFileSync(join(publicDir, "icon-source.png"), master);

const targets = [
  { file: "favicon-32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-1024.png", size: 1024 },
];

for (const t of targets) {
  await sharp(master)
    .resize(t.size, t.size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, t.file));
  console.log("wrote", t.file);
}

const inner = Math.round(512 * 0.76);
await sharp(master)
  .resize(inner, inner, {
    fit: "contain",
    background: { r: 12, g: 10, b: 12, alpha: 1 },
  })
  .extend({
    top: Math.round((512 - inner) / 2),
    bottom: Math.round((512 - inner) / 2),
    left: Math.round((512 - inner) / 2),
    right: Math.round((512 - inner) / 2),
    background: { r: 12, g: 10, b: 12, alpha: 1 },
  })
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(join(publicDir, "icon-maskable-512.png"));
console.log("wrote icon-maskable-512.png");
console.log("done");

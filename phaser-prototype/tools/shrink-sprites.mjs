// Shrinks the few huge source paintings whose on-screen size is a small
// fraction of their pixels, so a phone does not have to decode (and keep in
// memory) tens of megabytes it never shows.
//
//   node tools/shrink-sprites.mjs
//
// Reads the full-size originals in art-source/ (not deployed) and writes the
// small versions the game loads into public/assets/. Each scene multiplies its
// scale for these textures by the `factor` below, so they are drawn exactly
// the size they were; the factors are chosen to keep at least ~3 texture
// pixels per on-screen pixel at design size (enough for a 3x phone screen).
// New folders (-v2/-v3) are used on purpose: art is cached for a week, and an
// old file name must never be paired with new scale numbers.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// kernel: "lanczos3" for painted art, "nearest" to reproduce the blocky
// pixel look the scene used to make at load time (a 4x nearest-neighbour shrink).
const JOBS = [
  { from: "stage1/snow-tile.png", to: "stage1-v3/snow-tile.png", factor: 1.5, kernel: "lanczos3" },
  { from: "stage3-v1/bee-hive.png", to: "stage3-v2/bee-hive.png", factor: 8, kernel: "lanczos3" },
  { from: "stage3-v1/bird-nest.png", to: "stage3-v2/bird-nest.png", factor: 6, kernel: "lanczos3" },
  { from: "stage3-v1/turtle.png", to: "stage3-v2/turtle.png", factor: 4, kernel: "lanczos3" },
  { from: "stage3-v1/songbird.png", to: "stage3-v2/songbird.png", factor: 8, kernel: "lanczos3" },
  { from: "stage3-v1/flying-songbird.png", to: "stage3-v2/flying-songbird.png", factor: 8, kernel: "lanczos3" },
  { from: "stage3-v1/honey-bee.png", to: "stage3-v2/honey-bee.png", factor: 16, kernel: "lanczos3" },
  { from: "stage4-v1/sakura-midground.png", to: "stage4-v2/sakura-midground.png", factor: 4, kernel: "nearest" },
  { from: "stage4-v1/fallen-petals.png", to: "stage4-v2/fallen-petals.png", factor: 4, kernel: "nearest" }
];

for (const job of JOBS) {
  const source = sharp(join(root, "art-source", job.from));
  const { width, height } = await source.metadata();
  const w = Math.max(1, Math.round(width / job.factor));
  const h = Math.max(1, Math.round(height / job.factor));
  const out = join(root, "public", "assets", job.to);
  await mkdir(dirname(out), { recursive: true });
  const info = await source.resize(w, h, { kernel: job.kernel }).png({ compressionLevel: 9, effort: 10 }).toFile(out);
  console.log(`${job.to}: ${width}x${height} -> ${w}x${h}  (x${job.factor}, ${Math.round(info.size / 1024)} KB)`);
}

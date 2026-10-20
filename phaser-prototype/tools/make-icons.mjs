// Draws the app icon (a sprout on the game's greens) and writes the sizes a
// phone needs into public/icons/:
//
//   node tools/make-icons.mjs
//
// icon-192.png, icon-512.png      the "any" icons in the web app manifest
// icon-maskable-512.png           the same picture with room around it, for
//                                 Android, which crops icons to its own shapes
// apple-touch-icon.png (180)      what iOS uses for "Add to Home Screen"
//
// The corners are not rounded: iOS and Android round them themselves.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// The picture is drawn on a 512 x 512 square. `scale` shrinks it towards the
// middle (the maskable icon keeps everything inside the circle a phone crops to).
const svg = (scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8ccb63"/>
      <stop offset="1" stop-color="#3f7b3b"/>
    </linearGradient>
    <radialGradient id="sun" cx=".3" cy=".22" r=".75">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".34"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#94673f"/>
      <stop offset="1" stop-color="#6d4829"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <rect width="512" height="512" fill="url(#sun)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <ellipse cx="256" cy="404" rx="132" ry="40" fill="#000" opacity=".16"/>
    <path d="M118 398c4-44 62-70 138-70s134 26 138 70c-30 24-82 36-138 36s-108-12-138-36z" fill="url(#soil)"/>
    <path d="M150 388c30-18 70-26 106-26s76 8 106 26" fill="none" stroke="#b58559" stroke-width="7" stroke-linecap="round" opacity=".6"/>
    <path d="M256 352c-6-48-6-92 0-134" fill="none" stroke="#fff7de" stroke-width="24" stroke-linecap="round"/>
    <path d="M256 250c-70 2-112-38-122-100 68-2 118 36 122 100z" fill="#fffaf0"/>
    <path d="M256 250c-34-24-60-58-72-96" fill="none" stroke="#3f7b3b" stroke-width="8" stroke-linecap="round" opacity=".28"/>
    <path d="M256 226c6-78 62-120 134-122 4 74-50 126-134 122z" fill="#d9f0a6"/>
    <path d="M256 226c40-26 80-62 108-100" fill="none" stroke="#3f7b3b" stroke-width="8" stroke-linecap="round" opacity=".28"/>
  </g>
</svg>`;

const jobs = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.74 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 }
];

await mkdir(root, { recursive: true });
for (const job of jobs) {
  const info = await sharp(Buffer.from(svg(job.scale)), { density: 384 })
    .resize(job.size, job.size)
    .flatten({ background: "#3f7b3b" })   // no transparency: iOS fills it with black otherwise
    .png({ compressionLevel: 9 })
    .toFile(join(root, job.file));
  console.log(`${job.file}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}

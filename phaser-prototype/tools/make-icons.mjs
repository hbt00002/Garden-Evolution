// Draws the app icon (a sprout on the game's greens) and writes every size the
// website and the store apps need:
//
//   npm run app:icons        (node tools/make-icons.mjs)
//
// Website, public/icons/:
//   icon-192.png, icon-512.png      the "any" icons in the web app manifest
//   icon-maskable-512.png           the same picture with room around it, for
//                                   Android, which crops icons to its own shapes
//   apple-touch-icon.png (180)      what iOS uses for "Add to Home Screen"
//
// Android (android/app/src/main/res/), when the project exists:
//   mipmap-*/ic_launcher.png, ic_launcher_round.png   older launchers
//   mipmap-*/ic_launcher_foreground.png, _background  the adaptive icon's two layers
//   drawable*/splash.png                               the launch screen
//
// iOS (ios/App/App/Assets.xcassets/), when the project exists:
//   AppIcon.appiconset/AppIcon-512@2x.png (1024)       the only size Xcode needs now
//   Splash.imageset/splash-2732x2732*.png              the launch screen
//
// Stores, store/: play-icon-512.png (the Play listing's icon).
//
// The corners are not rounded: iOS and Android round them themselves.
import sharp from "sharp";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(project, "public", "icons");
const GREEN = "#3f7b3b";
const PAPER = "#eaf3df";   // the page's background, also behind the launch screen

const defs = `<defs>
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
  </defs>`;

const backdrop = `<rect width="512" height="512" fill="url(#sky)"/>
  <rect width="512" height="512" fill="url(#sun)"/>`;

// The sprout, drawn on a 512 x 512 square. `scale` shrinks it towards the middle.
const sprout = scale => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <ellipse cx="256" cy="404" rx="132" ry="40" fill="#000" opacity=".16"/>
    <path d="M118 398c4-44 62-70 138-70s134 26 138 70c-30 24-82 36-138 36s-108-12-138-36z" fill="url(#soil)"/>
    <path d="M150 388c30-18 70-26 106-26s76 8 106 26" fill="none" stroke="#b58559" stroke-width="7" stroke-linecap="round" opacity=".6"/>
    <path d="M256 352c-6-48-6-92 0-134" fill="none" stroke="#fff7de" stroke-width="24" stroke-linecap="round"/>
    <path d="M256 250c-70 2-112-38-122-100 68-2 118 36 122 100z" fill="#fffaf0"/>
    <path d="M256 250c-34-24-60-58-72-96" fill="none" stroke="#3f7b3b" stroke-width="8" stroke-linecap="round" opacity=".28"/>
    <path d="M256 226c6-78 62-120 134-122 4 74-50 126-134 122z" fill="#d9f0a6"/>
    <path d="M256 226c40-26 80-62 108-100" fill="none" stroke="#3f7b3b" stroke-width="8" stroke-linecap="round" opacity=".28"/>
  </g>`;

// layers: "both" (the icon), "back" (greens only) or "front" (sprout on nothing).
const svg = (scale = 1, layers = "both") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  ${layers === "front" ? "" : backdrop}
  ${layers === "back" ? "" : sprout(scale)}
</svg>`;

const render = (scale, size, layers = "both") => sharp(Buffer.from(svg(scale, layers)), { density: 384 }).resize(size, size);

async function write(image, file, { opaque = true } = {}) {
  await mkdir(dirname(file), { recursive: true });
  const info = await (opaque ? image.flatten({ background: GREEN }) : image).png({ compressionLevel: 9 }).toFile(file);
  console.log(`${file.slice(project.length + 1).replaceAll("\\", "/")}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}

// The icon in a circle, for launchers that ask for a round one.
async function round(size) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
  const icon = await render(1, size).png().toBuffer();
  return sharp(icon).composite([{ input: mask, blend: "dest-in" }]);
}

// The launch screen: the page's colour with the icon in the middle, its
// corners rounded as on a home screen.
async function splash(width, height) {
  const side = Math.round(Math.min(width, height) * 0.26);
  const corner = Math.round(side * 0.22);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" rx="${corner}"/></svg>`);
  const icon = await sharp(await render(1, side).png().toBuffer()).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: PAPER } })
    .composite([{ input: icon, left: Math.round((width - side) / 2), top: Math.round((height - side) / 2) }]);
}

/* ---------- Website ---------- */
for (const job of [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.74 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 }
]) {
  // No transparency: iOS fills it with black otherwise.
  await write(render(job.scale, job.size), join(root, job.file));
}
await write(render(1, 512), join(project, "store", "play-icon-512.png"));

/* ---------- Android ---------- */
const res = join(project, "android", "app", "src", "main", "res");
if (existsSync(res)) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, factor] of Object.entries(densities)) {
    const dir = join(res, `mipmap-${density}`);
    await write(render(1, 48 * factor), join(dir, "ic_launcher.png"));
    await write(await round(48 * factor), join(dir, "ic_launcher_round.png"), { opaque: false });
    // Adaptive icon: 108 dp layers, of which the launcher shows the middle
    // 72 dp and may crop to a 66 dp circle, so the sprout is kept small.
    await write(render(0.6, 108 * factor, "front"), join(dir, "ic_launcher_foreground.png"), { opaque: false });
    await write(render(1, 108 * factor, "back"), join(dir, "ic_launcher_background.png"));
  }
  const screens = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [density, [short, long]] of Object.entries(screens)) {
    await write(await splash(short, long), join(res, `drawable-port-${density}`, "splash.png"));
    await write(await splash(long, short), join(res, `drawable-land-${density}`, "splash.png"));
  }
  await write(await splash(480, 320), join(res, "drawable", "splash.png"));
}

/* ---------- iOS ---------- */
const assets = join(project, "ios", "App", "App", "Assets.xcassets");
if (existsSync(assets)) {
  await write(render(1, 1024), join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"));
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    await write(await splash(2732, 2732), join(assets, "Splash.imageset", name));
  }
}

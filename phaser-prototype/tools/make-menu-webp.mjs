// Re-creates the start-menu background as WebP from the PNG master.
//
// The menu background is the biggest thing the first screen has to download
// (800 KB as PNG). At quality 80 the WebP is about 40% smaller and cannot be
// told apart from the PNG at the size it is shown. The PNG stays: social
// networks that build a link preview from og:image do not read WebP.
//
// sharp is a tool, not a dependency of the game, so it is not saved in
// package.json:
//
//   npm install --no-save sharp
//   node tools/make-menu-webp.mjs
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const folder = fileURLToPath(new URL("../public/assets/menu/", import.meta.url));
const source = `${folder}sakura-garden-menu-bg-day.png`;
const output = `${folder}sakura-garden-menu-bg-day.webp`;

await sharp(source).webp({ quality: 80, effort: 6 }).toFile(output);

const kb = async file => Math.round((await stat(file)).size / 1024);
console.log(`${await kb(source)} KB (png) -> ${await kb(output)} KB (webp)`);

import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { preloadTags } from "../vite.config.js";

const projectFile = relativePath => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const read = relativePath => readFile(projectFile(relativePath), "utf8");

test("the game starts without waiting for the Phaser scenery", async () => {
  const main = await read("src/main.js");
  const order = needle => {
    const index = main.indexOf(needle);
    assert.ok(index >= 0, needle);
    return index;
  };
  // Both downloads begin at once...
  assert.ok(main.includes('const gameLoad = import("../script.js");'));
  assert.ok(main.includes('const sceneryLoad = webglAvailable ? import("./engine.js") : null;'));
  assert.ok(order("const sceneryLoad") < order("await gameLoad"));
  // ...but the game is awaited, and reported ready, before the scenery.
  assert.ok(order("await gameLoad") < order("await sceneryLoad"));
  assert.ok(order('performance.mark("game-ready")') < order("await sceneryLoad"));
  // The game is told up front that Phaser draws the backdrop (no throwaway SVG).
  assert.match(main, /if \(webglAvailable\) env\.dataset\.phaserActive = "";/);
  const engine = await read("src/engine.js");
  assert.ok(!engine.includes('import("../script.js")'), "the scenery never loads the game");
});

test("if the scenery fails after the game started, the SVG backdrop takes over", async () => {
  const main = await read("src/main.js");
  assert.match(main, /catch \(error\) \{[^}]*Phaser scenery could not start[\s\S]*?removeAttribute\("data-phaser-active"\)[\s\S]*?garden:scenery-failed/);
  const script = await read("script.js");
  assert.match(script, /addEventListener\("garden:scenery-failed", \(\) => \{\s+renderStageSVG\(/);
});

test("the scenery prepares the next world even when the player pressed Play first", async () => {
  const engine = await read("src/engine.js");
  assert.ok(engine.includes('if (!document.body.classList.contains("start-menu-active")) warmWorldScene(2);'));
});

test("the page itself declares the game and scenery downloads", () => {
  const bundle = {
    "assets/app-aaa.js": { type: "chunk", name: "index", fileName: "assets/app-aaa.js" },
    "assets/vendor-ccc.js": { type: "chunk", name: "phaser", fileName: "assets/vendor-ccc.js" },
    "assets/game-bbb.js": { type: "chunk", name: "script", fileName: "assets/game-bbb.js" },
    "assets/scenery-ddd.js": { type: "chunk", name: "engine", fileName: "assets/scenery-ddd.js" },
    "assets/index-eee.css": { type: "asset", fileName: "assets/index-eee.css" }
  };
  const tags = preloadTags(bundle);
  assert.deepEqual(tags.map(tag => tag.attrs.href), ["/assets/game-bbb.js", "/assets/vendor-ccc.js", "/assets/scenery-ddd.js"]);
  assert.ok(tags.every(tag => tag.tag === "link" && tag.attrs.rel === "modulepreload" && tag.injectTo === "head"));
  assert.equal(tags[0].attrs.fetchpriority, undefined, "the game keeps normal priority");
  assert.ok(tags.slice(1).every(tag => tag.attrs.fetchpriority === "low"), "the heavy scenery must not compete with the game");
  assert.deepEqual(preloadTags(undefined), [], "the dev server has no bundle");
});

test("the menu backdrop is a WebP, preloaded, with the PNG kept for link previews", async () => {
  const html = await read("index.html");
  const css = await read("style.css");
  assert.match(html, /<link rel="preload" as="image" type="image\/webp" href="\/assets\/menu\/sakura-garden-menu-bg-day\.webp"/);
  assert.ok(css.includes('url("/assets/menu/sakura-garden-menu-bg-day.webp")'));
  assert.ok(!css.includes("sakura-garden-menu-bg-day.png"));
  assert.ok(html.includes("assets/menu/sakura-garden-menu-bg-day.png"), "og:image still points at the PNG");
  const webp = (await stat(projectFile("public/assets/menu/sakura-garden-menu-bg-day.webp"))).size;
  const png = (await stat(projectFile("public/assets/menu/sakura-garden-menu-bg-day.png"))).size;
  assert.ok(webp < png * 0.6, `${webp} vs ${png}`);
});

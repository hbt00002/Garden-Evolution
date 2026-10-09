import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { leaderboardCacheKey } from "../cloudflare/worker.js";

const projectFile = relativePath => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

test("static asset policy contains the production security headers", async () => {
  const headers = await readFile(projectFile("public/_headers"), "utf8");
  assert.match(headers, /Content-Security-Policy:.*frame-ancestors 'none'/);
  assert.match(headers, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
});

test("leaderboard cache identity ignores query strings", () => {
  const key = leaderboardCacheKey(new Request("https://play.gardenevolution.workers.dev/api/leaderboard?fresh=1#scores"));
  assert.equal(key.method, "GET");
  assert.equal(key.url, "https://play.gardenevolution.workers.dev/api/leaderboard");
});

test("hidden end-game overlay is removed from layout and accessibility", async () => {
  const css = await readFile(projectFile("style.css"), "utf8");
  assert.match(css, /\.overlay\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
});

test("social metadata points at the Garden Evolution deployment", async () => {
  const html = await readFile(projectFile("index.html"), "utf8");
  assert.doesNotMatch(html, /bolt\.new\/static\/og_default/);
  assert.match(html, /play\.gardenevolution\.workers\.dev\/assets\/menu\/sakura-garden-menu-bg-day\.png/);
});

test("a delayed mobile menu-music request cannot continue into gameplay", async () => {
  const script = await readFile(projectFile("script.js"), "utf8");
  assert.match(script, /request !== menuMusicRequest \|\| !menuMode \|\| !musicOn/);
  assert.match(script, /menuMode && !startsGame/);
  assert.match(script, /function stopMenuMusic[\s\S]*?menuMusicRequest \+= 1;[\s\S]*?menuMusic\.pause\(\)/);
});

test("hashed bundles are cached for a year and art for a week", async () => {
  const raw = await readFile(projectFile("public/_headers"), "utf8");
  const headers = raw.split("\r\n").join("\n");
  assert.ok(headers.includes("/assets/:file\n  Cache-Control: public, max-age=31536000, immutable"));
  // Every art/audio folder shipped in public/assets needs its own short rule.
  const folders = readdirSync(projectFile("public/assets"), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name);
  assert.ok(folders.length > 0);
  for (const folder of folders) {
    assert.ok(headers.includes(`/assets/${folder}/*\n  Cache-Control: public, max-age=604800`), folder);
  }
});

test("the game starts even when the Phaser scenery cannot", async () => {
  const main = await readFile(projectFile("src/main.js"), "utf8");
  // WebGL is probed, Phaser is imported inside try/catch, and the game is
  // imported unconditionally afterwards.
  assert.ok(main.includes('getContext("webgl2")'));
  assert.match(main, /try \{\s+await import\("\.\/engine\.js"\)/);
  assert.match(main, /\}\s+await import\("\.\.\/script\.js"\);\s*$/);
  const engine = await readFile(projectFile("src/engine.js"), "utf8");
  assert.ok(!engine.includes('import("../script.js")'));
});

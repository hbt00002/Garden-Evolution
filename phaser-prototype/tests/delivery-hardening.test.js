import test from "node:test";
import assert from "node:assert/strict";
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

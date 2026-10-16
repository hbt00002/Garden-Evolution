import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LOAD_ERROR_COPY, loadErrorCopy, pickLanguage } from "../src/load-error.js";
import { TRANSLATIONS } from "../src/i18n.js";
import { chunkFileNames, entryFileNames } from "../vite.config.js";

const projectFile = relativePath => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

test("the load-error message exists in every language the game speaks", () => {
  assert.deepEqual(Object.keys(LOAD_ERROR_COPY).sort(), Object.keys(TRANSLATIONS).sort());
  for (const [language, copy] of Object.entries(LOAD_ERROR_COPY)) {
    assert.equal(copy.length, 3, language);
    assert.ok(copy.every(part => part.length > 0), language);
  }
});

test("the language is the saved one, else the browser's, else English", () => {
  assert.equal(pickLanguage("tr", "de-DE"), "tr");
  assert.equal(pickLanguage(null, "de-DE"), "de");
  assert.equal(pickLanguage(null, "PT-br"), "pt");
  assert.equal(pickLanguage("xx", "ja"), "ja", "an unknown saved language falls through");
  assert.equal(pickLanguage(null, "sv-SE"), "en");
  assert.equal(pickLanguage(undefined, undefined), "en");
  assert.equal(pickLanguage("__proto__", ""), "en", "no prototype keys");
  assert.equal(loadErrorCopy(null, "tr-TR")[0], "Oyun yüklenemedi");
});

test("bundle names carry no word an ad blocker's filter list would match", () => {
  // The game's own chunk used to be called script-<hash>.js and an ad blocker
  // replaced it with an HTML page.
  const names = [
    entryFileNames({ name: "index" }),
    chunkFileNames({ name: "script" }),
    chunkFileNames({ name: "engine" }),
    chunkFileNames({ name: "phaser" })
  ];
  assert.deepEqual(names, ["assets/app-[hash].js", "assets/game-[hash].js", "assets/scenery-[hash].js", "assets/vendor-[hash].js"]);
  for (const name of names) assert.doesNotMatch(name, /script|engine|phaser|track|analytics|ads?[-_.]/i);
  assert.equal(chunkFileNames({ name: "other" }), "assets/other-[hash].js", "unknown chunks keep their own name");
});

test("a failed game import shows the message and a reload button", async () => {
  const main = await readFile(projectFile("src/main.js"), "utf8");
  assert.match(main, /try \{\s+await gameLoad;[\s\S]*?\} catch \(error\) \{/);
  assert.ok(main.includes('document.getElementById("loadError").hidden = false'));
  assert.ok(main.includes("location.reload()"));
  const html = await readFile(projectFile("index.html"), "utf8");
  for (const id of ["loadError", "loadErrorTitle", "loadErrorText", "loadErrorRetry"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /<noscript>/);
  // The overlay must start hidden, or every visitor would see it.
  assert.match(html, /id="loadError"[^>]*\shidden>/);
});

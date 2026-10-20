import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, STAGE_META, artValueFor, levelFor, stageFor, stageMeta, tileLabel } from "../src/levels.js";
import { TILE_NAMES, TRANSLATIONS } from "../src/i18n.js";
import { SAVE_KEY } from "../src/game-save.js";

test("every plant has a distinct picture, colours and a place in the chain", () => {
  assert.deepEqual(LEVELS.map(level => level.v), [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]);
  assert.equal(new Set(LEVELS.map(level => level.bg)).size, LEVELS.length);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.sprite, index);
    assert.match(level.bg, /^#[0-9a-f]{6}$/i);
    assert.match(level.fg, /^#[0-9a-f]{6}$/i);
  }
  // The names the game shows for the middle of the chain.
  assert.deepEqual([LEVELS[8].name, LEVELS[9].name, LEVELS[10].name], ["Mini Forest", "Ancient Tree", "Sakura Crown"]);
});

test("a value that is not a plant still has a look, and the picture of the last plant", () => {
  assert.equal(levelFor(128).name, "Young Tree");
  const unknown = levelFor(16384);
  assert.equal(unknown.name, "Bloomed");
  assert.equal(unknown.bg, LEVELS.at(-1).bg);
  assert.deepEqual(artValueFor(2), { sprite: 0, assetValue: 2 });
  assert.deepEqual(artValueFor(2048), { sprite: 10, assetValue: 2048 });
  assert.deepEqual(artValueFor(16384), { sprite: 12, assetValue: 8192 });
});

test("the five worlds begin where the tile values say", () => {
  const boundaries = [[2, 1], [64, 1], [128, 2], [256, 2], [512, 3], [1024, 4], [2048, 5], [8192, 5]];
  for (const [value, stage] of boundaries) assert.equal(stageFor(value), stage, `value ${value}`);
  assert.equal(STAGE_META.length, 5);
  // The value that opens the next world is the one the previous world announces.
  assert.deepEqual(STAGE_META.map(meta => meta.next), [128, 512, 1024, 2048, null]);
});

test("a world's name and story follow the language, and fall back to English", () => {
  assert.equal(stageMeta(1, "en").name, "Winter Beginning");
  const turkish = stageMeta(2, "tr");
  assert.notEqual(turkish.name, "Snowmelt Valley");
  assert.equal(turkish.emblem, STAGE_META[1].emblem);
  assert.equal(stageMeta(3, "xx").name, "Spring Bloom");
});

test("a tile is named in the player's language", () => {
  assert.equal(tileLabel(128, "en"), `${TILE_NAMES.en[6]}, 128`);
  assert.equal(tileLabel(128, "tr"), `${TILE_NAMES.tr[6]}, 128`);
  assert.equal(tileLabel(128, "xx"), "Young Tree, 128");
  assert.ok(TRANSLATIONS.en);
});

/* ---------- Storage ---------- */

function fakeStorage({ blocked = false } = {}) {
  const data = new Map();
  const guard = () => { if (blocked) throw new Error("SecurityError"); };
  return {
    data,
    getItem: key => { guard(); return data.has(key) ? data.get(key) : null; },
    setItem: (key, value) => { guard(); data.set(key, String(value)); },
    removeItem: key => { guard(); data.delete(key); }
  };
}

async function withStorage(storage, run) {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  try { return await run(await import("../src/storage.js")); }
  finally { before ? Object.defineProperty(globalThis, "localStorage", before) : delete globalThis.localStorage; }
}

test("preferences, the best score, the name and the language are remembered", async () => {
  const storage = fakeStorage();
  await withStorage(storage, store => {
    assert.equal(store.loadBest(), 0);
    store.saveBest(4096);
    assert.equal(store.loadBest(), 4096);
    storage.setItem("gardenEvolutionBest", "not a number");
    assert.equal(store.loadBest(), 0);

    assert.equal(store.loadPref("x", true), true);
    store.savePref("x", false);
    assert.equal(store.loadPref("x", true), false);
    store.savePref("x", true);
    assert.equal(store.loadPref("x", false), true);

    assert.equal(store.loadPlayerName(), "");
    store.savePlayerName("Mira");
    assert.equal(store.loadPlayerName(), "Mira");

    assert.equal(store.loadLanguage(), "en");
    store.saveLanguage("tr");
    assert.equal(store.loadLanguage(), "tr");
  });
});

test("the device id is made once and kept", async () => {
  await withStorage(fakeStorage(), store => {
    const first = store.loadDeviceId();
    assert.match(first, /^[0-9a-f-]{36}$/);
    assert.equal(store.loadDeviceId(), first);
  });
});

test("a saved game round-trips and can be cleared", async () => {
  const storage = fakeStorage();
  await withStorage(storage, store => {
    assert.equal(store.loadSavedGame(), null);
    store.writeSavedGame({ seed: 7, moves: "LRUD", session: null });
    assert.ok(storage.data.has(SAVE_KEY));
    store.clearSavedGame();
    assert.equal(storage.data.has(SAVE_KEY), false);
    assert.equal(store.loadSavedGame(), null);
    storage.setItem(SAVE_KEY, "{broken");
    assert.equal(store.loadSavedGame(), null);
  });
});

test("when storage is blocked nothing throws and the defaults apply", async () => {
  await withStorage(fakeStorage({ blocked: true }), store => {
    assert.equal(store.loadBest(), 0);
    assert.equal(store.loadPref("x", true), true);
    assert.equal(store.loadPlayerName(), "");
    assert.equal(store.loadLanguage(), "en");
    assert.equal(store.loadDeviceId(), null);
    assert.equal(store.loadSavedGame(), null);
    assert.doesNotThrow(() => {
      store.saveBest(1); store.savePref("x", true); store.savePlayerName("Mira");
      store.saveLanguage("tr"); store.writeSavedGame({ seed: 1, moves: "L", session: null }); store.clearSavedGame();
    });
  });
});

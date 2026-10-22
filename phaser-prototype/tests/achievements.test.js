import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, cleanState, createAchievements, nextStreak } from "../src/achievements.js";
import { dailyOffer, untilNextGarden } from "../src/daily-offer.js";
import { TRANSLATIONS } from "../src/i18n.js";

function setup({ stored = null, initialBest = 0 } = {}) {
  let saved = stored;
  const unlocked = [];
  const achievements = createAchievements({
    load: () => saved,
    save: state => { saved = JSON.parse(JSON.stringify(state)); },
    onUnlock: list => unlocked.push(...list.map(a => a.id)),
    initialBest,
    now: () => 1000
  });
  return { achievements, unlocked, stored: () => saved };
}

test("every achievement has a unique id and a reachable goal", () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.target > 0 && a.icon && a.kind, a.id);
});

test("growing a plant and scoring unlock as they happen, once", () => {
  const { achievements, unlocked } = setup();
  achievements.progress({ score: 900, maxTile: 64, combo: 2 });
  assert.deepEqual(unlocked, []);
  achievements.progress({ score: 1500, maxTile: 128, combo: 3 });
  assert.deepEqual(unlocked, ["world2"]);
  achievements.progress({ score: 12000, maxTile: 1024, combo: 5 });
  assert.deepEqual(unlocked, ["world2", "world3", "world4", "combo5", "score10k"]);
  achievements.progress({ score: 13000, maxTile: 1024, combo: 5 });
  assert.equal(unlocked.length, 5, "nothing twice");
});

test("finished games are counted, and their best values kept", () => {
  const { achievements, unlocked, stored } = setup();
  for (let i = 0; i < 10; i++) achievements.finish({ score: 400, maxTile: 32, combo: 1, mode: "classic" });
  assert.deepEqual(unlocked, ["firstGame", "games10"]);
  assert.equal(achievements.stats.gamesFinished, 10);
  assert.equal(stored().stats.gamesFinished, 10, "kept on the device");
  const games50 = achievements.list().find(a => a.id === "games50");
  assert.equal(games50.value, 10);
  assert.equal(games50.counted, true);
});

test("today's garden counts its ranked try once a day, and keeps a streak", () => {
  const { achievements, unlocked } = setup();
  const play = (day, mode = "daily") => achievements.finish({ score: 10, maxTile: 8, combo: 0, mode, day });
  play("2026-10-20");
  play("2026-10-20", "practice");
  play("2026-10-20");
  assert.equal(achievements.stats.dailiesPlayed, 1, "the same day once");
  play("2026-10-21");
  play("2026-10-22");
  assert.equal(achievements.stats.dailyStreak, 3);
  assert.ok(unlocked.includes("dailyFirst") && unlocked.includes("dailyStreak3"));
  assert.equal(achievements.currentStreak("2026-10-23"), 3, "yesterday still counts");
  assert.equal(achievements.currentStreak("2026-10-24"), 0, "a missed day breaks it");
  play("2026-10-25");
  assert.equal(achievements.stats.dailyStreak, 1);
  assert.equal(achievements.stats.bestDailyStreak, 3);
});

test("a streak carries over month and year ends", () => {
  const stats = { lastDailyDay: "2026-12-31", dailyStreak: 4 };
  assert.equal(nextStreak(stats, "2027-01-01"), 5);
  assert.equal(nextStreak(stats, "2027-01-02"), 1);
  assert.equal(nextStreak(stats, "2026-12-31"), 4);
});

test("sharing and looking around the garden are achievements too", () => {
  const { achievements, unlocked } = setup();
  achievements.event("share");
  achievements.event("gardenView");
  achievements.event("nonsense");
  assert.deepEqual(unlocked, ["sharer", "explorer"]);
});

test("a player who already had a best score starts with it, quietly", () => {
  const { achievements, unlocked } = setup({ initialBest: 20000 });
  assert.deepEqual(unlocked, [], "no message on boot");
  assert.equal(achievements.list().find(a => a.id === "score10k").unlocked, true);
});

test("a broken or hand-edited entry falls back to zero", () => {
  for (const raw of [null, 7, "x", { stats: { gamesFinished: -3, bestScore: "lots" }, unlocked: { firstGame: "yes", fake: 5 } }]) {
    const state = cleanState(raw);
    assert.equal(state.stats.gamesFinished, 0);
    assert.equal(state.stats.bestScore, 0);
    assert.deepEqual(state.unlocked, {});
  }
  const { achievements } = setup({ stored: { stats: { gamesFinished: 3 }, unlocked: { firstGame: 5 } } });
  assert.equal(achievements.stats.gamesFinished, 3);
  assert.equal(achievements.unlockedCount, 1);
});

test("every language names every achievement and describes every kind", () => {
  const kinds = new Set(ACHIEVEMENTS.map(a => a.kind));
  const describe = { firstGame: "achFirstGame", world: "achWorld", plant: "achPlant", combo: "achCombo", score: "achScore", games: "achGames", daily: "achDaily", streak: "achStreak", share: "achShare", view: "achView" };
  for (const [language, text] of Object.entries(TRANSLATIONS)) {
    for (const a of ACHIEVEMENTS) assert.ok(text[`ach_${a.id}`], `${language} ${a.id}`);
    for (const kind of kinds) assert.ok(text[describe[kind]], `${language} ${kind}`);
    assert.ok(text.achWorld.includes("{world}") && text.achPlant.includes("{plant}"), language);
    for (const key of ["achCombo", "achScore", "achGames", "achStreak"]) assert.ok(text[key].includes("{n}"), `${language} ${key}`);
    assert.ok(text.achUnlocked.includes("{name}"), `${language} unlocked`);
  }
});

/* ---------- What the Today's Garden button offers ---------- */

const TODAY = "2026-10-22";

test("a fresh day offers the ranked try", () => {
  assert.equal(dailyOffer(null, null, TODAY).kind, "ranked");
  assert.equal(dailyOffer({ day: "2026-10-21", seed: 5, used: true }, null, TODAY).kind, "ranked");
  assert.equal(dailyOffer({ day: TODAY, seed: 5, used: false }, null, TODAY).kind, "ranked");
});

test("once the try is used, the same garden can be practised", () => {
  assert.deepEqual(dailyOffer({ day: TODAY, seed: 5, used: true }, null, TODAY), { kind: "practice", day: TODAY, seed: 5 });
});

test("an unfinished run of today's garden is carried on", () => {
  const saved = { mode: "practice", day: TODAY };
  assert.equal(dailyOffer({ day: TODAY, seed: 5, used: true }, saved, TODAY).kind, "continue");
  // Yesterday's ranked run that can still be sent: carried on. Yesterday's practice: not.
  assert.equal(dailyOffer(null, { mode: "daily", day: "2026-10-21" }, TODAY).kind, "continue");
  assert.equal(dailyOffer(null, { mode: "practice", day: "2026-10-21" }, TODAY).kind, "ranked");
});

test("the time until the next garden is said in the player's language", () => {
  const evening = Date.parse("2026-10-22T16:00:00Z"); // 19:00 in Turkey
  assert.equal(untilNextGarden("en", evening), "in 5 hours");
  assert.match(untilNextGarden("tr", evening), /5 saat/);
  assert.equal(untilNextGarden("en", Date.parse("2026-10-22T20:30:00Z")), "in 30 minutes");
});

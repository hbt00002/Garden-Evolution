import { test, expect, startGame, playToTheEnd } from "./fixtures.js";
import { applyMove, createGame } from "../src/game-core.js";

// Moves that flow: every key becomes a move, and a merge pops (and the new
// tile appears) exactly as the slide lands, timed by CSS from the key press.

const DIRS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("gardenEvolutionSave") || "null"));
const score = async page => Number((await page.locator("#score").textContent()).replace(/\D/g, ""));

test("mashed keys all become moves, in order", async ({ page }) => {
  await startGame(page);
  const keys = [];
  for (let i = 0; i < 16; i++) {
    const key = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4];
    keys.push(key);
    await page.keyboard.press(key);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(500);
  const save = await saved(page);
  // The same keys, replayed from the run's seed: every one that could move the board did.
  const game = createGame(save.seed);
  let expected = "";
  for (const key of keys) if (applyMove(game, DIRS[key])) expected += { left: "L", right: "R", up: "U", down: "D" }[DIRS[key]];
  expect(save.moves).toBe(expected);
  expect(expected.length).toBeGreaterThanOrEqual(12);
  expect(page.problems).toEqual([]);
});

test("a merge pops exactly when the slide lands", async ({ page }) => {
  await startGame(page);
  const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  let checked = false;
  for (let i = 0; i < 60 && !checked; i++) {
    const before = await score(page);
    await page.keyboard.press(keys[i % 4]);
    // Right after the key: the pop is already scheduled, to start when the slide ends.
    const delays = await page.evaluate(() => [...document.querySelectorAll("#tiles .tile")]
      .flatMap(el => el.getAnimations().filter(a => /^merge/.test(a.animationName)).map(a => a.effect.getTiming().delay)));
    await page.waitForTimeout(350);
    if ((await score(page)) > before) {
      expect(delays.length).toBeGreaterThan(0);
      for (const delay of delays) expect(delay).toBe(115);
      checked = true;
    }
  }
  expect(checked).toBe(true);
});

test("after the last move the end card shows once and no key moves the board", async ({ page }) => {
  test.slow();
  await startGame(page);
  await playToTheEnd(page, { pace: 45 });
  const before = await saved(page);
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(400);
  await expect(page.locator("#overlay.show")).toHaveCount(1);
  expect(await saved(page)).toEqual(before);
});

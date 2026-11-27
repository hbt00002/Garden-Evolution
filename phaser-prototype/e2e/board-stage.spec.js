import { test, expect, startGame } from "./fixtures.js";

// Redrawing the board for a new world (its frame and sixteen cells, and in
// the third world its meadow of grass and tulips) took 30-60 ms on a phone, on
// the very move that changed the world. The next world's board is now drawn
// while the game is idle, so the change itself only shows it.

const countBoardWork = page => page.evaluate(() => {
  const board = window.gardenBoardEngine.scene.getScene("LivingBoardScene");
  window.__boardWork = { bakeFrame: 0, buildSpringFlora: 0 };
  for (const name of Object.keys(window.__boardWork)) {
    const original = board[name];
    board[name] = function (...args) { window.__boardWork[name]++; return original.apply(this, args); };
  }
});
const boardWork = page => page.evaluate(() => ({ ...window.__boardWork }));

const frameSample = page => page.evaluate(() => new Promise(resolve => {
  const board = window.gardenBoardEngine.scene.getScene("LivingBoardScene");
  board.frameTexture.snapshot(image => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    resolve(Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data.filter((_, i) => i % 3 === 0)));
  });
}));

test("the next world's board is ready before the world changes", async ({ page }) => {
  await startGame(page);
  await countBoardWork(page);
  for (const stage of [2, 3, 4]) {
    await page.waitForTimeout(2600);          // idle: the next board is prepared
    // Only the change itself, up to the board having switched (the observer
    // runs as a microtask), before the next idle moment prepares the one after.
    const { before, after, shown } = await page.evaluate(async stage => {
      const before = { ...window.__boardWork };
      window.debugSetEnvironmentStage(stage);
      await Promise.resolve();
      const board = window.gardenBoardEngine.scene.getScene("LivingBoardScene");
      return { before, after: { ...window.__boardWork }, shown: board.stage };
    }, stage);
    expect(shown).toBe(stage);
    expect(after, `world ${stage}`).toEqual(before);
  }
  expect(page.problems).toEqual([]);
});

test("a board prepared ahead looks exactly like one drawn on the spot", async ({ page, browser }) => {
  await startGame(page);
  for (const stage of [2, 3, 4, 5]) {
    await page.waitForTimeout(2600);
    await page.evaluate(stage => window.debugSetEnvironmentStage(stage), stage);
    await page.waitForTimeout(2600);          // and settled at the board's exact size
    const prepared = await frameSample(page);
    const fresh = await browser.newPage({ viewport: page.viewportSize() });
    await fresh.route(/\/api\//, route => route.abort());
    await fresh.goto(`/?stage=${stage}`);
    await expect.poll(() => fresh.evaluate(() => Boolean(window.gardenBoardEngine?.scene.getScene("LivingBoardScene")?.frameTexture))).toBe(true);
    const drawn = await frameSample(fresh);
    await fresh.close();
    expect(prepared.length, `world ${stage}`).toBe(drawn.length);
    expect(prepared.every((value, i) => value === drawn[i]), `world ${stage} pixels`).toBe(true);
  }
});

test("turning the phone still gives a board of the right size in every world", async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(2600);
  await page.setViewportSize({ width: 360, height: 700 });
  for (const stage of [2, 3]) {
    await page.evaluate(stage => window.debugSetEnvironmentStage(stage), stage);
    await expect.poll(() => page.evaluate(() => {
      const board = window.gardenBoardEngine.scene.getScene("LivingBoardScene");
      return board.frameTexture.width === Math.floor(board.scale.width) && board.frameTexture.height === Math.floor(board.scale.height);
    })).toBe(true);
    await page.waitForTimeout(2600);
  }
  expect(page.problems).toEqual([]);
});

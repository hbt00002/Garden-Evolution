import { test, expect, startGame } from "./fixtures.js";

// The worlds and the board's living frame are drawn by Phaser on the same
// thread as the game's controls. Two things once kept a phone's main thread
// busy all the time (so taps and swipes felt sticky); these keep them fixed.

const scenes = page => page.evaluate(() => {
  const board = window.gardenBoardEngine.scene.getScene("LivingBoardScene");
  return {
    frameCommands: board.base.commandBuffer.length,
    hasFrameTexture: Boolean(board.frameTexture),
    frameSize: board.frameTexture ? [board.frameTexture.width, board.frameTexture.height] : null,
    boardSize: [Math.floor(board.scale.width), Math.floor(board.scale.height)],
    worldLimit: window.gardenEngine.loop.fpsLimit,
    boardLimit: window.gardenBoardEngine.loop.fpsLimit
  };
});

test("the board's frame and cells are drawn once into a texture, not replayed every frame", async ({ page }) => {
  await startGame(page);
  await expect.poll(async () => (await scenes(page)).hasFrameTexture).toBe(true);
  const info = await scenes(page);
  expect(info.frameCommands, "the Graphics object holds no drawing commands to replay").toBe(0);
  expect(info.frameSize).toEqual(info.boardSize);
});

test("the frame is baked again when the world changes and when the board is resized", async ({ page }) => {
  await startGame(page);
  await expect.poll(async () => (await scenes(page)).hasFrameTexture).toBe(true);
  await page.evaluate(() => window.debugSetEnvironmentStage(4));
  await page.waitForTimeout(500);
  expect((await scenes(page)).frameCommands).toBe(0);
  await page.setViewportSize({ width: 360, height: 700 });
  await expect.poll(async () => { const i = await scenes(page); return JSON.stringify(i.frameSize) === JSON.stringify(i.boardSize); }).toBe(true);
  expect((await scenes(page)).frameCommands).toBe(0);
});

test.describe("on a desktop", () => {
  test("the backdrop runs at the screen's own rate", async ({ page }) => {
    await startGame(page);
    await expect.poll(async () => (await scenes(page)).worldLimit).toBeDefined();
    const info = await scenes(page);
    expect(info.worldLimit).toBe(0);
    expect(info.boardLimit).toBe(0);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the backdrop is limited to 30 frames a second", async ({ page }) => {
    await startGame(page);
    await expect.poll(async () => (await scenes(page)).worldLimit).toBeDefined();
    const info = await scenes(page);
    expect(info.worldLimit).toBe(30);
    expect(info.boardLimit).toBe(30);
  });
});

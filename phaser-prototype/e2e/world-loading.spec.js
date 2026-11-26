import { test, expect, startGame } from "./fixtures.js";

// A world's pictures can fail to arrive (a dropped connection on a phone).
// The player must never see a black world full of "missing texture" squares:
// the world they were in stays, or the game's own drawn scenery when there is
// none, and the new world comes in once its pictures can be loaded.
const SPRING = /\/assets\/stage3-v[12]\//;
const sceneState = (page, key) => page.evaluate(k => {
  const scene = window.gardenEngine?.scene.getScene(k);
  return { active: Boolean(scene && window.gardenEngine.scene.isActive(k)), visible: Boolean(scene?.cameras?.main?.visible) };
}, key);

test("a world whose pictures do not arrive keeps the previous world on screen, and comes in when they do", async ({ page }) => {
  await startGame(page);
  await expect.poll(() => sceneState(page, "WinterMountainScene")).toEqual({ active: true, visible: true });
  await page.route(SPRING, route => route.abort());
  await page.evaluate(() => window.debugSetEnvironmentStage(3, true));
  await page.waitForTimeout(2500);
  expect(await sceneState(page, "SpringBloomScene"), "the half-loaded world is not shown").not.toEqual({ active: true, visible: true });
  expect(await sceneState(page, "WinterMountainScene"), "the previous world stays").toEqual({ active: true, visible: true });

  await page.unroute(SPRING);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => sceneState(page, "SpringBloomScene"), { timeout: 15000 }).toEqual({ active: true, visible: true });
  await expect.poll(() => page.evaluate(() => window.gardenEngine.textures.exists("s3-terrain"))).toBe(true);
});

// The next world is prepared in the background while the player is still in
// this one, which is when a dropped connection usually hits.
const SNOWMELT = /\/assets\/stage2-v3\//;
test("a next world whose pictures fail while it is prepared ahead is not kept asleep, and loads when the player gets there", async ({ page }) => {
  await page.route(SNOWMELT, route => route.abort());
  await startGame(page);
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => window.gardenEngine.scene.isSleeping("SnowmeltValleyScene")), "no half-loaded world waiting").toBe(false);
  await page.unroute(SNOWMELT);
  await page.evaluate(() => window.debugSetEnvironmentStage(2, true));
  await expect.poll(() => sceneState(page, "SnowmeltValleyScene"), { timeout: 15000 }).toEqual({ active: true, visible: true });
  await expect.poll(() => page.evaluate(() => window.gardenEngine.textures.exists("s2v3-meadow"))).toBe(true);
  expect((await sceneState(page, "WinterMountainScene")).visible).toBe(false);
});

// A new player whose connection drops while the game first opens: the first
// world itself fails. With nothing to fall back on, the drawn scenery shows;
// the world comes in once its pictures can be loaded.
const WINTER = /\/assets\/stage1-v[23]\//;
test("when the first world's pictures fail on opening, the drawn scenery shows until they arrive", async ({ page }) => {
  await page.route(WINTER, route => route.abort());
  await page.goto("/");
  await expect(page.locator("#grid .cell")).toHaveCount(16);
  await expect(page.locator("#env")).not.toHaveAttribute("data-phaser-active", /.*/, { timeout: 15000 });
  await expect.poll(() => page.locator(".env-sky").evaluate(node => node.childElementCount)).toBeGreaterThan(0);
  expect(await sceneState(page, "WinterMountainScene"), "the half-loaded world is not shown").not.toEqual({ active: true, visible: true });

  await page.unroute(WINTER);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#env")).toHaveAttribute("data-phaser-active", "", { timeout: 15000 });
  await expect.poll(() => sceneState(page, "WinterMountainScene"), { timeout: 15000 }).toEqual({ active: true, visible: true });
  await expect.poll(() => page.evaluate(() => window.gardenEngine.textures.exists("mountain-ridge-v2"))).toBe(true);
});

import { test, expect } from "./fixtures.js";

// A world's large pictures used to be decoded on the main thread when they
// were first sent to the GPU: 17-34 ms each, 60-85 ms per world, felt as a
// hitch on the move that changed the world. They are now decoded off the main
// thread (createImageBitmap) before Phaser sees them.

const sources = (page, keys) => page.evaluate(keys => keys.map(key => {
  const texture = window.gardenEngine.textures.exists(key) && window.gardenEngine.textures.get(key);
  return texture ? texture.source[0].image?.constructor?.name : "missing";
}), keys);

test("a world's pictures arrive already decoded", async ({ page }) => {
  await page.goto("/?stage=2");
  await expect(page.locator("#env")).toHaveAttribute("data-stage", "2");
  await expect.poll(() => sources(page, ["s2v3-mountains", "s2v3-meadow", "s2v3-cottage"]), { timeout: 15000 })
    .toEqual(["ImageBitmap", "ImageBitmap", "ImageBitmap"]);
  expect(page.problems).toEqual([]);
});

test("without createImageBitmap the pictures load the old way", async ({ page }) => {
  await page.addInitScript(() => { delete window.createImageBitmap; });
  await page.goto("/?stage=2");
  await expect.poll(() => sources(page, ["s2v3-mountains", "s2v3-meadow"]), { timeout: 15000 })
    .toEqual(["HTMLImageElement", "HTMLImageElement"]);
  expect(page.problems).toEqual([]);
});

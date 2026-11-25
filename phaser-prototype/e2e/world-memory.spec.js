import { test, expect } from "./fixtures.js";

// The last world's painting is drawn by Phaser, over its own opaque night-blue
// background. A second copy as a CSS background behind the canvas could never
// be seen, yet the phone kept it decoded and painted: memory for nothing.
test("the last world's painting is held once, by the world itself", async ({ page }) => {
  await page.goto("/?stage=5");
  const world = page.locator(".phaser-world");
  await expect(page.locator("#env")).toHaveAttribute("data-stage", "5");
  expect(await world.evaluate(el => getComputedStyle(el).backgroundImage)).toBe("none");
});

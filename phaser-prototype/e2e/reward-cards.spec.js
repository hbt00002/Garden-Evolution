import { test, expect } from "./fixtures.js";

// The 2048 and 8192 cards are the same paper card as the end of every other run:
// paper, wooden rods, the world's inks. 2048 names its tree on a ribbon; 8192
// looks through a window onto the moon garden the player walked to.
const hexToRgb = hex => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};
const cssVar = (page, name) => page.evaluate(n => getComputedStyle(document.getElementById("overlay")).getPropertyValue(n).trim(), name);

for (const ending of ["milestone", "victory"]) {
  test(`the ${ending} card is the paper card with wooden rods`, async ({ page }) => {
    await page.goto(`/?ending=${ending}`);
    const card = page.locator("#overlay .overlay-card");
    await expect(card).toBeVisible();
    const bg = await card.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe(hexToRgb(await cssVar(page, "--paper")));
    expect(await card.evaluate(el => getComputedStyle(el, "::before").content)).not.toBe("none");
  });
}

test("the 2048 title is a ribbon in the world's ink badge", async ({ page }) => {
  await page.goto("/?ending=milestone");
  const title = page.locator("#finalTitle");
  await expect(title).toHaveClass(/overlay-title--ribbon/);
  const bg = await title.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).toBe(hexToRgb(await cssVar(page, "--ink-badge")));
});

test("the 8192 window shows the moon garden behind the tree", async ({ page }) => {
  await page.goto("/?ending=victory");
  const scene = page.locator(".ending-window-scene");
  await expect(scene).toBeVisible();
  expect(await scene.evaluate(el => getComputedStyle(el).backgroundImage)).toContain("quiet-moon-garden");
  await expect(page.locator("#finalTitle")).not.toHaveClass(/overlay-title--ribbon/);
});

for (const [width, height] of [[320, 568], [360, 640], [844, 390]]) {
  test(`${width}x${height}: the 8192 card with its name form keeps its buttons on screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?ending=victory");
    await page.evaluate(() => {
      document.getElementById("scoreForm").hidden = false;
      document.getElementById("unrankedNote").hidden = true;
    });
    await expect(page.locator("#playAgainBtn")).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  });
}

test("320x568: the name form's Save button stays inside the card", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?ending=victory");
  await page.evaluate(() => {
    document.getElementById("scoreForm").hidden = false;
    document.getElementById("unrankedNote").hidden = true;
  });
  const card = await page.locator("#overlay .overlay-card").boundingBox();
  const save = await page.locator("#submitScoreBtn").boundingBox();
  expect(save.x + save.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
});

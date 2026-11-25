import { test, expect, startGame } from "./fixtures.js";

const box = (page, selector) => page.locator(selector).boundingBox();
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The world card names the plant that opens the next world, with its picture,
// in plain writing (no capitals with wide spacing, see DESIGN.md).
test("the world card shows the next world's plant and is written plainly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  await expect(page.locator("#stageNext")).toHaveText("Next world:Young Tree");
  await expect(page.locator("#stageNext img")).toHaveAttribute("src", /tile-128\.png$/);
  expect(await page.locator("#stageKicker").evaluate(el => getComputedStyle(el).textTransform)).toBe("none");
});

// The streak badge never covers anything: below the board on a phone held
// upright, under the score beside the board on one held sideways.
const SIZES = [
  { width: 360, height: 640, below: true }, { width: 390, height: 844, below: true }, { width: 412, height: 915, below: true },
  { width: 667, height: 223 }, { width: 844, height: 283 }, { width: 844, height: 390 }
];
for (const size of SIZES) {
  test(`${size.width}x${size.height}: the streak badge shows on screen and covers nothing`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await startGame(page);
    await page.evaluate(() => { document.getElementById("comboHud").hidden = false; });
    const hud = await box(page, "#comboHud");
    expect(hud.y).toBeGreaterThanOrEqual(0);
    expect(hud.y + hud.height).toBeLessThanOrEqual(size.height);
    expect(hud.x).toBeGreaterThanOrEqual(0);
    expect(hud.x + hud.width).toBeLessThanOrEqual(size.width);
    for (const other of ["#board", ".evolution", ".scores", "#settingsBtn", "#viewBtn", "#leaderboardBtn", "#newBtn", ".brand"]) {
      const rect = await box(page, other);
      if (rect) expect(overlaps(hud, rect), `the badge covers ${other}`).toBe(false);
    }
    if (size.below) expect(hud.y).toBeGreaterThan((await box(page, "#board")).y + (await box(page, "#board")).height);
  });
}

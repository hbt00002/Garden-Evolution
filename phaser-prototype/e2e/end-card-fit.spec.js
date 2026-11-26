import { test, expect, startGame } from "./fixtures.js";

// The end card with its name form, on a small phone: its buttons are always on
// screen, it covers the whole screen like the other windows, and a toast (the
// first game unlocks an achievement) never sits on its buttons or the form.
const showEndCard = page => page.evaluate(() => {
  const card = document.getElementById("overlay");
  card.hidden = false;
  card.dataset.mode = "noMoves";
  card.classList.add("show", "ready");
  document.getElementById("scoreForm").hidden = false;
  document.getElementById("unrankedNote").hidden = true;
});
const box = (page, selector) => page.locator(selector).boundingBox();
const inside = (rect, width, height) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5;
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [width, height] of [[360, 640], [375, 667], [390, 844]]) {
  test(`${width}x${height}: the end card's buttons are on screen and a toast never covers them`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startGame(page);
    await showEndCard(page);
    await page.evaluate(() => { const t = document.getElementById("toast"); t.textContent = "Achievement unlocked: First Harvest"; t.hidden = false; t.classList.add("show"); });
    await page.waitForTimeout(500);
    const layer = await box(page, "#overlay");
    expect(layer.width, "covers the screen").toBeGreaterThanOrEqual(width - 1);
    expect(layer.height, "covers the screen").toBeGreaterThanOrEqual(height - 1);
    const toast = await box(page, "#toast");
    for (const id of ["#playAgainBtn", "#shareBtn", "#playerName", "#submitScoreBtn"]) {
      const rect = await box(page, id);
      if (id === "#playAgainBtn" || id === "#shareBtn") expect(inside(rect, width, height), `${id} on screen`).toBe(true);
      expect(overlaps(rect, toast), `the toast covers ${id}`).toBe(false);
    }
  });
}

import { test, expect, startGame } from "./fixtures.js";

// The end card covers the whole screen, so the game's own Leaderboard button
// is out of reach while it is open: the card offers the way itself.
test("the end card leads to the leaderboard, and the card is still there after", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startGame(page);
  await page.evaluate(() => {
    const card = document.getElementById("overlay");
    card.hidden = false; card.dataset.mode = "noMoves"; card.classList.add("show", "ready");
  });
  const link = page.locator("#endLeaderboardBtn");
  await expect(link).toBeVisible();
  await expect(link).toHaveText("View leaderboard");
  const rect = await link.boundingBox();
  expect(rect.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  await page.locator("#leaderboardClose").click();
  await expect(page.locator("#leaderboardModal")).toBeHidden();
  await expect(page.locator("#overlay")).toBeVisible();
  await expect(link).toBeFocused();
});

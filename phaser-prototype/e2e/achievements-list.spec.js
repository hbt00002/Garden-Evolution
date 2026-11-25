import { test, expect, startGame } from "./fixtures.js";

// The achievements list is drawn only when what it shows has changed, and in
// the phone's spare time where possible: rebuilding it on every open made the
// window slow to appear on a phone.
test.use({ reducedMotion: "reduce" });

const openAchievements = async page => {
  await page.locator("#settingsBtn").click();
  await page.locator("#settingsAchievementsBtn").click();
  await expect(page.locator("#achievementsModal")).toBeVisible();
};
const closeAchievements = page => page.locator("#achievementsClose").click();
// Marks the first row, so a later look can tell whether it is still the same element.
const markFirstRow = page => page.locator("#achievementsList li").first().evaluate(el => { el.dataset.seen = "1"; });
const firstRowKept = page => page.locator("#achievementsList li").first().evaluate(el => el.dataset.seen === "1");

test("opening the achievements again, with nothing new, keeps the drawn list", async ({ page }) => {
  await startGame(page);
  await openAchievements(page);
  await markFirstRow(page);
  await closeAchievements(page);
  await openAchievements(page);
  expect(await firstRowKept(page)).toBe(true);
});

test("an achievement earned since the last look shows when the window opens", async ({ page }) => {
  await startGame(page);
  await openAchievements(page);
  const explorer = page.locator('#achievementsList li[data-id="explorer"]');
  await expect(explorer).not.toHaveClass(/unlocked/);
  await closeAchievements(page);
  // Looking around the garden earns "explorer".
  await page.locator("#viewBtn").click();
  await expect(page.locator("#gardenView.show")).toBeVisible();
  await page.locator("#gvBack").click();
  await expect(page.locator("#gardenView")).toBeHidden();
  await openAchievements(page);
  await expect(explorer).toHaveClass(/unlocked/);
});

test("opening the settings draws a stale list ahead, while the window is still closed", async ({ page }) => {
  await startGame(page);
  await openAchievements(page);
  await closeAchievements(page);
  await page.locator("#viewBtn").click();
  await expect(page.locator("#gardenView.show")).toBeVisible();
  await page.locator("#gvBack").click();
  await expect(page.locator("#gardenView")).toBeHidden();
  await page.locator("#settingsBtn").click();
  // Before the achievements window is opened, the list already shows the new one.
  await expect(page.locator('#achievementsList li[data-id="explorer"]')).toHaveClass(/unlocked/);
  await expect(page.locator("#achievementsModal")).toBeHidden();
  await markFirstRow(page);
  await page.locator("#settingsAchievementsBtn").click();
  await expect(page.locator("#achievementsModal")).toBeVisible();
  expect(await firstRowKept(page)).toBe(true);
});

test("a new language redraws the list", async ({ page }) => {
  await startGame(page);
  await openAchievements(page);
  const first = page.locator("#achievementsList li strong").first();
  const before = await first.textContent();
  await closeAchievements(page);
  await page.locator("#settingsBtn").click();
  await page.locator("#languageSelect").selectOption("de");
  await page.locator("#settingsAchievementsBtn").click();
  await expect(first).not.toHaveText(before);
});

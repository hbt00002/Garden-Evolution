import { test, expect, openGame, startGame, playMoves } from "./fixtures.js";

// Dialogs must trap focus, hide the game behind them from keyboards and
// screen readers, and give focus back when they close.

const focusIsInside = (page, selector) =>
  page.evaluate(sel => Boolean(document.activeElement?.closest(sel)), selector);

async function tabAround(page, selector, presses) {
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
    expect(await focusIsInside(page, selector), `after press ${i + 1}`).toBe(true);
  }
}

test("settings: opens, traps focus, hides the game, closes and returns focus", async ({ page }) => {
  await startGame(page);
  await page.locator("#settingsBtn").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await expect(page.locator("main.game")).toHaveJSProperty("inert", true);

  await tabAround(page, "#settingsPanel", 14);
  // Many Tabs forward in a row never leave the dialog either.
  for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
  expect(await focusIsInside(page, "#settingsPanel")).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator("#settingsPanel")).toBeHidden();
  await expect(page.locator("main.game")).toHaveJSProperty("inert", false);
  await expect(page.locator("#settingsBtn")).toBeFocused();
  expect(page.problems).toEqual([]);
});

test("settings: the toggles work with the mouse", async ({ page }) => {
  await startGame(page);
  await page.locator("#settingsBtn").click();
  const toggle = page.locator("#particlesToggle");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("body")).toHaveClass(/particles-off/);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});

test("leaderboard: opens from the menu, traps focus and closes with Escape", async ({ page }) => {
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  await expect(page.locator("#startScreen")).toHaveJSProperty("inert", true);
  await tabAround(page, "#leaderboardModal", 10);

  await page.keyboard.press("Escape");
  await expect(page.locator("#leaderboardModal")).toBeHidden();
  await expect(page.locator("#startScreen")).toHaveJSProperty("inert", false);
  await expect(page.locator("#startLeaderboardBtn")).toBeFocused();
  // The menu works again after the dialog.
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#startScreen")).toBeHidden();
});

test("new game asks before throwing a game away", async ({ page }) => {
  await startGame(page);
  expect(await playMoves(page, 2)).toBe(2);
  await page.locator("#newBtn").click();
  const confirm = page.locator("#newGameConfirm");
  await expect(confirm).toBeVisible();
  await page.locator("#cancelNewGame").click();
  await expect(confirm).toBeHidden();
  await page.locator("#newBtn").click();
  await page.locator("#confirmNewGame").click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
});

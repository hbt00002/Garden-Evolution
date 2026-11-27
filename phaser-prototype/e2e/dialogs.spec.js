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

// The new-game question and the in-game settings open in the middle of the
// screen over a dim, like the leaderboard, instead of hanging from their
// buttons; nothing makes the page scroll, sideways included.
// Measured once the window's opening animation (a short slide and grow) has
// finished: on a slow machine it can still be moving when it becomes visible.
const centreOff = async (page, selector) => {
  await page.locator(selector).evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  const r = await page.locator(selector).boundingBox();
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  return Math.max(Math.abs(r.x + r.width / 2 - w / 2), Math.abs(r.y + r.height / 2 - h / 2));
};
const noPageScroll = page => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1);

for (const [width, height] of [[390, 844], [844, 390]]) {
  test(`${width}x${height}: the new-game question is a centred window over a dim`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startGame(page);
    expect(await playMoves(page, 2)).toBe(2);
    await page.locator("#newBtn").click();
    await expect(page.locator("#newGameConfirm")).toBeVisible();
    await expect(page.locator("#newGameDim")).toBeVisible();
    expect(await centreOff(page, "#newGameConfirm")).toBeLessThanOrEqual(4);
    expect(await noPageScroll(page)).toBe(true);
    await page.mouse.click(8, height - 8);                  // a tap on the dim
    await expect(page.locator("#newGameConfirm")).toBeHidden();
    await expect(page.locator("#newGameDim")).toBeHidden();
  });

  test(`${width}x${height}: the in-game settings are a centred window over a dim`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startGame(page);
    await page.locator("#settingsBtn").click();
    await expect(page.locator("#settingsPanel")).toBeVisible();
    await expect(page.locator("#settingsBackdrop")).toBeVisible();
    expect(await centreOff(page, "#settingsPanel")).toBeLessThanOrEqual(4);
    const r = await page.locator("#settingsPanel").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(height + 0.5);
    expect(await noPageScroll(page)).toBe(true);
  });
}

test("the new-game question stays centred when the phone turns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  expect(await playMoves(page, 2)).toBe(2);
  await page.locator("#newBtn").click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  expect(await centreOff(page, "#newGameConfirm")).toBeLessThanOrEqual(4);
});

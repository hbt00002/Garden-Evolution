import { test, expect, openGame } from "./fixtures.js";

// Vibration in a phone's browser: Android browsers can buzz (navigator.vibrate),
// iPhone browsers and desktops cannot. Here the browser's vibrate() is replaced
// by one that remembers what it was asked for.
test.use({ reducedMotion: "reduce" });

const recordBuzzes = page => page.addInitScript(() => {
  window.__buzzes = [];
  navigator.vibrate = pattern => { window.__buzzes.push(pattern); return true; };
});

async function playUntilMerge(page) {
  const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press(keys[i % 4]);
    if (await page.evaluate(() => window.__buzzes.length > 0)) return;
  }
}

test.describe("an Android phone", () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test("merges buzz, and the Settings switch turns it off", async ({ page }) => {
    await recordBuzzes(page);
    await openGame(page);
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    await playUntilMerge(page);
    expect(await page.evaluate(() => window.__buzzes.length)).toBeGreaterThan(0);

    await page.locator("#settingsBtn").click();
    await expect(page.locator("#hapticsRow")).toBeVisible();
    await page.locator("#hapticsToggle").click();
    await expect(page.locator("#hapticsToggle")).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { window.__buzzes.length = 0; });
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await page.keyboard.press(key);
    expect(await page.evaluate(() => window.__buzzes.length)).toBe(0);

    // The choice is remembered.
    await page.reload();
    await page.locator("#startSettingsBtn").click();
    await expect(page.locator("#hapticsToggle")).toHaveAttribute("aria-checked", "false");
  });
});

test("a desktop has no vibration switch", async ({ page }) => {
  await recordBuzzes(page);
  await openGame(page);
  await page.locator("#startSettingsBtn").click();
  await expect(page.locator("#hapticsRow")).toBeHidden();
});

test.describe("an iPhone (no navigator.vibrate)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("has no vibration switch", async ({ page }) => {
    await page.addInitScript(() => { delete Navigator.prototype.vibrate; });
    await openGame(page);
    await page.locator("#startSettingsBtn").click();
    await expect(page.locator("#hapticsRow")).toBeHidden();
  });
});

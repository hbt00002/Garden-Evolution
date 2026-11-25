import { test, expect, startGame } from "./fixtures.js";

// When a window opens, focus lands on its title, not on a button: on Chrome for
// Android focusing a button walks the whole page and made every window slow to
// open. A screen reader still hears the window's name, and Tab goes on to the
// window's close button. The title shows no focus ring.
test.use({ reducedMotion: "reduce" });

const WINDOWS = [
  { name: "settings", open: async page => page.locator("#settingsBtn").click(), title: "#settingsTitle", close: "#settingsClose" },
  { name: "leaderboard", open: async page => page.locator("#leaderboardBtn").click(), title: "#leaderboardTitle", close: "#leaderboardClose" },
  {
    name: "achievements",
    open: async page => { await page.locator("#settingsBtn").click(); await page.locator("#settingsAchievementsBtn").click(); },
    title: "#achievementsTitle", close: "#achievementsClose"
  }
];

for (const win of WINDOWS) {
  test(`the ${win.name} window gives focus to its title, and Tab goes on to its close button`, async ({ page }) => {
    await startGame(page);
    await win.open(page);
    const title = page.locator(win.title);
    await expect(title).toBeFocused();
    expect(await title.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("none");
    await page.keyboard.press("Tab");
    await expect(page.locator(win.close)).toBeFocused();
  });
}

test("opened from the keyboard, the title still shows no focus ring", async ({ page }) => {
  await startGame(page);
  await page.locator("#settingsBtn").focus();
  await page.keyboard.press("Enter");
  const title = page.locator("#settingsTitle");
  await expect(title).toBeFocused();
  expect(await title.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("none");
});

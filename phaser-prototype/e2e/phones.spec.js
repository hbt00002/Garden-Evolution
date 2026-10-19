import { test, expect, openGame, startGame, playToTheEnd } from "./fixtures.js";

// Phones, held both ways. Everything has to fit the screen without scrolling,
// the board must be whole, and nothing may sit on top of the board.

const PHONES = [
  { name: "iPhone SE (portrait)", width: 375, height: 667 },
  { name: "Pixel 7 (portrait)", width: 412, height: 915 },
  { name: "iPhone 15 Pro Max (portrait)", width: 430, height: 932 },
  { name: "small Android (portrait)", width: 360, height: 640 },
  { name: "iPhone 14 (landscape)", width: 844, height: 390 },
  { name: "iPhone SE (landscape)", width: 667, height: 375 },
  { name: "Pixel 7 (landscape)", width: 915, height: 412 },
  { name: "iPhone 15 Pro Max (landscape)", width: 932, height: 430 },
  { name: "small Android (landscape)", width: 640, height: 360 }
];

const box = (page, selector) => page.locator(selector).boundingBox();

async function expectInsideScreen(page, selector, label = selector) {
  const { width, height } = page.viewportSize();
  const rect = await box(page, selector);
  expect(rect, `${label} is on screen`).not.toBeNull();
  expect(rect.x, `${label} left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(rect.y, `${label} top edge`).toBeGreaterThanOrEqual(-0.5);
  expect(rect.x + rect.width, `${label} right edge`).toBeLessThanOrEqual(width + 0.5);
  expect(rect.y + rect.height, `${label} bottom edge`).toBeLessThanOrEqual(height + 0.5);
  return rect;
}

const noScroll = async page => {
  const { width, height } = page.viewportSize();
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }));
  expect(size.scrollWidth, "sideways scrolling").toBeLessThanOrEqual(width);
  expect(size.scrollHeight, "vertical scrolling").toBeLessThanOrEqual(height);
};

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const phone of PHONES) {
  test(`${phone.name} ${phone.width}x${phone.height}: the menu, the board and the dialogs fit`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });

    // The start menu.
    await openGame(page);
    for (const id of ["#startPlayBtn", "#startSettingsBtn", "#startLeaderboardBtn"]) await expectInsideScreen(page, id);
    await noScroll(page);

    // The game.
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    const board = await expectInsideScreen(page, "#board", "board");
    for (const part of [".brand", ".scores", ".controls", ".evolution"]) {
      const rect = await expectInsideScreen(page, part);
      expect(overlaps(rect, board), `${part} must not cover the board`).toBe(false);
    }
    await noScroll(page);
    // The board is square and big enough to play.
    expect(Math.abs(board.width - board.height)).toBeLessThan(2);
    expect(board.width).toBeGreaterThanOrEqual(Math.min(phone.width, phone.height) * 0.62);

    // The dialogs.
    await page.locator("#settingsBtn").click();
    await expectInsideScreen(page, "#settingsPanel", "settings panel");
    await page.keyboard.press("Escape");
    await page.locator("#leaderboardBtn").click();
    await expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton)")).toBeVisible();
    await expectInsideScreen(page, ".leaderboard-card", "leaderboard card");
    await expectInsideScreen(page, "#leaderboardClose", "leaderboard close button");
    await page.keyboard.press("Escape");
    await noScroll(page);
    expect(page.problems).toEqual([]);
  });
}

test.describe("the end-of-game card fits on a phone", () => {
  test.use({ reducedMotion: "reduce" });
  for (const phone of [PHONES[1], PHONES[4], PHONES[5]]) {
    test(`${phone.name} ${phone.width}x${phone.height}`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await startGame(page);
      await playToTheEnd(page);
      await expectInsideScreen(page, ".overlay-card", "end card");
      // Whatever does not fit scrolls inside the card; the form and the way to
      // play again must still be reachable.
      await page.locator("#playAgainBtn").scrollIntoViewIfNeeded();
      await expectInsideScreen(page, "#playAgainBtn", "play again");
      await page.locator("#playerName").scrollIntoViewIfNeeded();
      await expectInsideScreen(page, "#playerName", "name field");
      await noScroll(page);
    });
  }
});

test("the page extends under notches and stays clear of them", async ({ page }) => {
  await openGame(page);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  // The safe-area insets are wired in as variables (0 where a screen has none).
  const { values, source } = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      values: ["--safe-top", "--safe-right", "--safe-bottom", "--safe-left"].map(name => root.getPropertyValue(name).trim()),
      source: [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join(" ")
    };
  });
  expect(values, "no notch in this browser").toEqual(["0px", "0px", "0px", "0px"]);
  for (const side of ["top", "right", "bottom", "left"]) expect(source).toContain(`env(safe-area-inset-${side}`);
  // On a screen without a notch the layout is unchanged: 18 px above the title.
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => getComputedStyle(document.body).paddingTop)).toBe("18px");
});

test("tiles stay on their cells when the board changes size without a window resize", async ({ page }) => {
  // A phone browser's toolbar sliding in or out changes the board (it is sized
  // from the dynamic viewport height) without always firing a resize event.
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  const misalignment = () => page.evaluate(() => {
    const cells = [...document.querySelectorAll("#grid .cell")].map(c => c.getBoundingClientRect());
    return [...document.querySelectorAll("#tiles .tile")].map(tile => {
      const t = tile.getBoundingClientRect();
      return Math.min(...cells.map(c => Math.hypot(c.x - t.x, c.y - t.y) + Math.abs(c.width - t.width)));
    });
  });
  for (const d of await misalignment()) expect(d).toBeLessThan(1.5);
  await page.addStyleTag({ content: ":root { --board-max: 270px !important; }" });
  await expect.poll(async () => Math.max(...await misalignment()), { timeout: 3000 }).toBeLessThan(1.5);
  expect(await page.locator("#board").evaluate(el => el.clientWidth)).toBeLessThanOrEqual(270);
});

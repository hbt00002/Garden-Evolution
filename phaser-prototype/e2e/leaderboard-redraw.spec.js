import { test, expect, startGame, asSeededPlayer } from "./fixtures.js";

// Opening the leaderboard again fetches the player's place again; when nothing
// it shows has changed, the drawn rows are kept rather than drawn anew a moment
// after the window appeared (a second hitch on every open on a phone).
test.use({ reducedMotion: "reduce" });

const rowsReady = page => expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton) li").first()).toBeVisible();
const markFirstRow = page => page.locator("#leaderboardList .lb-rows li").first().evaluate(el => { el.dataset.seen = "1"; });
const firstRowKept = page => page.locator("#leaderboardList .lb-rows li").first().evaluate(el => el.dataset.seen === "1");

// Opens the leaderboard and waits until the player's place has come back.
async function openAndSettle(page) {
  const me = page.waitForResponse(response => response.url().includes("/api/leaderboard/me"));
  await page.locator("#leaderboardBtn").click();
  await me;
  await rowsReady(page);
  // The answer is drawn (or not) right after it arrives.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test("opening the leaderboard again, with nothing new, keeps the drawn rows", async ({ page }) => {
  await asSeededPlayer(page);
  await startGame(page);
  await openAndSettle(page);
  await markFirstRow(page);
  await page.locator("#leaderboardClose").click();
  await openAndSettle(page);
  expect(await firstRowKept(page)).toBe(true);
});

test("the list still starts at the top when the leaderboard opens again", async ({ page }) => {
  await asSeededPlayer(page);
  await startGame(page);
  await openAndSettle(page);
  await page.locator("#leaderboardList").evaluate(el => { el.scrollTop = 120; });
  await page.locator("#leaderboardClose").click();
  await openAndSettle(page);
  expect(await page.locator("#leaderboardList").evaluate(el => el.scrollTop)).toBe(0);
});

test("a new language redraws the rows", async ({ page }) => {
  await asSeededPlayer(page);
  await startGame(page);
  await openAndSettle(page);
  const rank = page.locator("#leaderboardList .leaderboard-rank").first();
  const before = await rank.getAttribute("aria-label");
  await page.locator("#leaderboardClose").click();
  await page.locator("#settingsBtn").click();
  await page.locator("#languageSelect").selectOption("de");
  await page.locator("#settingsClose").click();
  await openAndSettle(page);
  await expect(rank).not.toHaveAttribute("aria-label", before);
});

test("after a tab fails to load, going back to a tab already seen shows its rows again", async ({ page }) => {
  await asSeededPlayer(page);
  await startGame(page);
  await openAndSettle(page);
  await page.route(/\/api\/leaderboard\?period=week/, route => route.fulfill({ status: 500, body: "{}" }));
  await page.locator("#lbTab-week").click();
  await expect(page.locator("#leaderboardList .lb-retry")).toBeVisible();
  await page.locator("#lbTab-all").click();
  await rowsReady(page);
  await expect(page.locator("#leaderboardList .lb-retry")).toHaveCount(0);
});

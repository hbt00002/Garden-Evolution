import { test, expect, openGame, asSeededPlayer } from "./fixtures.js";

// The leaderboard against the seeded database (see seed.sql): 25 players plus
// "E2E Me", who is rank 26 all-time, 25 on 7 days and 5 on 24 hours.

async function openBoard(page) {
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  // Wait out the loading skeleton.
  await expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton)")).toBeVisible();
}

test("all time: the top 20, then the player's own row after a gap", async ({ page }) => {
  await asSeededPlayer(page);
  await openBoard(page);

  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("All Time");
  const list = page.locator("#leaderboardList .leaderboard-entry");
  await expect(list).toHaveCount(21); // 20 + the player's own row
  await expect(list.first()).toContainText("Player 01");
  await expect(list.first()).toContainText("20,000");
  await expect(page.locator("#leaderboardList .lb-gap")).toHaveCount(1);

  const own = page.locator("#leaderboardList .leaderboard-entry.own");
  await expect(own).toHaveCount(1);
  await expect(own).toContainText("E2E Me");
  await expect(own).toContainText(/you/i);
  await expect(own).toHaveAttribute("aria-current", "true");
  await expect(own.locator(".leaderboard-rank")).toHaveText("26");

  // The pinned card says the same, without scrolling.
  const card = page.locator("#leaderboardMe");
  await expect(card).toContainText("#26");
  await expect(card).toContainText("E2E Me");
  await expect(card).toContainText("7,000");
  await expect(card).toContainText(/of \d+ players/);
  expect(page.problems).toEqual([]);
});

test("the top three get medals and show their plant", async ({ page }) => {
  await openBoard(page);
  const entries = page.locator("#leaderboardList .leaderboard-entry");
  for (const [index, rank] of [[0, "1"], [1, "2"], [2, "3"]]) {
    await expect(entries.nth(index)).toHaveClass(/\btop\b/);
    await expect(entries.nth(index)).toHaveAttribute("data-rank", rank);
  }
  await expect(entries.first().locator(".lb-plant img")).toHaveAttribute("src", /tile-2048\.png/);
  await expect(entries.first()).toContainText("Sakura Crown");
});

test("a visitor with no entry is invited to play instead of seeing a rank", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator("#leaderboardMe")).toContainText("Finish a game and submit your score");
  await expect(page.locator("#leaderboardList .leaderboard-entry.own")).toHaveCount(0);
});

test("7 days and 24 hours rank within their window", async ({ page }) => {
  await asSeededPlayer(page);
  await openBoard(page);

  await page.locator("#lbTab-week").click();
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("7 Days");
  await expect(page.locator("#leaderboardMe")).toContainText("#25");
  await expect(page.locator("#leaderboardList .lb-gap")).toHaveCount(1);

  await page.locator("#lbTab-day").click();
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("24 Hours");
  // Four players and the visitor played in the last day: no gap, own row inside.
  await expect(page.locator("#leaderboardMe")).toContainText("#5");
  await expect(page.locator("#leaderboardMe")).toContainText("of 5 players");
  await expect(page.locator("#leaderboardList .leaderboard-entry")).toHaveCount(5);
  await expect(page.locator("#leaderboardList .lb-gap")).toHaveCount(0);
  await expect(page.locator("#leaderboardList .leaderboard-entry.own .leaderboard-rank")).toHaveText("5");
});

test("the tabs work from the keyboard", async ({ page }) => {
  await openBoard(page);
  await page.locator(".lb-tab[aria-selected='true']").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("7 Days");
  await expect(page.locator(".lb-tab[aria-selected='true']")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("24 Hours");
  await page.keyboard.press("Home");
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("All Time");
});

test("a failing leaderboard shows a message and a retry button", async ({ page }) => {
  await page.route("**/api/leaderboard", route => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  await expect(page.locator("#leaderboardList .leaderboard-message")).toBeVisible();
  await expect(page.locator("#leaderboardList .lb-retry")).toBeVisible();

  await page.unroute("**/api/leaderboard");
  await page.locator("#leaderboardList .lb-retry").click();
  await expect(page.locator("#leaderboardList .leaderboard-entry").first()).toContainText("Player 01");
});

test("the leaderboard follows the chosen language", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
  await openBoard(page);
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("Tüm Zamanlar");
  // The top player reached the 2048 plant, "Sakura Crown" in English.
  await expect(page.locator("#leaderboardList .leaderboard-entry").first()).toContainText("Sakura Tacı");
});

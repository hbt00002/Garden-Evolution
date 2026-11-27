import { test, expect, openGame, startGame, playToTheEnd, asSeededPlayer } from "./fixtures.js";

// Name moderation in the leaderboard, against the real Worker and the seeded
// database (seed.sql): 25 players plus "E2E Me". One report never hides a name
// (that takes three different people), so these tests leave the board as it was.

async function openBoard(page) {
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  await expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton)")).toBeVisible();
}

const row = (page, name) => page.locator("#leaderboardList .leaderboard-entry", { hasText: name });

test("someone else's row opens a report button; your own row does not", async ({ page }) => {
  await asSeededPlayer(page);
  await openBoard(page);
  await row(page, "Player 03").click();
  await expect(row(page, "Player 03").getByRole("button", { name: "Report name" })).toBeVisible();
  await expect(row(page, "Player 03")).toHaveAttribute("aria-expanded", "true");

  // Another row closes the first: one at a time.
  await row(page, "Player 04").click();
  await expect(page.locator(".lb-report")).toHaveCount(1);
  await expect(row(page, "Player 04").locator(".lb-report")).toBeVisible();

  const own = page.locator("#leaderboardList .leaderboard-entry.own");
  await own.click();
  await expect(own.locator(".lb-report")).toHaveCount(0);
  await expect(own).not.toHaveAttribute("tabindex", "0");
  expect(page.problems).toEqual([]);
});

test("a report thanks the player, and the name is not offered again", async ({ page }) => {
  await openBoard(page);
  const target = row(page, "Player 07");
  await target.click();
  const sent = page.waitForResponse(response => response.url().endsWith("/api/report"));
  await target.getByRole("button", { name: "Report name" }).click();
  expect((await sent).status()).toBe(200);
  await expect(target.locator(".lb-report-note")).toHaveText("Thanks, we'll take a look.");

  // Closed and opened again: still thanked, no button.
  await page.keyboard.press("Escape");
  await page.locator("#startLeaderboardBtn").click();
  await expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton)")).toBeVisible();
  await row(page, "Player 07").click();
  await expect(row(page, "Player 07").locator(".lb-report-note")).toHaveText("Thanks, we'll take a look.");
  await expect(row(page, "Player 07").getByRole("button")).toHaveCount(0);
  // One report does not hide anyone.
  await expect(row(page, "Player 07")).toBeVisible();
  expect(page.problems).toEqual([]);
});

test("a report that fails says so and can be sent again", async ({ page }) => {
  await page.route("**/api/report", route => route.fulfill({ status: 429, contentType: "application/json", body: "{}" }));
  await openBoard(page);
  const target = row(page, "Player 06");
  await target.click();
  await target.getByRole("button", { name: "Report name" }).click();
  await expect(target.locator(".lb-report-note")).toHaveText("The report could not be sent. Please try again.");
  await expect(target.getByRole("button", { name: "Report name" })).toBeEnabled();
});

test("rows can be reported from the keyboard", async ({ page }) => {
  await openBoard(page);
  await row(page, "Player 05").focus();
  await page.keyboard.press("Enter");
  await expect(row(page, "Player 05").getByRole("button", { name: "Report name" })).toBeFocused();
});

test("a player whose name was hidden is told so in the rank card", async ({ page }) => {
  await asSeededPlayer(page);
  await page.route("**/api/leaderboard/me?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ period: "all", total: 25, rank: null, hidden: true, entry: { player_name: "E2E Me", score: 7000, max_tile: 128, best_combo: 5, reached_stage: 2 } })
  }));
  await openBoard(page);
  await expect(page.locator("#leaderboardMe")).toContainText("This name was hidden. You can send your next score under another name.");
  await expect(page.locator("#leaderboardList .leaderboard-entry.own")).toHaveCount(0);
});

test("in Turkish the button says İsmi bildir", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
  await openBoard(page);
  await row(page, "Player 02").click();
  await expect(row(page, "Player 02").getByRole("button", { name: "İsmi bildir" })).toBeVisible();
});

test.describe("a banned device", () => {
  test.use({ reducedMotion: "reduce" });
  test("is told its scores can't be sent, and Save stays off", async ({ page }) => {
    await startGame(page);
    await playToTheEnd(page, { pace: 45 });
    await page.locator("#playerName").fill("Garden Fan");
    await page.route("**/api/leaderboard", route => route.request().method() === "POST"
      ? route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Scores can't be sent from this device.", code: "banned" }) })
      : route.continue());
    await page.locator("#submitScoreBtn").click();
    await expect(page.locator("#scoreSubmitStatus")).toHaveText("Scores can't be sent from this device.");
    await expect(page.locator("#submitScoreBtn")).toBeDisabled();
  });
});

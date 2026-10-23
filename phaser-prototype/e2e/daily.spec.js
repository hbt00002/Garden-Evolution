import { test, expect, openGame, playToTheEnd, waitUntilHumanPaced } from "./fixtures.js";
import { dayKey, previousDay } from "../src/daily.js";

// Today's garden and achievements, through the real Worker: everyone gets the
// same seed for the day, the first run a device sends is its entry on the
// daily board, later runs are practice; achievements are kept on the device.
test.use({ reducedMotion: "reduce" });

// Reloads and waits until the game's code is running (the board grid is its marker).
async function reopen(page) {
  await page.reload();
  await expect(page.locator("#grid .cell")).toHaveCount(16);
}

async function startDaily(page) {
  await openGame(page);
  page.playStartedAt = Date.now();
  await page.locator("#startDailyBtn").click();
  await expect(page.locator("#startScreen")).toBeHidden();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
}

test("today's garden: one ranked try on the daily board, then practice of the same garden", async ({ page }) => {
  await openGame(page);
  await expect(page.locator("#startDailyBtn")).toContainText("Today's Garden");
  await expect(page.locator("#startDailySub")).toHaveText("One ranked try today");

  const session = page.waitForResponse(response => response.url().includes("/api/session?mode=daily"));
  await startDaily(page);
  const issued = await (await session).json();
  expect(issued.daily).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator("#modeBadge")).toBeVisible();
  await expect(page.locator("#modeBadge")).toContainText("Today's Garden");
  await expect(page.locator(".brand .hint")).toBeHidden();
  const firstTiles = await page.locator("#tiles .tile").evaluateAll(tiles => tiles.map(tile => tile.getAttribute("aria-label")).sort());

  await playToTheEnd(page, { pace: 45 });
  await waitUntilHumanPaced(page);
  await expect(page.locator("#scoreForm label")).toHaveText("Join today's board");
  await expect(page.locator("#normalGameBtn")).toBeVisible();
  await page.locator("#playerName").fill("Daily Runner");
  const submission = page.waitForResponse(response => response.url().endsWith("/api/leaderboard") && response.request().method() === "POST");
  await page.locator("#submitScoreBtn").click();
  const response = await submission;
  expect(response.status(), await response.text()).toBe(201);

  // The leaderboard opens on today's garden, with the player's row.
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  await expect(page.locator(".lb-tab[aria-selected='true']")).toHaveText("Daily");
  await expect(page.locator("#leaderboardDaily")).toContainText("New garden in");
  await expect(page.locator("#leaderboardDailyPlay")).toBeHidden();
  await expect(page.locator("#leaderboardList .leaderboard-entry.own")).toContainText("Daily Runner");
  await page.keyboard.press("Escape");

  // Play Again is practice of the same garden: the same first tiles, no form.
  await page.locator("#playAgainBtn").click();
  await expect(page.locator("#modeBadge")).toContainText("Practice");
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  const practiceTiles = await page.locator("#tiles .tile").evaluateAll(tiles => tiles.map(tile => tile.getAttribute("aria-label")).sort());
  expect(practiceTiles).toEqual(firstTiles);
  await playToTheEnd(page);
  await expect(page.locator("#scoreForm")).toBeHidden();
  await expect(page.locator("#unrankedNote")).toHaveText(/today's ranked try is already used/);

  // Back on the menu, the button offers practice and says when the next garden comes.
  await reopen(page);
  await expect(page.locator("#startDailySub")).toContainText("Practice · new garden in");
  // Play is still the normal game.
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#modeBadge")).toBeHidden();
  expect(page.problems).toEqual([]);
});

test("a run of today's garden left halfway is carried on, and a normal game is kept apart", async ({ page }) => {
  // A normal game with a few moves, then today's garden: neither replaces the other.
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gardenEvolutionSave"))).not.toBeNull();
  const normal = await page.evaluate(() => JSON.parse(localStorage.getItem("gardenEvolutionSave")).moves);

  await reopen(page);
  await page.locator("#startDailyBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight"]) await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("gardenEvolutionDailySave") || "null")?.mode)).toBe("daily");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gardenEvolutionSave")).moves)).toBe(normal);

  await reopen(page);
  await expect(page.locator("#startDailySub")).toHaveText("Continue where you left off");
  await page.locator("#startDailyBtn").click();
  await expect(page.locator("#modeBadge")).toContainText("Today's Garden");
  // New Game here warns that the ranked try ends.
  await page.locator("#newBtn").click();
  await expect(page.locator("#newGameConfirmText")).toContainText("ends today's ranked try");
  await page.locator("#confirmNewGame").click();
  await expect(page.locator("#modeBadge")).toContainText("Practice");
});

test("the daily tab offers today's garden from the menu, and a refused second entry is explained", async ({ page }) => {
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  await page.locator("#lbTab-daily").click();
  await expect(page.locator("#leaderboardDaily")).toBeVisible();
  await expect(page.locator("#leaderboardDailyPlay")).toHaveText("Play today's garden");
  await page.locator("#leaderboardDailyPlay").click();
  await expect(page.locator("#startScreen")).toBeHidden();
  await expect(page.locator("#modeBadge")).toContainText("Today's Garden");

  // The server already has this device's entry for today (e.g. after storage was cleared).
  await page.route("**/api/leaderboard", route => (route.request().method() === "POST"
    ? route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "daily_already_played" }) })
    : route.continue()));
  await playToTheEnd(page);
  await page.locator("#playerName").fill("Again");
  await page.locator("#submitScoreBtn").click();
  await expect(page.locator("#scoreSubmitStatus")).toHaveText(/already has your score/);
  await expect(page.locator("#submitScoreBtn")).toBeDisabled();
});

test("achievements: shown from the menu and Settings, unlocked by playing, kept on the device", async ({ page }) => {
  await openGame(page);
  await page.locator("#startAchievementsBtn").click();
  await expect(page.locator("#achievementsModal")).toBeVisible();
  await expect(page.locator("#achievementsSummary")).toHaveText("0 of 18 unlocked");
  await expect(page.locator(".ach-item")).toHaveCount(18);
  await expect(page.locator("#achievementsClose")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#achievementsModal")).toBeHidden();
  await expect(page.locator("#startAchievementsBtn")).toBeFocused();

  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await playToTheEnd(page);
  await expect(page.locator("#toast")).toContainText("Achievement unlocked");

  await reopen(page);
  await page.locator("#startSettingsBtn").click();
  await page.locator("#settingsAchievementsBtn").click();
  await expect(page.locator("#settingsPanel")).toBeHidden();
  await expect(page.locator("#achievementsModal")).toBeVisible();
  await expect(page.locator(".ach-item[data-id='firstGame']")).toHaveClass(/unlocked/);
  await expect(page.locator("#achievementsStats")).toContainText("Games finished");
  await expect(page.locator("#achievementsStats")).toContainText("1");
});

test("in Turkish, today's garden and the achievements speak Turkish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
  await openGame(page);
  await expect(page.locator("#startDailyBtn")).toContainText("Günün Bahçesi");
  await expect(page.locator("#startAchievementsBtn")).toHaveText("Başarımlar");
  await page.locator("#startAchievementsBtn").click();
  await expect(page.locator(".ach-item[data-id='world3']")).toContainText("İlkbahar Çiçekleri");
});

/* ---------- The daily streak on the menu ---------- */

// A device that finished today's garden on the days up to `last`, `streak` in a row.
const withStreak = (page, last, streak) => page.addInitScript(({ last, streak }) => {
  localStorage.setItem("gardenEvolutionAchievements", JSON.stringify({
    stats: { lastDailyDay: last, dailyStreak: streak, bestDailyStreak: streak, dailiesPlayed: streak, gamesFinished: streak },
    unlocked: {}
  }));
}, { last, streak });

test("a streak going since yesterday is shown on the button, which asks to keep it", async ({ page }) => {
  await withStreak(page, previousDay(dayKey()), 3);
  await openGame(page);
  await expect(page.locator("#startDailyStreak")).toBeVisible();
  await expect(page.locator("#startDailyStreak")).toHaveText("🔥 3");
  await expect(page.locator("#startDailyStreak")).toHaveAttribute("aria-label", "3-day streak");
  await expect(page.locator("#startDailySub")).toHaveText("Keep your 3-day streak going");
  await expect(page.locator("#startDailyBtn")).toHaveClass(/streak-at-risk/);
});

test("once today's garden is played the streak stays, without the warning", async ({ page }) => {
  await withStreak(page, dayKey(), 4);
  await page.addInitScript(today => localStorage.setItem("gardenEvolutionDaily", JSON.stringify({ day: today, seed: 7, used: true })), dayKey());
  await openGame(page);
  await expect(page.locator("#startDailyStreak")).toHaveText("🔥 4");
  await expect(page.locator("#startDailySub")).toContainText("Practice");
  await expect(page.locator("#startDailyBtn")).not.toHaveClass(/streak-at-risk/);
});

test("a missed day ends the streak, and the Turkish button says so in Turkish", async ({ page }) => {
  await withStreak(page, previousDay(previousDay(dayKey())), 5);
  await openGame(page);
  await expect(page.locator("#startDailyStreak")).toBeHidden();
  await expect(page.locator("#startDailySub")).toHaveText("One ranked try today");

  await withStreak(page, previousDay(dayKey()), 2);
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
  await openGame(page);
  await expect(page.locator("#startDailySub")).toHaveText("2 günlük serini bozma");
});

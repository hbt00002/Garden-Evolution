import { test, expect, openGame, startGame, playToTheEnd, waitUntilHumanPaced } from "./fixtures.js";

// A whole run, end to end, through the real Worker: the browser plays from the
// seed the server handed out, the Worker replays the recorded moves and
// accepts the score, and the leaderboard shows the player's rank.
//
// Reduced motion makes each move take one frame, so a run lasts seconds.
test.use({ reducedMotion: "reduce" });

test("a finished run can be submitted and appears on the leaderboard", async ({ page }) => {
  await startGame(page);
  await playToTheEnd(page, { pace: 45 });
  await waitUntilHumanPaced(page);

  await expect(page.locator("#finalTitle")).toHaveText("No Moves Left");
  await expect(page.locator("#scoreForm")).toBeVisible();
  await expect(page.locator("#unrankedNote")).toBeHidden();
  const finalScore = (await page.locator("#finalScore").innerText()).replace(/,/g, "");

  await page.locator("#playerName").fill("E2E Runner");
  const submission = page.waitForResponse(
    response => response.url().endsWith("/api/leaderboard") && response.request().method() === "POST"
  );
  await page.locator("#submitScoreBtn").click();
  const response = await submission;
  // 201: the Worker replayed the record and it matched.
  expect(response.status(), await response.text()).toBe(201);
  await expect(page.locator("#scoreSubmitStatus")).toContainText("joined the garden");

  // The leaderboard opens on the all-time board with the new rank.
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  const own = page.locator("#leaderboardList .leaderboard-entry.own");
  await expect(own).toContainText("E2E Runner");
  await expect(own).toContainText(/you/i);
  await expect(own.locator(".leaderboard-score")).toHaveText(Number(finalScore).toLocaleString("en-US"));
  await expect(page.locator("#leaderboardMe")).toContainText("Your rank");
  await expect(page.locator("#leaderboardMe")).toContainText("E2E Runner");
  expect(page.problems).toEqual([]);
});

test("the Worker refuses a score that does not match the moves played", async ({ page }) => {
  await startGame(page);
  // Played at a humane pace, so the only thing wrong with the submission is the score.
  await playToTheEnd(page, { pace: 45 });
  await waitUntilHumanPaced(page);
  await page.locator("#playerName").fill("Cheater");
  // Tamper with the request on its way out: claim a score far above the real one.
  await page.route("**/api/leaderboard", async route => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = JSON.parse(request.postData());
    body.score += 5000;
    await route.continue({ postData: JSON.stringify(body) });
  });
  const submission = page.waitForResponse(
    response => response.url().endsWith("/api/leaderboard") && response.request().method() === "POST"
  );
  await page.locator("#submitScoreBtn").click();
  const response = await submission;
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe("Game record does not match the score.");
  await expect(page.locator("#scoreSubmitStatus")).toContainText("could not be submitted");
});

test("a name that is not allowed is refused with a clear message", async ({ page }) => {
  await startGame(page);
  await playToTheEnd(page, { pace: 45 });
  await page.locator("#playerName").fill("Admin");
  await page.locator("#submitScoreBtn").click();
  await expect(page.locator("#scoreSubmitStatus")).toContainText("name is not allowed");
  await expect(page.locator("#playerName")).toBeFocused();
  // Nothing was lost: a better name goes through.
  await waitUntilHumanPaced(page);
  await page.locator("#playerName").fill("Garden Fan");
  const submission = page.waitForResponse(
    response => response.url().endsWith("/api/leaderboard") && response.request().method() === "POST"
  );
  await page.locator("#submitScoreBtn").click();
  expect((await submission).status()).toBe(201);
});

test("without a server session the game still plays, unranked, with an explanation", async ({ page }) => {
  await page.route("**/api/session", route => route.abort());
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  // The game waits a moment for the session, then starts anyway.
  await expect(page.locator("#tiles .tile")).toHaveCount(2, { timeout: 8000 });
  await playToTheEnd(page);
  await expect(page.locator("#unrankedNote")).toBeVisible();
  await expect(page.locator("#scoreForm")).toBeHidden();
  await expect(page.locator("#playAgainBtn")).toBeVisible();
});

test("play again starts a fresh ranked run", async ({ page }) => {
  await startGame(page);
  await playToTheEnd(page);
  await page.locator("#playAgainBtn").click();
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await expect(page.locator("#score")).toHaveText("0");
});

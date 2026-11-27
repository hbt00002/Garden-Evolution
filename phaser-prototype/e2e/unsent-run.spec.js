import { test, expect, startGame, playToTheEnd, waitUntilHumanPaced, openGame } from "./fixtures.js";

// A finished game whose score could not be sent is kept and offered on the
// start menu next time; one closed on purpose without saving is not.
test.use({ reducedMotion: "reduce" });

const card = page => page.locator("#pendingRun");

async function finishWithoutSending(page) {
  await startGame(page);
  await playToTheEnd(page, { pace: 45 });
  await waitUntilHumanPaced(page);
  await page.route("**/api/leaderboard", route => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.locator("#playerName").fill("Garden Fan");
  await page.locator("#submitScoreBtn").click();
  await expect(page.locator("#scoreSubmitStatus")).not.toHaveText("");
  await page.unroute("**/api/leaderboard");
  return Number((await page.locator("#score").textContent()).replace(/\D/g, ""));
}

test("a run whose score could not be sent is offered on the menu next time, and sends", async ({ page }) => {
  const score = await finishWithoutSending(page);
  await page.reload();
  page.problems = [];                     // the deliberately failed send is not a problem
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("Your last game wasn't sent");
  await expect(card(page).locator("#pendingScore")).toHaveText(score.toLocaleString("en"));
  await expect(page.locator("#pendingName")).toHaveValue("");
  await page.locator("#pendingName").fill("Garden Fan");
  await page.locator("#pendingSendBtn").click();
  await expect(page.locator("#pendingStatus")).toContainText("joined the garden");
  await expect(card(page)).toBeHidden({ timeout: 5000 });
  await page.reload();
  await expect(page.locator("#startPlayBtn")).toBeVisible();
  await expect(card(page)).toBeHidden();
  expect(page.problems).toEqual([]);
});

test("a run whose end card was closed without saving is not offered", async ({ page }) => {
  await startGame(page);
  await playToTheEnd(page, { pace: 45 });
  await page.locator("#playAgainBtn").click();
  await page.reload();
  await expect(page.locator("#startPlayBtn")).toBeVisible();
  await expect(card(page)).toBeHidden();
});

test("Not now forgets it", async ({ page }) => {
  await finishWithoutSending(page);
  await page.reload();
  await expect(card(page)).toBeVisible();
  await page.locator("#pendingLaterBtn").click();
  await expect(card(page)).toBeHidden();
  await page.reload();
  await expect(page.locator("#startPlayBtn")).toBeVisible();
  await expect(card(page)).toBeHidden();
});

test("a failed send is still offered after Play again", async ({ page }) => {
  await finishWithoutSending(page);
  await page.locator("#playAgainBtn").click();
  await page.reload();
  await expect(card(page)).toBeVisible();
});

test("an expired run is not offered, and is forgotten", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const iat = Date.now() - 15 * 24 * 60 * 60 * 1000;
    localStorage.setItem("gardenEvolutionPendingRun", JSON.stringify({
      mode: "classic", day: null, session: { sid: "old", iat, sig: "x" }, score: 900, maxTile: 64, bestCombo: 2, reachedStage: 1, moves: "LR", finishedAt: iat
    }));
  });
  await openGame(page);
  await expect(card(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("gardenEvolutionPendingRun"))).toBeNull();
});

test("in Turkish the card says Son oyunun gönderilmedi", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
  await finishWithoutSending(page);
  await page.reload();
  await expect(card(page)).toContainText("Son oyunun gönderilmedi");
  await expect(page.locator("#pendingSendBtn")).toHaveText("Gönder");
  await expect(page.locator("#pendingLaterBtn")).toHaveText("Şimdi değil");
});

test("from the menu, a lower score asks first, like the end card", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const iat = Date.now() - 3600_000;
    localStorage.setItem("gardenEvolutionPendingRun", JSON.stringify({
      mode: "classic", day: null, session: { sid: "11111111-2222-4333-8444-555555555555", iat, sig: "x" },
      score: 900, maxTile: 64, bestCombo: 2, reachedStage: 1, moves: "LR", finishedAt: iat
    }));
  });
  const sent = [];
  await page.route("**/api/leaderboard", route => {
    if (route.request().method() !== "POST") return route.continue();
    const body = JSON.parse(route.request().postData());
    sent.push(body.replaceLowerScore);
    return body.replaceLowerScore
      ? route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, playerName: "Garden Fan" }) })
      : route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "lower_score_confirmation_required", currentScore: 7000 }) });
  });
  await openGame(page);
  await page.locator("#pendingName").fill("Garden Fan");
  await page.locator("#pendingSendBtn").click();
  await expect(page.locator("#lowerScoreConfirm")).toBeVisible();
  await page.locator("#confirmLowerScore").click();
  await expect(page.locator("#pendingStatus")).toContainText("joined the garden");
  expect(sent).toEqual([false, true]);
});

import { test, expect, openGame, startGame, boardSnapshot } from "./fixtures.js";

// These guard the basics a visitor needs: the menu responds to a real click,
// the game starts, and the keyboard plays it. They use real mouse and
// keyboard input on purpose: scripted .click() calls bypass the very things
// (inert elements, overlays) that once left every button dead.

test("the start menu is usable and Play starts a game", async ({ page }) => {
  await openGame(page);
  // The game behind the menu must be out of reach until the player starts.
  await expect(page.locator("main.game")).toHaveJSProperty("inert", true);
  await expect(page.locator("#startScreen")).not.toHaveJSProperty("inert", true);

  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#startScreen")).toBeHidden();
  await expect(page.locator("main.game")).toHaveJSProperty("inert", false);
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  expect(page.problems).toEqual([]);
});

test("arrow keys play the game", async ({ page }) => {
  await startGame(page);
  const before = await boardSnapshot(page);
  const moves = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  let changed = false;
  for (const key of moves) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    if ((await boardSnapshot(page)) !== before) { changed = true; break; }
  }
  expect(changed, "at least one arrow key must move a tile").toBe(true);
  await expect(page.locator("#score")).toHaveText(/^\d+$/);
  expect(page.problems).toEqual([]);
});

test("keyboard shortcuts are not hijacked and any keyboard layout works", async ({ page }) => {
  await startGame(page);
  const press = init => page.evaluate(options => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...options });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, init);

  expect(await press({ key: "s", code: "KeyS", ctrlKey: true }), "Ctrl+S").toBe(false);
  expect(await press({ key: "d", code: "KeyD", metaKey: true }), "Cmd+D").toBe(false);
  expect(await press({ key: "a", code: "KeyA", altKey: true }), "Alt+A").toBe(false);
  expect(await press({ key: "ц", code: "KeyW" }), "W on a Russian layout").toBe(true);
  expect(await press({ key: "ArrowLeft", code: "ArrowLeft" }), "arrow key").toBe(true);
});

test("arrow keys scroll the leaderboard instead of moving tiles while it is open", async ({ page }) => {
  await startGame(page);
  await page.locator("#leaderboardBtn").click();
  await expect(page.locator("#leaderboardModal")).toBeVisible();
  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test("a visitor's saved settings and an old-format save cannot break the page", async ({ page }) => {
  // What an older version of the game, and a long-time visitor, leave behind.
  await page.addInitScript(() => {
    localStorage.setItem("gardenEvolutionSave", JSON.stringify({
      version: 1, savedAt: Date.now() - 3_600_000,
      board: [[2, 4, 0, 0], [0, 8, 16, 0], [0, 0, 0, 32], [0, 0, 0, 0]],
      score: 120, maxValueReached: 32, bestCombo: 3, completedMoves: 14, goldenAchieved: false,
      session: { sid: "0b9d6c3e-6a43-4a0e-9d5b-0c1d2e3f4a5b", iat: Date.now() - 3_600_000, sig: "ab".repeat(32) }
    }));
    localStorage.setItem("gardenEvolutionLanguage", "tr");
    localStorage.setItem("gardenEvolutionBest", "1234");
    localStorage.setItem("gardenEvolutionMusic", "banana");
  });
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#startScreen")).toBeHidden();
  // The unreadable old save is ignored and a fresh game starts.
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await expect(page.locator("#best")).toHaveText("1234");
  expect(page.problems).toEqual([]);
});

test("a game in progress is restored after a reload and keeps going", async ({ page }) => {
  await startGame(page);
  const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  let played = 0;
  for (let i = 0; played < 8 && i < 60; i++) {
    const before = await boardSnapshot(page);
    await page.keyboard.press(keys[i % 4]);
    await page.waitForTimeout(280);
    if ((await boardSnapshot(page)) !== before) played++;
  }
  expect(played).toBeGreaterThanOrEqual(8);
  const board = await boardSnapshot(page);
  const score = await page.locator("#score").innerText();

  await page.reload();
  await expect(page.locator("#grid .cell")).toHaveCount(16);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#startScreen")).toBeHidden();
  expect(await boardSnapshot(page)).toBe(board);
  await expect(page.locator("#score")).toHaveText(score);

  // And it is still a live game.
  const restored = await boardSnapshot(page);
  let moved = false;
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    if ((await boardSnapshot(page)) !== restored) { moved = true; break; }
  }
  expect(moved).toBe(true);
});

test("the language can be switched and is remembered", async ({ page }) => {
  await openGame(page);
  await page.locator("#startSettingsBtn").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await page.locator("#languageSelect").selectOption("tr");
  await expect(page.locator("#startPlayBtn")).toHaveText("Oyna");
  await page.locator("#settingsClose").click();

  await page.reload();
  await expect(page.locator("#startPlayBtn")).toHaveText("Oyna");
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile").first()).toHaveAttribute("aria-label", /\d/);
  // A tile's screen-reader label is in the chosen language too ("Seed" -> "Tohum").
  await expect(page.locator("#tiles .tile").first()).toHaveAttribute("aria-label", /Tohum|Filiz/);
});

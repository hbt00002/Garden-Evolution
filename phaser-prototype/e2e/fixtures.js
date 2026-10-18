import { test as base, expect } from "@playwright/test";
import { isTimingPlausible } from "../cloudflare/worker.js";

// The device the seeded leaderboard knows as "E2E Me" (see seed.sql).
export const ME_DEVICE = "11111111-1111-4111-8111-111111111111";

// Console errors that are not the game's fault. Headless Chrome renders WebGL
// in software, which can fail to create a framebuffer inside Phaser.
const BENIGN = [/Framebuffer status: Incomplete Attachment/];

export const test = base.extend({
  // Every test gets its own browser fingerprint (the Worker rate-limits by IP
  // and user agent), so one test's games cannot use up another's allowance.
  userAgent: async ({}, use, testInfo) => {
    await use(`GardenEvolution-E2E/${testInfo.workerIndex}.${testInfo.testId}.${testInfo.retry}`);
  },

  // The page, plus a list of everything that went wrong in it.
  page: async ({ page }, use) => {
    page.problems = [];
    page.on("pageerror", error => page.problems.push(`page error: ${error.message}`));
    page.on("console", message => {
      if (message.type() === "error" && !BENIGN.some(pattern => pattern.test(message.text()))) {
        page.problems.push(`console: ${message.text()}`);
      }
    });
    await use(page);
  }
});

export { expect };

/* ---------- Helpers ---------- */

// Opens the game and waits until the menu is usable.
export async function openGame(page) {
  await page.goto("/");
  await expect(page.locator("#startPlayBtn")).toBeVisible();
  // The game's code arrives after the first paint; its marker is the board grid.
  await expect(page.locator("#grid .cell")).toHaveCount(16);
}

// Presses Play with a real click and waits for the first two tiles.
export async function startGame(page) {
  await openGame(page);
  // The Worker's session starts when Play is pressed; remember when, so a test
  // can wait until a submission would look humanly paced (see waitUntilHumanPaced).
  page.playStartedAt = Date.now();
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#startScreen")).toBeHidden();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
}

// A snapshot of the board: every tile's label and position.
export const boardSnapshot = page =>
  page.evaluate(() =>
    [...document.querySelectorAll("#tiles .tile")]
      .map(tile => `${tile.getAttribute("aria-label")}@${tile.style.transform}`)
      .sort()
      .join("|")
  );

// Plays random moves from inside the page until the run ends (or `limit`).
// Pair it with reduced motion so a move takes one frame, not a slide animation.
// `pace` adds a pause per move: the Worker refuses runs that were played faster
// than a person can (at least 40 ms a move), so a run that is going to be
// submitted must not be rushed. Runs that are not submitted can use pace 0.
export async function playToTheEnd(page, { limit = 4000, pace = 0 } = {}) {
  await page.evaluate(async ({ max, delay }) => {
    const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
    const overlay = document.getElementById("overlay");
    const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
    for (let move = 0; move < max && overlay.hidden; move++) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      window.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }));
      await frame();
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, { max: limit, delay: pace });
  await expect(page.locator("#overlay")).toBeVisible();
}

// The Worker also expects a run that reached a big plant to have taken a
// while (a 256 needs 35 s). Waits, if needed, until the finished run's age
// passes that floor, with a margin for the session starting just after Play.
export async function waitUntilHumanPaced(page) {
  const maxTile = Number((await page.locator("#finalTile").innerText()).replace(/\D/g, ""));
  while (!isTimingPlausible(maxTile, Date.now() - page.playStartedAt - 2500)) {
    await page.waitForTimeout(500);
  }
}

// Plays `count` valid moves (full animation speed) so a saved game exists.
export async function playMoves(page, count) {
  let played = 0;
  const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  for (let attempt = 0; played < count && attempt < count * 6; attempt++) {
    const before = await boardSnapshot(page);
    await page.keyboard.press(keys[attempt % keys.length]);
    await page.waitForTimeout(260);
    if ((await boardSnapshot(page)) !== before) played++;
  }
  return played;
}

// Starts the page as a returning player the seeded leaderboard knows.
export const asSeededPlayer = page =>
  page.addInitScript(device => localStorage.setItem("gardenEvolutionDeviceId", device), ME_DEVICE);

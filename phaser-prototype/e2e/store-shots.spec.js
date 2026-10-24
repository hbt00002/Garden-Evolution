import { test, expect, openGame } from "./fixtures.js";
import { mkdirSync } from "node:fs";
import { dayKey, previousDay } from "../src/daily.js";

// The pictures for the store listings, at the sizes the stores ask for. Not a
// test: it only runs when asked for.
//
//   STORE_SHOTS=1 npx playwright test e2e/store-shots.spec.js
//
// Writes store/screenshots/<device>/<language>-<n>-<scene>.png and
// store/feature-graphic-<language>.png (Google Play's 1024 x 500 banner).
test.skip(!process.env.STORE_SHOTS, "Only when making the store pictures (STORE_SHOTS=1).");
test.use({ reducedMotion: "reduce" });
test.setTimeout(240_000);

const DEVICES = [
  { name: "play-phone", viewport: { width: 360, height: 640 }, scale: 3 },       // 1080 x 1920
  { name: "iphone-6.9", viewport: { width: 440, height: 956 }, scale: 3 },      // 1320 x 2868
  { name: "ipad-13", viewport: { width: 1032, height: 1376 }, scale: 2 }        // 2064 x 2752
];
const LANGUAGES = ["en", "tr"];

// A leaderboard with friendly names instead of the test data's "Player 01".
const NAMES = ["Sakura", "Mossy", "Fern", "Juniper", "Willow", "Bramble", "Clover", "Hazel", "Maple", "Ivy", "Rowan", "Basil"];
const board = NAMES.map((name, i) => ({
  player_name: name,
  score: 31240 - i * 1870,
  max_tile: [2048, 2048, 1024, 1024, 1024, 512, 512, 512, 256, 256, 256, 128][i],
  best_combo: 9 - (i % 5),
  reached_stage: [5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2][i],
  created_at: new Date().toISOString()
}));

async function prepare(page, language) {
  // A four-day streak that today's garden can carry on (the menu shows it).
  const yesterday = previousDay(dayKey());
  await page.addInitScript(({ language, yesterday }) => {
    localStorage.setItem("gardenEvolutionLanguage", language);
    localStorage.setItem("gardenEvolutionBest", "24816");
    localStorage.setItem("gardenEvolutionAchievements", JSON.stringify({
      stats: { gamesFinished: 23, bestScore: 24816, bestTile: 2048, bestCombo: 8, dailiesPlayed: 6, dailyStreak: 4, bestDailyStreak: 4, lastDailyDay: yesterday, shares: 1, gardenViews: 3 },
      unlocked: { firstGame: 1, world2: 1, world3: 1, world4: 1, sakuraCrown: 1, combo5: 1, score10k: 1, games10: 1, dailyFirst: 1, dailyStreak3: 1, sharer: 1, explorer: 1 }
    }));
  }, { language, yesterday });
  await page.route("**/api/leaderboard?period=daily", route => route.fulfill({ json: { period: "daily", day: "2026-10-24", entries: board } }));
  await page.route("**/api/leaderboard", route => (route.request().method() === "GET" ? route.fulfill({ json: { period: "all", entries: board } }) : route.continue()));
  await page.route("**/api/leaderboard/me**", route => route.fulfill({ json: { rank: 4, total: 1284, entry: board[3] } }));
}

const shoot = (page, device, language, n, scene) =>
  page.screenshot({ path: `store/screenshots/${device}/${language}-${n}-${scene}.png` });

for (const device of DEVICES) {
  for (const language of LANGUAGES) {
    test(`${device.name} ${language}`, async ({ browser }) => {
      mkdirSync(`store/screenshots/${device.name}`, { recursive: true });
      const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: device.scale, hasTouch: true, isMobile: device.name !== "ipad-13", reducedMotion: "reduce" });
      const page = await context.newPage();
      page.problems = [];
      await prepare(page, language);

      // 1. The menu.
      await openGame(page);
      await page.waitForTimeout(1500);
      await shoot(page, device.name, language, 1, "menu");

      // 2. A game in the third world, with the plants growing.
      await page.goto("/?stage=3&tiles=preview");
      await expect(page.locator("#grid .cell")).toHaveCount(16);
      await page.locator("#startPlayBtn").click();
      await expect(page.locator("#startScreen")).toBeHidden();
      await page.evaluate(() => {
        document.getElementById("score").textContent = "18432";
      });
      await page.waitForTimeout(1500);
      await shoot(page, device.name, language, 2, "game");

      // 3. Today's garden on the leaderboard.
      await page.locator("#leaderboardBtn").click();
      await page.locator("#lbTab-daily").click();
      await expect(page.locator("#leaderboardList .leaderboard-entry").first()).toBeVisible();
      await page.waitForTimeout(600);
      await shoot(page, device.name, language, 3, "daily");
      await page.keyboard.press("Escape");

      // 4. Achievements.
      await page.locator("#settingsBtn").click();
      await page.locator("#settingsAchievementsBtn").click();
      await expect(page.locator("#achievementsModal")).toBeVisible();
      await page.waitForTimeout(600);
      await shoot(page, device.name, language, 4, "achievements");

      // 5. The last world, completed.
      await page.goto("/?ending=victory");
      await expect(page.locator("#overlay.ready")).toBeVisible({ timeout: 15_000 });
      // The preview is not a real run: show it as a ranked one would look.
      await page.evaluate(() => {
        document.getElementById("unrankedNote").hidden = true;
        document.getElementById("finalCombo").textContent = "9×";
      });
      await page.waitForTimeout(1200);
      await shoot(page, device.name, language, 5, "victory");
      await context.close();
    });
  }
}

for (const language of LANGUAGES) {
  test(`feature graphic ${language}`, async ({ browser }) => {
    mkdirSync("store", { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.problems = [];
    await prepare(page, language);
    await openGame(page);
    // Just the painting and the title: no buttons on a banner.
    await page.addStyleTag({ content: ".start-actions { display: none !important; } .start-menu { grid-template-columns: 1fr !important; } .start-title { font-size: 6.2rem !important; }" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `store/feature-graphic-${language}.png` });
    await context.close();
  });
}

import { test, expect, openGame } from "./fixtures.js";

// What happens when parts of the page are blocked or slow. An ad blocker once
// replaced the game's code with the site's HTML page and left every button
// dead with no explanation; these keep that from coming back.

const HTML_STANDIN = { status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>blocked</title>" };

test("when the game's code is blocked, the visitor is told what to do", async ({ page }) => {
  await page.route(/\/assets\/game-[^/]+\.js$/, route => route.fulfill(HTML_STANDIN));
  await page.goto("/");
  const overlay = page.locator("#loadError");
  await expect(overlay).toBeVisible();
  await expect(page.locator("#loadErrorTitle")).toHaveText("The game could not load");
  await expect(page.locator("#loadErrorText")).toContainText("ad blocker");
  await expect(page.locator("#loadErrorRetry")).toBeFocused();
  await expect(page.locator("#loadErrorRetry")).toHaveText("Reload");
});

test("the blocked-game message follows the visitor's language", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
  await page.route(/\/assets\/game-[^/]+\.js$/, route => route.fulfill(HTML_STANDIN));
  await page.goto("/");
  await expect(page.locator("#loadErrorTitle")).toHaveText("Oyun yüklenemedi");
  await expect(page.locator("#loadErrorRetry")).toHaveText("Yenile");
});

test("the reload button reloads the page and the game then loads", async ({ page }) => {
  let blocked = true;
  await page.route(/\/assets\/game-[^/]+\.js$/, route => (blocked ? route.fulfill(HTML_STANDIN) : route.continue()));
  await page.goto("/");
  await expect(page.locator("#loadError")).toBeVisible();
  blocked = false; // the visitor turned the blocker off
  await page.locator("#loadErrorRetry").click();
  await expect(page.locator("#startPlayBtn")).toBeVisible();
  await expect(page.locator("#loadError")).toBeHidden();
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
});

test("the load-error message does not appear on a normal visit", async ({ page }) => {
  await openGame(page);
  await expect(page.locator("#loadError")).toBeHidden();
});

test("when the scenery cannot load, the game still plays on the built-in backdrop", async ({ page }) => {
  await page.route(/\/assets\/(scenery|vendor)-[^/]+\.js$/, route => route.fulfill(HTML_STANDIN));
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await expect(page.locator("#loadError")).toBeHidden();
  // The SVG backdrop took over.
  await expect(page.locator("#env")).not.toHaveAttribute("data-phaser-active", /.*/);
  await expect.poll(() => page.locator(".env-sky").evaluate(node => node.childElementCount)).toBeGreaterThan(0);
});

test("the game is ready before the (slow) scenery arrives", async ({ page }) => {
  await page.route(/\/assets\/vendor-[^/]+\.js$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    await route.continue();
  });
  await openGame(page);
  // Play works while Phaser is still on its way.
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);

  const marks = () => page.evaluate(() =>
    Object.fromEntries(performance.getEntriesByType("mark").map(mark => [mark.name, mark.startTime])));
  expect(Object.keys(await marks())).not.toContain("scenery-ready");

  await expect.poll(async () => Object.keys(await marks()), { timeout: 20_000 }).toContain("scenery-ready");
  const { "game-ready": game, "scenery-ready": scenery } = await marks();
  expect(game).toBeLessThan(scenery - 1500);
  // The backdrop that arrived late is Phaser's, and the game is unaffected.
  await expect(page.locator("#env")).toHaveAttribute("data-phaser-active", "");
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
});

test("a slow or failing session request does not freeze the board", async ({ page }) => {
  await page.route("**/api/session", async route => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    await route.abort();
  });
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  // The game gives up waiting after a few seconds and starts unranked.
  await expect(page.locator("#tiles .tile")).toHaveCount(2, { timeout: 8000 });
});

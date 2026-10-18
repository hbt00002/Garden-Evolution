import { test, expect, openGame, startGame } from "./fixtures.js";

// What the page is allowed to load and how it is served: no third-party
// requests, the Content-Security-Policy intact, and caching that makes the
// second visit fast.

test("the page makes no third-party requests and breaks no security policy", async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const foreign = [];
  page.on("request", request => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
  });
  const violations = [];
  await page.exposeFunction("reportViolation", detail => violations.push(detail));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", event =>
      window.reportViolation(`${event.violatedDirective}: ${event.blockedURI}`));
  });

  await startGame(page);
  await page.locator("#settingsBtn").click();
  await page.keyboard.press("Escape");
  await page.locator("#leaderboardBtn").click();
  await expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton)")).toBeVisible();

  expect(foreign, "requests to other hosts").toEqual([]);
  expect(violations, "Content-Security-Policy violations").toEqual([]);
  expect(page.problems).toEqual([]);
});

test("the document carries the security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["cache-control"]).toContain("max-age=0");
});

test("scripts are neutrally named, immutable and the right type", async ({ page }) => {
  const scripts = [];
  page.on("response", response => {
    if (/\/assets\/[^/]+\.js$/.test(response.url())) scripts.push(response);
  });
  await openGame(page);
  await expect.poll(() => scripts.length).toBeGreaterThanOrEqual(2);
  for (const response of scripts) {
    const name = new URL(response.url()).pathname.split("/").pop();
    expect(name, "no filter-list bait in a file name").not.toMatch(/script|ads?-|track|analytics/i);
    expect(response.headers()["content-type"], name).toContain("javascript");
    expect(response.headers()["cache-control"], name).toContain("immutable");
  }
});

test("the menu backdrop is a preloaded WebP", async ({ page }) => {
  const images = [];
  page.on("response", response => {
    if (response.url().includes("/assets/menu/")) images.push(response);
  });
  await openGame(page);
  await expect.poll(() => images.some(response => response.url().endsWith(".webp"))).toBe(true);
  const backdrop = images.find(response => response.url().endsWith(".webp"));
  expect(backdrop.headers()["content-type"]).toBe("image/webp");
  expect(images.every(response => !response.url().endsWith("menu-bg-day.png"))).toBe(true);
});

test("the phone layout has no sideways scrolling anywhere", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const overflows = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  await openGame(page);
  expect(await overflows(), "menu").toBe(false);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  expect(await overflows(), "game").toBe(false);
  await page.locator("#leaderboardBtn").click();
  await expect(page.locator("#leaderboardList .lb-rows:not(.lb-skeleton)")).toBeVisible();
  expect(await overflows(), "leaderboard").toBe(false);
  // The close button is reachable on a small screen.
  const box = await page.locator("#leaderboardClose").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
});

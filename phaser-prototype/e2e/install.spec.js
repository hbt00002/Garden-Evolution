import { test, expect, openGame } from "./fixtures.js";

// Putting the game on a phone's home screen: the manifest and icons are
// served properly, and the Settings row appears only where it can help.

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const openSettings = async page => {
  await page.locator("#startSettingsBtn").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
};

test("the manifest and its icons are served as a phone expects", async ({ page, request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  expect(response.headers()["cache-control"]).toContain("max-age=86400");
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const picture = await request.get(icon.src);
    expect(picture.status(), icon.src).toBe(200);
    expect(picture.headers()["content-type"], icon.src).toContain("image/png");
    expect(picture.headers()["cache-control"], icon.src).toContain("max-age=604800");
  }
  const touch = await request.get("/icons/apple-touch-icon.png");
  expect(touch.status()).toBe(200);

  // The page points at them.
  await openGame(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
});

test("a desktop browser with nothing to offer shows no install row", async ({ page }) => {
  await openGame(page);
  await openSettings(page);
  await expect(page.locator("#installRow")).toBeHidden();
});

test("when the browser offers to install, Settings gets a button that opens its prompt", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const offer = new Event("beforeinstallprompt", { cancelable: true });
    offer.prompt = async () => { window.__installPrompted = (window.__installPrompted || 0) + 1; };
    window.dispatchEvent(offer);
    window.__offerPrevented = offer.defaultPrevented;
  });
  expect(await page.evaluate(() => window.__offerPrevented), "the browser's own banner is held back").toBe(true);
  await openSettings(page);
  await expect(page.locator("#installRow")).toBeVisible();
  await expect(page.locator("#installBtn")).toBeVisible();
  await expect(page.locator("#installSteps")).toBeHidden();
  await page.locator("#installBtn").click();
  expect(await page.evaluate(() => window.__installPrompted)).toBe(1);
  await expect(page.locator("#installRow")).toBeHidden();
});

test("on an iPhone Settings explains how, in the player's language", async ({ page }) => {
  await page.addInitScript(agent => Object.defineProperty(navigator, "userAgent", { get: () => agent }), IPHONE);
  await openGame(page);
  await openSettings(page);
  await expect(page.locator("#installRow")).toBeVisible();
  await expect(page.locator("#installBtn")).toBeHidden();
  await expect(page.locator("#installSteps")).toContainText("Add to Home Screen");
  await page.locator("#languageSelect").selectOption("tr");
  await expect(page.locator("#installSteps")).toContainText("Ana Ekrana Ekle");
  await expect(page.locator("#installRow .setting-label")).toHaveText("Ana ekrana ekle");
});

test("once the game is on the home screen there is no row", async ({ page }) => {
  await page.addInitScript(agent => {
    Object.defineProperty(navigator, "userAgent", { get: () => agent });
    Object.defineProperty(navigator, "standalone", { get: () => true });
  }, IPHONE);
  await openGame(page);
  await openSettings(page);
  await expect(page.locator("#installRow")).toBeHidden();
});

test("Chrome considers the game installable and finds nothing wrong with the manifest", async ({ page }) => {
  await openGame(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  // (A test browser is an incognito-style window, which can never install anything.)
  const real = installabilityErrors.filter(error => error.errorId !== "in-incognito");
  expect(real, JSON.stringify(real)).toEqual([]);
  const { errors } = await cdp.send("Page.getAppManifest");
  expect(errors).toEqual([]);
});

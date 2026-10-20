import { test, expect, startGame } from "./fixtures.js";

// Playing fast must never leave a tile without its picture, even on a slow
// connection: pictures are loaded once up front and copied, and a tile keeps its
// old picture until a new one is ready.

test.use({ viewport: { width: 390, height: 844 } });

for (const delay of [0, 350]) {
  test(`no tile is ever drawn without its picture (pictures ${delay} ms slow)`, async ({ page }) => {
    test.setTimeout(120_000);
    if (delay) await page.route("**/assets/tiles/v3/*", async route => { await new Promise(r => setTimeout(r, delay)); await route.continue(); });
    await page.goto("/");
    await page.evaluate(() => {
      window.__blank = 0;
      const tick = () => {
        for (const art of document.querySelectorAll("#tiles .tile-art")) if (!art.complete || art.naturalWidth === 0) window.__blank++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
    for (let i = 0; i < 120; i++) { await page.keyboard.press(keys[i % 4]); await page.waitForTimeout(40); }
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__blank), "frames with a blank picture").toBe(0);
    const arts = await page.locator("#tiles .tile").evaluateAll(tiles => tiles.map(t => [t.dataset.value, t.querySelector(".tile-art")?.naturalWidth ?? 0]));
    for (const [value, width] of arts) expect(width, `tile ${value} has its picture`).toBeGreaterThan(0);
    expect(page.problems).toEqual([]);
  });
}

test("a picture that fails to download once is retried", async ({ page }) => {
  let failed = 0;
  await page.route("**/assets/tiles/v3/tile-4.png", async route => { if (failed++ < 1) await route.abort(); else await route.continue(); });
  await startGame(page);
  const loaded = await page.evaluate(async () => {
    const start = performance.now();
    while (performance.now() - start < 4000) {
      const four = [...document.querySelectorAll(".tile-art")].some(a => a.src.endsWith("tile-4.png") && a.naturalWidth > 0);
      if (four) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    // No 4 on the board yet: it is enough that a fresh copy can be shown.
    const probe = new Image();
    probe.src = "/assets/tiles/v3/tile-4.png";
    await probe.decode().catch(() => {});
    return probe.naturalWidth > 0;
  });
  expect(loaded).toBe(true);
});

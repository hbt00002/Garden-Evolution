import { test, expect, startGame } from "./fixtures.js";

// A player who switches to another app or tab must not hear the garden there.
const hide = (page, hidden) => page.evaluate(value => {
  Object.defineProperty(document, "hidden", { value, configurable: true });
  Object.defineProperty(document, "visibilityState", { value: value ? "hidden" : "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}, hidden);

test("the garden's audio sleeps while the game is in the background and wakes when it returns", async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioCalls = { suspend: 0, resume: 0 };
    const proto = (window.AudioContext || window.webkitAudioContext).prototype;
    const suspend = proto.suspend; const resume = proto.resume;
    proto.suspend = function (...args) { window.__audioCalls.suspend++; return suspend.apply(this, args); };
    proto.resume = function (...args) { window.__audioCalls.resume++; return resume.apply(this, args); };
  });
  await startGame(page);
  const before = await page.evaluate(() => ({ ...window.__audioCalls }));
  await hide(page, true);
  await expect.poll(() => page.evaluate(() => window.__audioCalls.suspend)).toBeGreaterThan(before.suspend);
  await hide(page, false);
  await expect.poll(() => page.evaluate(() => window.__audioCalls.resume)).toBeGreaterThan(before.resume);
});

import { test, expect } from "./fixtures.js";

// The start menu's small buttons keep every word whole, in every language: a
// long word shrinks a little instead of breaking ("ACHIEVEMENT/S").
for (const [width, height, smallest] of [[320, 568, 10], [360, 640, 11], [390, 844, 11], [667, 223, 11], [844, 390, 11]]) {
  test(`${width}x${height}: the menu's words are never broken, and stay readable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator("#grid .cell")).toHaveCount(16);
    const languages = await page.locator("#languageSelect option").evaluateAll(options => options.map(o => o.value));
    const problems = [];
    for (const language of languages) {
      await page.evaluate(l => { const s = document.getElementById("languageSelect"); s.value = l; s.dispatchEvent(new Event("change")); }, language);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      for (const b of await page.locator(".start-btn-small").evaluateAll(buttons => buttons.map(b => ({
        text: b.textContent.trim(), wrap: getComputedStyle(b).overflowWrap, over: b.scrollWidth - b.clientWidth, size: parseFloat(getComputedStyle(b).fontSize)
      })))) {
        if (b.wrap === "anywhere" || b.wrap === "break-word") problems.push(`${language} "${b.text}" may break mid-word`);
        if (b.over > 0) problems.push(`${language} "${b.text}" overflows by ${b.over}px`);
        if (b.size < smallest) problems.push(`${language} "${b.text}" is ${b.size}px`);
      }
    }
    expect(problems).toEqual([]);
  });
}

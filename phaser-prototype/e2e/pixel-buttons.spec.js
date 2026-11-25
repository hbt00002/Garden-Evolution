import { test, expect, startGame } from "./fixtures.js";

// The game's buttons are pixel windows in the world's ink (DESIGN.md): flat,
// a double pixel frame, no capitals, at least 44 px, readable in every world.
const BUTTONS = ["#settingsBtn", "#viewBtn", "#leaderboardBtn", "#newBtn"];

const look = page => page.evaluate(ids => ids.map(id => {
  const b = document.querySelector(id);
  const cs = getComputedStyle(b);
  const parse = c => { const m = c.match(/^rgba?\(([^)]+)\)/); const [r, g, bl, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b: bl, a }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const fg = parse(getComputedStyle(b.querySelector("svg") || b).color); const bg = parse(cs.backgroundColor);
  const rect = b.getBoundingClientRect();
  return { id, w: rect.width, h: rect.height, gradient: cs.backgroundImage, caps: cs.textTransform, bgAlpha: bg.a,
    ratio: (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05) };
}), BUTTONS);

for (const stage of [1, 2, 3, 4, 5]) {
  test(`world ${stage}: the buttons are flat pixel windows, 44 px or more, their labels readable`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    await page.evaluate(s => window.debugSetEnvironmentStage(s, true), stage);
    for (const b of await look(page)) {
      expect(b.w, `${b.id} width`).toBeGreaterThanOrEqual(44);
      expect(b.h, `${b.id} height`).toBeGreaterThanOrEqual(44);
      expect(b.gradient, `${b.id} has a gradient`).toBe("none");
      expect(b.caps, `${b.id} capitals`).toBe("none");
      expect(b.bgAlpha, `${b.id} see-through`).toBe(1);
      expect(b.ratio, `${b.id} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("on a phone held upright the leaderboard and new-game buttons share the row equally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  const [lead, neu] = await Promise.all([page.locator("#leaderboardBtn").boundingBox(), page.locator("#newBtn").boundingBox()]);
  expect(Math.abs(lead.width - neu.width)).toBeLessThan(2);
});

// Every language's label fits its button, on a narrow phone and a wide one.
for (const [width, height] of [[360, 640], [390, 844], [667, 223], [844, 390]]) {
  test(`${width}x${height}: the button labels fit in every language`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startGame(page);
    const languages = await page.locator("#languageSelect option").evaluateAll(options => options.map(o => o.value));
    const overflowing = [];
    for (const language of languages) {
      await page.evaluate(l => { const s = document.getElementById("languageSelect"); s.value = l; s.dispatchEvent(new Event("change")); }, language);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      for (const id of ["#leaderboardBtn", "#newBtn"]) {
        const over = await page.locator(id).evaluate(b => b.scrollWidth - b.clientWidth);
        if (over > 0) overflowing.push(`${language} ${id} by ${over}px`);
      }
    }
    expect(overflowing).toEqual([]);
  });
}

test("the main action carries a pointer before its label", async ({ page }) => {
  await startGame(page);
  expect(await page.locator("#newBtn").evaluate(b => getComputedStyle(b, "::before").content)).toBe('"▸"');
});

// The moonlit world's ink is a midnight blue, its badges a pale lilac, which sit
// with the night painting (the golden brown before did not).
test("the moonlit world writes in midnight blue", async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.debugSetEnvironmentStage(5, true));
  // The colour eases over to the new world's ink.
  await expect.poll(() => page.locator("#newBtn").evaluate(b => [getComputedStyle(b).backgroundColor, getComputedStyle(b).getPropertyValue("--ink-badge").trim(), getComputedStyle(b).getPropertyValue("--ink-badge-text").trim()]))
    .toEqual(["rgb(28, 49, 80)", "#dcd8f2", "#2f2a5e"]);
});

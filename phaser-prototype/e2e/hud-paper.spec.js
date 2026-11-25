import { test, expect, startGame } from "./fixtures.js";

// The title card, the scores and the world card are pieces of opaque scroll
// paper written in paper ink, so they read the same over every world's
// painting (the last world's light-on-dark text once vanished on them).
const TEXTS = [".brand .title", ".brand .hint", ".score-label", ".score-value", "#stageKicker", "#stageName", "#stageNext"];
const CARDS = [".brand", ".score-box", ".evolution"];

const readings = page => page.evaluate(({ texts, cards }) => {
  const parse = c => { const m = c.match(/^rgba?\(([^)]+)\)/); const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const card = el => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) return c; } return null; };
  return {
    contrast: texts.map(sel => {
      const el = document.querySelector(sel);
      const fg = lum(parse(getComputedStyle(el).color)); const bg = lum(card(el));
      return { sel, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
    }),
    opaque: cards.map(sel => ({ sel, alpha: parse(getComputedStyle(document.querySelector(sel)).backgroundColor).a })),
    capitals: [".score-label", "#stageKicker"].map(sel => getComputedStyle(document.querySelector(sel)).textTransform)
  };
}, { texts: TEXTS, cards: CARDS });

for (const stage of [1, 2, 3, 4, 5]) {
  test(`world ${stage}: the title, scores and world cards are opaque paper and every text on them reads at 4.5:1`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    await page.evaluate(s => window.debugSetEnvironmentStage(s, true), stage);
    await expect(page.locator("#env")).toHaveAttribute("data-stage", String(stage));
    const { contrast, opaque, capitals } = await readings(page);
    for (const { sel, ratio } of contrast) expect(ratio, `${sel} contrast`).toBeGreaterThanOrEqual(4.5);
    for (const { sel, alpha } of opaque) expect(alpha, `${sel} is see-through`).toBe(1);
    expect(capitals).toEqual(["none", "none"]);
  });
}

import { test, expect, openGame, asSeededPlayer } from "./fixtures.js";

// The game's windows are garden scrolls (DESIGN.md): the same paper and wooden
// rollers in every world, written in the ink of the world being played.
test.use({ reducedMotion: "reduce" });

const PAPER = "rgb(244, 234, 208)";

// Shows the windows as they look in world `stage` (the backdrop's marker).
const inWorld = (page, stage) => page.evaluate(value => { document.getElementById("env").dataset.stage = String(value); }, stage);
const style = (locator, property, pseudo = null) => locator.evaluate((el, [name, after]) => getComputedStyle(el, after).getPropertyValue(name).trim(), [property, pseudo]);

async function openLeaderboard(page) {
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  await expect(page.locator("#leaderboardModal")).toBeVisible();
}

test("the leaderboard opens as a garden scroll in the world's ink", async ({ page }) => {
  await openLeaderboard(page);
  const card = page.locator("#leaderboardModal .leaderboard-card");
  await inWorld(page, 1);
  expect(await style(card, "background-color")).toBe(PAPER);
  expect(await style(card, "border-top-left-radius")).toBe("0px");
  expect(await style(card, "height", "::before")).toBe("12px");
  expect(await style(card, "--ink-accent")).toBe("#205b9c");
  await inWorld(page, 3);
  expect(await style(card, "--ink-accent")).toBe("#43702d");
});

test("leaderboard rows sit on the paper without boxes", async ({ page }) => {
  await openLeaderboard(page);
  const rows = page.locator("#leaderboardList .lb-rows:not(.lb-skeleton) .leaderboard-entry");
  await expect(rows.first()).toBeVisible();
  const first = rows.first();
  expect(await style(first, "border-top-left-radius")).toBe("0px");
  expect(await style(first, "background-image")).toBe("none");
  expect(await style(first, "border-bottom-style")).toBe("dashed");
  expect(await style(rows.last(), "border-bottom-style")).toBe("none");
  // The rank is a small chipped square in the world's badge colours.
  await inWorld(page, 3);
  expect(await style(first.locator(".leaderboard-rank"), "background-color")).toBe("rgb(242, 201, 216)");
});

test("the selected tab is underlined in ink", async ({ page }) => {
  await openLeaderboard(page);
  await inWorld(page, 1);
  const tab = page.locator(".lb-tab[aria-selected='true']");
  expect(await style(tab, "border-bottom-color")).toBe("rgb(32, 91, 156)");
  expect(await style(tab, "background-image")).toBe("none");
});

test("small labels in the windows are written normally", async ({ page }) => {
  await openLeaderboard(page);
  for (const selector of [".lb-tab", ".lb-me-label", ".lb-you", ".lb-me-top"]) {
    const found = page.locator(selector).first();
    if (await found.count()) expect(await style(found, "text-transform"), selector).toBe("none");
  }
  await page.keyboard.press("Escape");
  await page.locator("#startAchievementsBtn").click();
  await expect(page.locator("#achievementsModal")).toBeVisible();
  expect(await style(page.locator("#achievementsSummary"), "text-transform")).toBe("none");
  expect(await style(page.locator(".ach-stats dt").first(), "text-transform")).toBe("none");
});

test("achievement stats and items are dashed lists, not boxes", async ({ page }) => {
  await openGame(page);
  await page.locator("#startAchievementsBtn").click();
  await expect(page.locator("#achievementsModal .achievements-card")).toHaveCSS("background-color", PAPER);
  const stat = page.locator(".ach-stats > div").first();
  expect(await style(stat, "border-top-left-radius")).toBe("0px");
  expect(await style(stat, "background-color")).toBe("rgba(0, 0, 0, 0)");
  const item = page.locator(".ach-item").first();
  expect(await style(item, "border-top-left-radius")).toBe("0px");
  expect(await style(item, "border-bottom-style")).toBe("dashed");
});

/* ---------- Settings ---------- */

async function openSettings(page) {
  await openGame(page);
  await page.locator("#startSettingsBtn").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
}

test("settings are grouped under sound, display and general", async ({ page }) => {
  await openSettings(page);
  await expect(page.locator(".settings-group-title")).toHaveText(["Sound", "Display", "General"]);
  expect(await style(page.locator("#settingsPanel"), "background-color")).toBe(PAPER);
  // The strip under a group's name is the world's badge colour.
  await inWorld(page, 3);
  expect(await style(page.locator(".settings-group-title").first(), "background-color")).toBe("rgb(242, 201, 216)");
});

test("a switch is a pixel checkbox that still switches", async ({ page }) => {
  await openSettings(page);
  await inWorld(page, 1);
  const sfx = page.locator("#sfxToggle");
  const box = await sfx.boundingBox();
  expect(Math.round(box.width)).toBe(22);
  expect(Math.round(box.height)).toBe(22);
  expect(await sfx.getAttribute("aria-checked")).toBe("true");
  expect(await style(sfx, "background-color")).toBe("rgb(32, 91, 156)");
  await sfx.click();
  expect(await sfx.getAttribute("aria-checked")).toBe("false");
  expect(await style(sfx, "background-color")).toBe(PAPER);
  // The whole row is still the tap target.
  const row = await page.locator(".setting-row", { has: sfx }).boundingBox();
  expect(row.height).toBeGreaterThanOrEqual(44);
  // Keyboard users see where they are, on the switches and on the language.
  await sfx.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  expect(await style(sfx, "outline-style")).not.toBe("none");
  await page.locator("#languageSelect").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await style(page.locator("#languageSelect"), "outline-style")).not.toBe("none");
});

test("long labels do not push the checkbox out on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "de"));
  await openSettings(page);
  const panel = await page.locator("#settingsPanel").boundingBox();
  for (const row of await page.locator("#settingsPanel .setting-row:visible").all()) {
    const rect = await row.boundingBox();
    expect(rect.x + rect.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("the in-game settings popover stays on screen", async ({ page }) => {
  for (const [width, height] of [[320, 568], [568, 320]]) {
    await page.setViewportSize({ width, height });
    await openGame(page);
    await page.locator("#startPlayBtn").click();
    await page.locator("#settingsBtn").click();
    const rect = await page.locator("#settingsPanel").boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(-0.5);
    expect(rect.y).toBeGreaterThanOrEqual(-0.5);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.5);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.5);
    await page.keyboard.press("Escape");
  }
});

/* ---------- The small windows and the end card ---------- */

// Shows a window without going through the game (only its look is tested here).
const reveal = (page, selector, mode) => page.evaluate(([sel, value]) => {
  const el = document.querySelector(sel);
  el.hidden = false;
  if (value) el.dataset.mode = value;
  el.classList.add("show", "ready");
}, [selector, mode]);

test("the small windows are scrolls too", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await reveal(page, "#newGameConfirm");
  await reveal(page, "#lowerScoreConfirm");
  await reveal(page, "#loadError");
  await reveal(page, "#overlay", "noMoves");
  for (const card of ["#newGameConfirm", "#lowerScoreConfirm .score-confirm-card", "#loadError .load-error-card", "#overlay .overlay-card"]) {
    const box = page.locator(card);
    expect(await style(box, "background-color"), card).toBe(PAPER);
    expect(await style(box, "border-top-left-radius"), card).toBe("0px");
    expect(await style(box, "height", "::before"), card).not.toBe("auto");
  }
});

test("the actions are flat ink buttons", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await reveal(page, "#overlay", "noMoves");
  await reveal(page, "#newGameConfirm");
  await inWorld(page, 2);
  const ink = "rgb(58, 114, 54)";
  for (const id of ["#playAgainBtn", "#submitScoreBtn", "#confirmNewGame"]) {
    expect(await style(page.locator(id), "background-color"), id).toBe(ink);
    expect(await style(page.locator(id), "background-image"), id).toBe("none");
    expect((await page.locator(id).boundingBox()).height, id).toBeGreaterThanOrEqual(44);
  }
  for (const id of ["#shareBtn", "#cancelNewGame"]) {
    expect(await style(page.locator(id), "background-color"), id).toBe(PAPER);
    expect(await style(page.locator(id), "background-image"), id).toBe("none");
    expect((await page.locator(id).boundingBox()).height, id).toBeGreaterThanOrEqual(44);
  }
  // The end card's labels are written normally.
  expect(await style(page.locator(".overlay-scores span").first(), "text-transform")).toBe("none");
  expect(await style(page.locator("#finalWorld"), "text-transform")).toBe("none");
});

test("the milestone and victory cards keep their own look", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  for (const [mode, radius] of [["milestone", "9px"], ["victory", "10px"]]) {
    await reveal(page, "#overlay", mode);
    const card = page.locator("#overlay .overlay-card");
    expect(await style(card, "background-image"), mode).toContain("linear-gradient");
    expect(await style(card, "border-top-left-radius"), mode).toBe(radius);
    expect(await style(page.locator("#playAgainBtn"), "background-color"), mode).not.toBe("rgb(58, 114, 54)");
  }
});

/* ---------- Every world, high contrast, small phones ---------- */

test("every world's ink reads on the paper", async ({ page }) => {
  await openLeaderboard(page);
  const pairs = await page.evaluate(async () => {
    const hex = value => { const v = value.trim().replace("#", ""); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };
    const lum = rgb => { const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const card = document.querySelector("#leaderboardModal .leaderboard-card");
    const out = [];
    for (const stage of [1, 2, 3, 4, 5]) {
      document.getElementById("env").dataset.stage = String(stage);
      const css = getComputedStyle(card);
      const v = name => css.getPropertyValue(name);
      out.push([stage, "accent", ratio(v("--ink-accent"), v("--paper"))]);
      out.push([stage, "badge", ratio(v("--ink-badge-text"), v("--ink-badge"))]);
      out.push([stage, "text", ratio(v("--paper-ink"), v("--paper"))]);
      out.push([stage, "soft text", ratio(v("--paper-ink-soft"), v("--paper"))]);
      out.push([stage, "paper on ink", ratio(v("--paper"), v("--ink-accent"))]);
    }
    return out;
  });
  for (const [stage, what, value] of pairs) expect(value, `world ${stage} ${what}`).toBeGreaterThanOrEqual(4.5);
});

test("the moon garden dims its paper", async ({ page }) => {
  await openLeaderboard(page);
  const card = page.locator("#leaderboardModal .leaderboard-card");
  await inWorld(page, 5);
  const color = await style(card, "background-color");
  expect(color).not.toBe(PAPER);
  const [r, g, b] = color.match(/\d+/g).map(Number);
  expect(r + g + b).toBeLessThan(244 + 234 + 208);
});

test("high contrast makes the rules solid and the paper plain", async ({ page }) => {
  await openLeaderboard(page);
  await page.evaluate(() => document.body.classList.add("high-contrast"));
  const row = page.locator("#leaderboardList .lb-rows:not(.lb-skeleton) .leaderboard-entry").first();
  await expect(row).toBeVisible();
  expect(await style(row, "border-bottom-style")).toBe("solid");
  await page.keyboard.press("Escape");
  await page.locator("#startSettingsBtn").click();
  expect(await style(page.locator("#settingsPanel"), "background-color")).toBe(PAPER);
});

test("no window overflows a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openGame(page);
  const fits = async label => expect(await page.evaluate(() => document.documentElement.scrollWidth), label).toBeLessThanOrEqual(320);
  await page.locator("#startLeaderboardBtn").click();
  await fits("leaderboard");
  await page.keyboard.press("Escape");
  await page.locator("#startAchievementsBtn").click();
  await fits("achievements");
  await page.keyboard.press("Escape");
  await page.locator("#startSettingsBtn").click();
  await fits("settings");
  await page.keyboard.press("Escape");
  await page.locator("#startPlayBtn").click();
  for (const selector of ["#newGameConfirm", "#lowerScoreConfirm", "#loadError"]) {
    await reveal(page, selector);
    await fits(selector);
    await page.evaluate(sel => { document.querySelector(sel).hidden = true; }, selector);
  }
  await reveal(page, "#overlay", "noMoves");
  await fits("end card");
});

test("in the moon garden the end card's buttons are written in its ink", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await reveal(page, "#overlay", "noMoves");
  await inWorld(page, 5);
  expect(await style(page.locator("#playAgainBtn"), "background-color")).toBe("rgb(115, 86, 25)");
  expect(await style(page.locator("#shareBtn"), "background-color")).toBe("rgb(228, 219, 192)");
});

test("the in-game settings scroll has its rollers at its top and bottom", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await page.locator("#settingsBtn").click();
  const panel = page.locator("#settingsPanel");
  await expect(panel).toBeVisible();
  expect(await style(panel, "top", "::before")).toBe("-6px");
  expect(await style(panel, "bottom", "::after")).toBe("-6px");
});

test("the end card's four scores sit two by two, a dashed line between them", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await reveal(page, "#overlay", "noMoves");
  const scores = page.locator(".overlay-scores > div");
  const boxes = await scores.evaluateAll(list => list.map(el => el.getBoundingClientRect()).map(r => ({ x: Math.round(r.x), y: Math.round(r.y) })));
  expect(boxes[0].y).toBe(boxes[1].y);
  expect(boxes[2].y).toBe(boxes[3].y);
  expect(boxes[2].x).toBe(boxes[0].x);
  // No line at the start of a row.
  expect(await style(scores.nth(2), "border-left-style")).toBe("none");
  expect(await style(scores.nth(0), "border-right-style")).toBe("dashed");
});

/* ---------- Review fixes ---------- */

test("a focused ink button shows its ring inside its chipped corners", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await reveal(page, "#newGameConfirm");
  await page.locator("#cancelNewGame").focus();
  await page.keyboard.press("Tab");
  const button = page.locator("#confirmNewGame");
  await expect(button).toBeFocused();
  expect(await style(button, "outline-style")).toBe("solid");
  // clip-path cuts everything outside the button, so the ring must sit inside it.
  expect(parseFloat(await style(button, "outline-offset"))).toBeLessThanOrEqual(-3);
});

test("on the no-moves card the secondary buttons keep their ink frame", async ({ page }) => {
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await reveal(page, "#overlay", "noMoves");
  await inWorld(page, 1);
  expect(await style(page.locator("#shareBtn"), "box-shadow")).toContain("rgb(32, 91, 156)");
  expect(await style(page.locator("#playAgainBtn"), "clip-path")).toContain("4px 0px");
});

test("in short landscape the no-moves card stays compact", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await openGame(page);
  await page.locator("#startPlayBtn").click();
  await reveal(page, "#overlay", "noMoves");
  const card = page.locator("#overlay .overlay-card");
  expect(await style(card, "padding-top")).toBe("14px");
  expect(await style(card, "row-gap")).toBe("7px");
});

test("in short landscape the leaderboard's content stays on the paper", async ({ page }) => {
  // A ranked player: the standing above the list takes room too.
  await asSeededPlayer(page);
  await page.setViewportSize({ width: 640, height: 360 });
  await openLeaderboard(page);
  await expect(page.locator("#leaderboardMe")).toBeVisible();
  for (const tab of ["#lbTab-all", "#lbTab-daily"]) {
    await page.locator(tab).click();
    await page.waitForTimeout(400);
    // Every part of the window ends above the paper's bottom padding.
    const spill = await page.locator("#leaderboardModal .leaderboard-card").evaluate(card => {
      const bottom = card.getBoundingClientRect().bottom - parseFloat(getComputedStyle(card).paddingBottom);
      return Math.max(...[...card.children].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect().bottom - bottom));
    });
    expect(spill, tab).toBeLessThanOrEqual(1);
  }
});

test("an off switch has a frame that can be seen", async ({ page }) => {
  await openSettings(page);
  const off = page.locator("#contrastToggle");
  expect(await off.getAttribute("aria-checked")).toBe("false");
  // #8a6f48: at least 3:1 on both papers (WCAG non-text contrast).
  expect(await style(off, "box-shadow")).toContain("rgb(138, 111, 72)");
});

/* ---------- Small polish ---------- */

test("the leaderboard's retry button sits in the middle", async ({ page }) => {
  await page.route("**/api/leaderboard*", route => (route.request().method() === "GET" ? route.fulfill({ status: 500, body: "{}" }) : route.continue()));
  await openGame(page);
  await page.locator("#startLeaderboardBtn").click();
  const retry = page.locator(".lb-retry");
  await expect(retry).toBeVisible();
  const [button, list] = [await retry.boundingBox(), await page.locator("#leaderboardList").boundingBox()];
  const left = button.x - list.x;
  const right = list.x + list.width - (button.x + button.width);
  expect(Math.abs(left - right)).toBeLessThan(2);
});

test("no rule hangs under the last row a group shows", async ({ page }) => {
  await openSettings(page);
  // Vibration is hidden here (a desktop browser): Sound effects is the last row.
  await expect(page.locator("#hapticsRow")).toBeHidden();
  const sfxRow = page.locator(".setting-row", { has: page.locator("#sfxToggle") });
  expect(await style(sfxRow, "border-bottom-style")).toBe("none");
  const musicRow = page.locator(".music-volume-row");
  expect(await style(musicRow, "border-top-style")).toBe("none");
  const pianoRow = page.locator(".setting-row", { has: page.locator("#pianoToggle") });
  expect(await style(pianoRow, "border-top-style")).toBe("dashed");
});

for (const language of ["fr", "ru", "de"]) {
  test(`long settings labels wrap instead of being cut (${language})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addInitScript(code => localStorage.setItem("gardenEvolutionLanguage", code), language);
    await openGame(page);
    await page.locator("#startPlayBtn").click();
    await page.locator("#settingsBtn").click();
    // The add-to-home-screen row with its button, as Android shows it.
    await page.evaluate(() => { document.getElementById("installRow").hidden = false; document.getElementById("installBtn").hidden = false; });
    for (const label of await page.locator("#settingsPanel .setting-label:visible").all()) {
      const cut = await label.evaluate(el => el.scrollWidth - el.clientWidth);
      expect(cut, await label.textContent()).toBeLessThanOrEqual(1);
    }
  });
}

test("on a 320px phone the rollers stay on the screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openLeaderboard(page);
  const ends = await page.locator("#leaderboardModal .leaderboard-card").evaluate(card => {
    const rect = card.getBoundingClientRect();
    const roller = getComputedStyle(card, "::before");
    return { left: rect.left + parseFloat(roller.left), right: rect.right - parseFloat(roller.right), modal: card.parentElement.getBoundingClientRect() };
  });
  expect(ends.left).toBeGreaterThanOrEqual(0);
  expect(ends.right).toBeLessThanOrEqual(320);
});

test("with reduced motion the windows open without sliding", async ({ page }) => {
  await openLeaderboard(page);
  expect(await style(page.locator("#leaderboardModal .leaderboard-card"), "animation-name")).toBe("none");
});

import { test, expect, startGame, boardSnapshot } from "./fixtures.js";

// "View garden" and the showcase when a world unlocks. A phone held upright
// sees only a strip of each 16:9 painting; these keep the rest of it reachable.

// Looking around moves the scenes' cameras across the painting; the canvas keeps
// its size. worldShift is where the left edge of the painting sits relative to
// the left of the screen, in screen pixels (0 = at the left edge, more negative
// = the view has moved further right across the painting).
const sceneView = page => page.evaluate(() => {
  // During a crossfade two scenes are awake; the one for the current world is the one on screen.
  const keys = ["WinterMountainScene", "SnowmeltValleyScene", "SpringBloomScene", "SakuraGardenScene", "MoonlitFinaleScene"];
  const stage = Number(document.getElementById("env").dataset.stage) || 1;
  const scene = window.gardenEngine.scene.getScene(keys[stage - 1]);
  const { worldView, zoom } = scene.cameras.main;
  return { left: worldView.x, top: worldView.y, width: worldView.width, height: worldView.height, zoom, focus: scene.panFocus ?? null };
});
const worldShift = async page => { const v = await sceneView(page); return -(v.left * v.zoom); };
// The whole sideways range, in screen pixels: the painting is 1672 wide.
const panRange = async page => { const v = await sceneView(page); return Math.max(0, (1672 - v.width) * v.zoom); };
// Where the camera rests when the garden view is not in use.
const restingShift = async page => { const v = await sceneView(page); return -((1672 - v.width) * 0.5 * v.zoom); };
const unlock = (page, stage) => page.evaluate(next => window.debugSetEnvironmentStage(next), stage);

async function expectBackInGame(page) {
  await expect(page.locator("body")).not.toHaveClass(/world-focus/);
  await expect(page.locator("main.game")).toBeVisible();
  await expect(page.locator("main.game")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => document.getElementById("phaserWorld").style.transform)).toBe("");
}

test.describe("on a phone held upright", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the garden view hides the game and the whole painting can be explored", async ({ page }) => {
    await startGame(page);
    const view = page.locator("#viewBtn");
    await expect(view).toBeVisible();
    await expect(view).toHaveAttribute("aria-label", "View the garden");

    await view.click();
    await expect(page.locator("body")).toHaveClass(/gv-active/);
    await expect(page.locator("#gardenView")).toBeVisible();
    await expect(page.locator("main.game")).toBeHidden();
    await expect(page.locator("main.game")).toHaveJSProperty("inert", true);
    await expect(page.locator("#gvBack")).toBeFocused();
    await expect(page.locator("#gvName")).toHaveText(/\S/);
    await expect(page.locator("#gvKicker")).toHaveText(/World 1 of 5/);

    // The world is drawn at the painting's own width (about 1.79 x the height).
    await expect(page.locator(".gv-track")).toBeVisible();
    await expect(page.locator(".gv-hint")).toBeVisible();

    // Dragging slides the painting with the finger.
    const start = await worldShift(page);
    await page.mouse.move(330, 400);
    await page.mouse.down();
    await page.mouse.move(180, 400, { steps: 6 });
    await page.mouse.move(40, 400, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => worldShift(page)).toBeLessThan(start - 150);

    // It cannot be dragged past either edge: the camera stops at the painting's edge.
    await page.mouse.move(380, 300);
    await page.mouse.down();
    await page.mouse.move(5, 300, { steps: 8 });
    await page.mouse.move(5, 300);
    await page.mouse.up();
    await page.waitForTimeout(900);
    const range = await panRange(page);
    expect(await worldShift(page)).toBeGreaterThanOrEqual(-range - 1);
    await page.mouse.move(5, 300);
    await page.mouse.down();
    await page.mouse.move(385, 300, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    expect(await worldShift(page)).toBeLessThanOrEqual(1);

    // And back to the game, exactly as it was.
    await page.locator("#gvBack").click();
    await expectBackInGame(page);
    await expect(page.locator("#viewBtn")).toBeFocused();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    expect(page.problems).toEqual([]);
  });

  test("the keyboard explores the garden and Escape returns", async ({ page }) => {
    await startGame(page);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#gardenView.show")).toBeVisible();
    await page.keyboard.press("Home");
    await expect.poll(() => worldShift(page)).toBeGreaterThanOrEqual(-1);
    const range = await panRange(page);
    expect(range).toBeGreaterThan(300);
    await page.keyboard.press("End");
    await expect.poll(() => worldShift(page)).toBeLessThanOrEqual(-range + 2);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => worldShift(page)).toBeGreaterThan(-range + 20);

    await page.keyboard.press("Escape");
    await expect(page.locator("#gardenView")).toBeHidden();
    await expectBackInGame(page);
  });

  test("in every world the camera stays on the painting at both ends and at rest", async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto("/?features=-worldReveal");
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    const inside = async label => {
      const v = await sceneView(page);
      expect(v.left, `${label}: left edge`).toBeGreaterThanOrEqual(-0.5);
      expect(v.top, `${label}: top edge`).toBeGreaterThanOrEqual(-0.5);
      expect(v.left + v.width, `${label}: right edge`).toBeLessThanOrEqual(1672.5);
      expect(v.top + v.height, `${label}: bottom edge`).toBeLessThanOrEqual(936.5);
    };
    for (let stage = 1; stage <= 5; stage++) {
      await unlock(page, stage);
      await page.waitForTimeout(1800);
      await inside(`world ${stage} at rest`);
      await page.locator("#viewBtn").click();
      await expect(page.locator("#gardenView.show")).toBeVisible();
      for (const key of ["Home", "End"]) {
        await page.keyboard.press(key);
        await page.waitForTimeout(900);
        await inside(`world ${stage} ${key}`);
      }
      await page.keyboard.press("Escape");
      await expect(page.locator("#gardenView")).toBeHidden();
    }
    expect(page.problems).toEqual([]);
  });

  test("the view is mostly the painting: a small back button stays, the name and track come and go", async ({ page }) => {
    await startGame(page);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#gardenView.show")).toBeVisible();
    const opacity = selector => page.locator(selector).evaluate(el => Number(getComputedStyle(el).opacity));

    // Just opened: the name and the position track are showing...
    await expect.poll(() => opacity(".gv-caption")).toBeGreaterThan(0.9);
    await expect.poll(() => opacity(".gv-track")).toBeGreaterThan(0.9);
    // ...and everything on screen together covers only a sliver of it.
    const back = await page.locator("#gvBack").boundingBox();
    expect(back.height).toBeLessThanOrEqual(48);
    expect(back.width).toBeLessThanOrEqual(230);
    const caption = await page.locator(".gv-caption").boundingBox();
    const covered = back.width * back.height + caption.width * caption.height;
    expect(covered / (390 * 844), "share of the screen the controls cover").toBeLessThan(0.06);

    // After a few quiet seconds only the back button is left.
    await expect.poll(() => opacity(".gv-caption"), { timeout: 6000 }).toBeLessThan(0.05);
    await expect.poll(() => opacity(".gv-track")).toBeLessThan(0.05);
    expect(await opacity("#gvBack")).toBeGreaterThan(0.9);

    // Touching the painting brings them back.
    await page.mouse.move(200, 400);
    await page.mouse.down();
    await page.mouse.move(150, 400, { steps: 3 });
    await expect.poll(() => opacity(".gv-caption")).toBeGreaterThan(0.9);
    await page.mouse.up();
    await expect.poll(() => opacity(".gv-caption"), { timeout: 6000 }).toBeLessThan(0.05);

    // So does the keyboard.
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => opacity(".gv-caption")).toBeGreaterThan(0.9);
  });

  test("the board cannot be played while the garden is shown", async ({ page }) => {
    await startGame(page);
    const before = await boardSnapshot(page);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#gardenView.show")).toBeVisible();
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
    await page.keyboard.press("Escape");
    await expectBackInGame(page);
    expect(await boardSnapshot(page)).toBe(before);
    // Play works again.
    let moved = false;
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      if ((await boardSnapshot(page)) !== before) { moved = true; break; }
    }
    expect(moved).toBe(true);
  });

  test("the world returns to its normal framing, with no gap, after the garden view", async ({ page }) => {
    await startGame(page);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#gardenView.show")).toBeVisible();
    await page.keyboard.press("End");
    await page.waitForTimeout(700);
    await page.locator("#gvBack").click();
    await expectBackInGame(page);
    // Phaser's drawing surface is the viewport again (it is resized a moment later).
    await expect.poll(() => page.evaluate(() => {
      const canvas = document.querySelector("#phaserWorld canvas");
      return canvas ? [canvas.width, canvas.height] : null;
    })).toEqual([390, 844]);
    expect(Math.abs(await worldShift(page) - await restingShift(page))).toBeLessThan(3);
  });

  test("the garden view is announced and described for screen readers", async ({ page }) => {
    await startGame(page);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#a11yAnnouncer")).toContainText("Garden view");
    await expect(page.locator(".gv-bar")).toHaveAttribute("role", "region");
    await expect(page.locator("#gvBack")).toHaveText("Back to game");
  });
});

test.describe("on a screen as wide as the painting", () => {
  for (const [name, viewport] of [["a desktop", { width: 1280, height: 720 }], ["a phone held sideways", { width: 844, height: 390 }]]) {
    test(`${name}: nothing to slide, the game just steps aside`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await startGame(page);
      await page.locator("#viewBtn").click();
      await expect(page.locator("#gardenView.show")).toBeVisible();
      await expect(page.locator("main.game")).toBeHidden();
      await expect(page.locator(".gv-track")).toBeHidden();
      await expect(page.locator(".gv-hint")).toBeHidden();
      const back = await page.locator("#gvBack").boundingBox();
      expect(back.y + back.height).toBeLessThanOrEqual(viewport.height);
      expect(back.x).toBeGreaterThanOrEqual(0);
      expect(back.x + back.width).toBeLessThanOrEqual(viewport.width);
      await page.keyboard.press("Escape");
      await expectBackInGame(page);
    });
  }
});

test.describe("switching it off", () => {
  test("?features=-gardenView removes the button and keeps the controls tidy", async ({ page }) => {
    await page.goto("/?features=-gardenView");
    await expect(page.locator("#grid .cell")).toHaveCount(16);
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    await expect(page.locator("#viewBtn")).toBeHidden();
    await expect(page.locator("body")).toHaveClass(/no-garden-view/);
    // Three controls in a row, none squeezed into a 42 px column.
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll(".controls > .btn")].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().width)));
    expect(widths).toHaveLength(3);
    expect(widths[1], "the Leaderboard button").toBeGreaterThan(90);
    expect(page.problems).toEqual([]);
  });
});

// The showcase is off by default (a new world should not interrupt play); these
// tests are about it, so they turn it on the way a player would, in Settings.
const showcaseOn = page => page.addInitScript(() => {
  if (sessionStorage.getItem("showcase-seeded") === null) {
    localStorage.setItem("gardenEvolutionReveal", "true");
    sessionStorage.setItem("showcase-seeded", "1");
  }
});

test.describe("the showcase when a world unlocks", () => {
  test.beforeEach(async ({ page }) => { await showcaseOn(page); });

  test("a new world is shown off, then the game carries on", async ({ page }) => {
    await startGame(page);
    await unlock(page, 2);
    const reveal = page.locator("#worldReveal.show");
    await expect(reveal).toBeVisible({ timeout: 8000 });
    await expect(page.locator("#wrKicker")).toHaveText("World 2 of 5");
    await expect(page.locator("#wrName")).toHaveText("Snowmelt Valley");
    await expect(page.locator("#wrLine")).toHaveText("The snow begins to sing.");
    await expect(page.locator("main.game")).toBeHidden();
    await expect(page.locator("main.game")).toHaveJSProperty("inert", true);

    // It ends by itself.
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 12_000 });
    await expectBackInGame(page);
    expect(page.problems).toEqual([]);
  });

  test("a tap or a key skips it, but not the very moment it appears", async ({ page }) => {
    await startGame(page);
    await unlock(page, 2);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(800);
    await page.locator("#worldReveal").click();
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 3000 });
    await expectBackInGame(page);

    await unlock(page, 3);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape");
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 3000 });
    await expectBackInGame(page);
  });

  test("the game cannot be played while a world is being shown", async ({ page }) => {
    await startGame(page);
    await unlock(page, 2);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    const before = await boardSnapshot(page);
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
    }
    expect(await boardSnapshot(page)).toBe(before);
  });

  test("on a phone it also sweeps across the painting and lands back where it started", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page);
    await unlock(page, 2);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    const shifts = [];
    for (let i = 0; i < 9; i++) {
      shifts.push(await worldShift(page));
      await page.waitForTimeout(500);
    }
    expect(Math.max(...shifts) - Math.min(...shifts), "it moved").toBeGreaterThan(300);
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 12_000 });
    await expectBackInGame(page);
  });

  test("?features=-worldReveal removes the feature and its setting", async ({ page }) => {
    await page.goto("/?features=-worldReveal");
    await expect(page.locator("#grid .cell")).toHaveCount(16);
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    await unlock(page, 2);
    await page.waitForTimeout(2500);
    await expect(page.locator("#worldReveal")).toBeHidden();
    await page.locator("#settingsBtn").click();
    await expect(page.locator("#revealRow")).toBeHidden();
  });

  test("it waits for an open dialog instead of covering it", async ({ page }) => {
    await startGame(page);
    await page.locator("#settingsBtn").click();
    await expect(page.locator("#settingsPanel")).toBeVisible();
    await unlock(page, 2);
    await page.waitForTimeout(2500);
    await expect(page.locator("#worldReveal")).toBeHidden();
    await expect(page.locator("#settingsPanel")).toBeVisible();
  });
});

test.describe("the showcase setting", () => {
  test("it is off until the player turns it on in the settings, and the choice is remembered", async ({ page }) => {
    // A player who never touched the setting: the world changes quietly.
    await startGame(page);
    await unlock(page, 2);
    await page.waitForTimeout(2500);
    await expect(page.locator("#worldReveal")).toBeHidden();
    await expect(page.locator("main.game")).toBeVisible();

    await page.locator("#settingsBtn").click();
    const toggle = page.locator("#revealToggle");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await unlock(page, 3);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape");
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 3000 });

    await page.reload();
    await expect(page.locator("#grid .cell")).toHaveCount(16);
    await page.locator("#startSettingsBtn").click();
    await expect(page.locator("#revealToggle")).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => { await showcaseOn(page); });

  test("the showcase is calm: no sweeping, the world keeps its size", async ({ page }) => {
    await startGame(page);
    await unlock(page, 2);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    expect(Math.abs(await worldShift(page) - await restingShift(page))).toBeLessThan(3);
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 8000 });
    await expectBackInGame(page);
  });
});

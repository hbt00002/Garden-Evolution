import { test, expect, openGame, startGame, boardSnapshot } from "./fixtures.js";

// "View garden" and the showcase when a world unlocks. A phone held upright
// sees only a strip of each 16:9 painting; these keep the rest of it reachable.

const worldShift = page =>
  page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById("phaserWorld")).transform).m41);
const worldWidth = page => page.evaluate(() => document.getElementById("phaserWorld").getBoundingClientRect().width);
const unlock = (page, stage) => page.evaluate(next => window.debugSetEnvironmentStage(next), stage);

async function expectBackInGame(page) {
  await expect(page.locator("body")).not.toHaveClass(/world-focus/);
  await expect(page.locator("main.game")).toBeVisible();
  await expect(page.locator("main.game")).toHaveJSProperty("inert", false);
  await expect(page.locator("#env")).not.toHaveClass(/\bwide\b/);
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
    await expect.poll(() => worldWidth(page)).toBeGreaterThan(1400);
    await expect(page.locator("#env")).toHaveClass(/\bwide\b/);
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

    // It cannot be dragged past either edge.
    const width = await worldWidth(page);
    await page.mouse.move(380, 300);
    await page.mouse.down();
    await page.mouse.move(5, 300, { steps: 8 });
    await page.mouse.move(5, 300);
    await page.mouse.up();
    await page.waitForTimeout(900);
    const farLeft = await worldShift(page);
    expect(farLeft).toBeGreaterThanOrEqual(-(width - 390) - 1);
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
    const width = await worldWidth(page);
    await page.keyboard.press("End");
    await expect.poll(() => worldShift(page)).toBeLessThanOrEqual(-(width - 390) + 2);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => worldShift(page)).toBeGreaterThan(-(width - 390) + 20);

    await page.keyboard.press("Escape");
    await expect(page.locator("#gardenView")).toBeHidden();
    await expectBackInGame(page);
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

  test("the world returns to its normal size, with no gap, after the garden view", async ({ page }) => {
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
    expect(await worldWidth(page)).toBe(390);
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
      await expect(page.locator("#env")).not.toHaveClass(/\bwide\b/);
      await expect(page.locator(".gv-track")).toBeHidden();
      await expect(page.locator(".gv-hint")).toBeHidden();
      const bar = await page.locator(".gv-bar").boundingBox();
      expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height);
      expect(bar.x).toBeGreaterThanOrEqual(0);
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

test.describe("the showcase when a world unlocks", () => {
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
    await expect(page.locator("#env")).toHaveClass(/\bwide\b/);
    const shifts = [];
    for (let i = 0; i < 9; i++) {
      shifts.push(await worldShift(page));
      await page.waitForTimeout(500);
    }
    expect(Math.max(...shifts) - Math.min(...shifts), "it moved").toBeGreaterThan(300);
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 12_000 });
    await expectBackInGame(page);
  });

  test("it can be switched off in the settings and the choice is remembered", async ({ page }) => {
    await startGame(page);
    await page.locator("#settingsBtn").click();
    const toggle = page.locator("#revealToggle");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Escape");

    await unlock(page, 2);
    await page.waitForTimeout(2500);
    await expect(page.locator("#worldReveal")).toBeHidden();
    await expect(page.locator("main.game")).toBeVisible();

    await page.reload();
    await expect(page.locator("#grid .cell")).toHaveCount(16);
    await page.locator("#startSettingsBtn").click();
    await expect(page.locator("#revealToggle")).toHaveAttribute("aria-checked", "false");
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

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });

  test("the showcase is calm: no sweeping, the world keeps its size", async ({ page }) => {
    await startGame(page);
    await unlock(page, 2);
    await expect(page.locator("#worldReveal.show")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("#env")).not.toHaveClass(/\bwide\b/);
    expect(await worldShift(page)).toBe(0);
    await expect(page.locator("#worldReveal")).toBeHidden({ timeout: 8000 });
    await expectBackInGame(page);
  });
});

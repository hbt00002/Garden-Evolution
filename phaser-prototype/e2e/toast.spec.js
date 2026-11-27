import { test, expect, startGame, playToTheEnd } from "./fixtures.js";

// The toast is a little medal in the combo badge's place: under the board on a
// phone, beside it sideways, and at the top of the screen while the end card
// covers the board.
const showToast = page => page.evaluate(() => {
  const t = document.getElementById("toast");
  t.querySelector(".toast-name").textContent = "First Harvest";
  t.querySelector(".toast-label").textContent = "Achievement unlocked";
  t.hidden = false; t.classList.add("show");
});
const box = (page, selector) => page.locator(selector).boundingBox();

test("390x844: the toast sits just under the board", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  await showToast(page);
  await page.waitForTimeout(400);
  const board = await box(page, "#board");
  const toast = await box(page, "#toast");
  expect(toast.y).toBeGreaterThanOrEqual(board.y + board.height);
  expect(toast.y - (board.y + board.height)).toBeLessThanOrEqual(30);
  expect(Math.abs(toast.x + toast.width / 2 - (board.x + board.width / 2))).toBeLessThanOrEqual(2);
});

test("844x390: the toast sits beside the board, on its left", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await startGame(page);
  await showToast(page);
  await page.waitForTimeout(400);
  const board = await box(page, "#board");
  const toast = await box(page, "#toast");
  expect(toast.x + toast.width).toBeLessThanOrEqual(board.x);
  expect(toast.y).toBeGreaterThanOrEqual(0);
  expect(toast.y + toast.height).toBeLessThanOrEqual(390);
});

test("with the end card open, the toast is at the top of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  await page.evaluate(() => {
    const card = document.getElementById("overlay");
    card.hidden = false; card.dataset.mode = "noMoves"; card.classList.add("show", "ready");
  });
  await showToast(page);
  await page.waitForTimeout(400);
  const toast = await box(page, "#toast");
  expect(toast.y).toBeLessThanOrEqual(20);
  await expect(page.locator("#toast")).toBeInViewport({ ratio: 1 });
});

test("the first finished game's achievement shows its plant in the medal", async ({ page }) => {
  test.setTimeout(240_000);
  await startGame(page);
  await playToTheEnd(page);
  const icon = page.locator("#toast .toast-icon img");
  await expect(icon).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator("#toast .toast-label")).not.toBeEmpty();
  await expect(page.locator("#toast .toast-name")).not.toBeEmpty();
});

test("844x390: a long achievement name wraps between words, never inside one", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await startGame(page);
  await showToast(page);
  await page.waitForTimeout(400);
  const name = page.locator("#toast .toast-name");
  const lines = await name.evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(lines).toBeLessThanOrEqual(2);
});

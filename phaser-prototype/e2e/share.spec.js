import { test, expect, startGame, playToTheEnd } from "./fixtures.js";
import { writeFileSync } from "node:fs";

// Sharing a finished run from the end card: a picture card with the world, the
// score and the top plant, a line of text and the game's address, through the
// phone's share sheet; on a desktop the text is copied instead.

// A stand-in for the phone's share sheet that remembers what it was given.
// `files` says whether it accepts pictures; `cancel` makes the player close it.
const shareSheet = (page, { files = true, share = true, cancel = false } = {}) => page.addInitScript(({ files, share, cancel }) => {
  window.__shared = [];
  if (share) {
    navigator.share = async data => {
      if (cancel) throw new DOMException("closed", "AbortError");
      const entry = { text: data.text, url: data.url, files: [] };
      for (const file of data.files || []) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        bytes.forEach(byte => { binary += String.fromCharCode(byte); });
        const bitmap = await createImageBitmap(file);
        entry.files.push({ name: file.name, type: file.type, width: bitmap.width, height: bitmap.height, base64: btoa(binary) });
      }
      window.__shared.push(entry);
    };
    navigator.canShare = data => Boolean(files || !data?.files?.length);
  } else {
    delete Navigator.prototype.share;
    delete Navigator.prototype.canShare;
  }
}, { files, share, cancel });

const finishRun = async page => {
  await startGame(page);
  await playToTheEnd(page);
  await expect(page.locator("#overlay.ready")).toBeVisible();
};

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("the end card shares a picture of the run with a line of text and the address", async ({ page }) => {
    await shareSheet(page);
    await finishRun(page);
    const score = (await page.locator("#finalScore").innerText()).trim();
    await expect(page.locator("#shareBtn")).toBeVisible();
    await expect(page.locator("#shareBtn")).toHaveText(/Share/);
    await page.locator("#shareBtn").click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    const [shared] = await page.evaluate(() => window.__shared);
    expect(shared.files).toHaveLength(1);
    const [card] = shared.files;
    expect(card.type).toBe("image/png");
    expect(card.name).toBe("garden-evolution.png");
    expect([card.width, card.height]).toEqual([1080, 1350]);
    expect(shared.text).toContain(score);
    expect(shared.text).toContain("Garden Evolution");
    expect(shared.text).toContain("https://play.gardenevolution.workers.dev");
    writeFileSync("test-results/share-card-no-moves.png", Buffer.from(card.base64, "base64"));
    expect(page.problems).toEqual([]);
  });

  test("the card is drawn in the player's language", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("gardenEvolutionLanguage", "tr"));
    await shareSheet(page);
    await finishRun(page);
    await expect(page.locator("#shareBtn")).toHaveText(/Paylaş/);
    await page.locator("#shareBtn").click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    const [shared] = await page.evaluate(() => window.__shared);
    expect(shared.text).toContain("bahçemi");
    writeFileSync("test-results/share-card-tr.png", Buffer.from(shared.files[0].base64, "base64"));
  });

  test("where pictures cannot be shared, the words and the link still are", async ({ page }) => {
    await shareSheet(page, { files: false });
    await finishRun(page);
    await page.locator("#shareBtn").click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    const [shared] = await page.evaluate(() => window.__shared);
    expect(shared.files).toHaveLength(0);
    expect(shared.url).toBe("https://play.gardenevolution.workers.dev");
    expect(shared.text).toContain("Garden Evolution");
  });

  test("closing the share sheet is not an error and shows nothing", async ({ page }) => {
    await shareSheet(page, { cancel: true });
    await finishRun(page);
    await page.locator("#shareBtn").click();
    await page.waitForTimeout(800);
    await expect(page.locator("#toast")).toBeHidden();
    expect(page.problems).toEqual([]);
  });
});

test("on a desktop without a share sheet the text is copied and the player is told", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await shareSheet(page, { share: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await finishRun(page);
  await page.locator("#shareBtn").click();
  await expect(page.locator("#toast")).toBeVisible();
  await expect(page.locator("#toast")).toHaveText(/Copied/);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Garden Evolution");
  expect(copied).toContain("https://play.gardenevolution.workers.dev");
});

test("the 2048 milestone and the 8192 victory share their own words", async ({ page }) => {
  await shareSheet(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const ending of ["milestone", "victory"]) {
    await page.goto(`/?ending=${ending}`);
    await expect(page.locator("#overlay.ready")).toBeVisible({ timeout: 10_000 });
    await page.locator("#shareBtn").click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    const [shared] = await page.evaluate(() => window.__shared);
    if (ending === "milestone") expect(shared.text).toContain("bloomed into");
    else expect(shared.text).toContain("completed every world");
    writeFileSync(`test-results/share-card-${ending}.png`, Buffer.from(shared.files[0].base64, "base64"));
  }
});

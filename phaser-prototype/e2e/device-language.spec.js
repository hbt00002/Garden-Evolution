import { test, expect } from "./fixtures.js";
import { PLAY_LABELS } from "../src/i18n.js";

// A phone set to Turkish opens the game in Turkish; a choice the player made in
// the settings always wins, and is remembered.
test.describe("on a phone set to Turkish", () => {
  test.use({ locale: "tr-TR" });

  test("a new player sees the game in Turkish", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.locator("#startPlayBtn")).toContainText(PLAY_LABELS.tr);
  });

  test("a language the player chose wins over the phone's", async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("gardenEvolutionLanguage", "en"); sessionStorage.setItem("seeded", "1"); } });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("the phone's language is not written down as if the player had chosen it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    expect(await page.evaluate(() => localStorage.getItem("gardenEvolutionLanguage"))).toBeNull();
  });
});

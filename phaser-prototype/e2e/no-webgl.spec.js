import { test, expect, startGame } from "./fixtures.js";

// A browser (or a locked-down machine) without WebGL. Phaser cannot start, so
// the game has to carry on with its built-in SVG backdrop. This lives in its
// own file because the browser flags apply to a whole file.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

test("the game still plays on the built-in backdrop", async ({ page }) => {
  await startGame(page);
  await expect(page.locator("#env")).not.toHaveAttribute("data-phaser-active", /.*/);
  await expect.poll(() => page.locator(".env-sky").evaluate(node => node.childElementCount)).toBeGreaterThan(0);
  await expect(page.locator("#loadError")).toBeHidden();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
});

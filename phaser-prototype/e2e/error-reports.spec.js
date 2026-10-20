import { test, expect, openGame } from "./fixtures.js";

// The game tells the server when it breaks in someone's browser. These check
// the whole path against the real Worker: what is sent, that the server takes
// it, and that nothing about it can get in the way of playing.

const HTML_STANDIN = { status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>blocked</title>" };

const nextReport = page => page.waitForRequest(request => request.url().endsWith("/api/client-error") && request.method() === "POST");

test("an error in the page is reported once, with technical facts only", async ({ page }) => {
  await openGame(page);
  const request = nextReport(page);
  const response = page.waitForResponse(res => res.url().endsWith("/api/client-error"));
  await page.evaluate(() => setTimeout(() => { throw new Error("e2e: something broke"); }));
  const body = JSON.parse((await request).postData());
  expect(body).toMatchObject({ kind: "error", page: "/" });
  expect(body.message).toContain("e2e: something broke");
  expect(body.message).not.toMatch(/^Uncaught/);
  expect(body.build).toMatch(/^[\w-]+$/);
  expect(body.screen).toMatch(/^\d+x\d+@/);
  // No name, score, identifier or address is part of it.
  expect(Object.keys(body).sort()).toEqual(["build", "column", "kind", "line", "message", "page", "screen", "source", "stack"].filter(key => key in body).sort());
  expect((await response).status()).toBe(204);
  page.problems.length = 0;   // the error was thrown on purpose
});

test("the same error is not sent again and the game keeps working", async ({ page }) => {
  await openGame(page);
  let sent = 0;
  page.on("request", request => { if (request.url().endsWith("/api/client-error")) sent++; });
  for (let i = 0; i < 4; i++) await page.evaluate(() => setTimeout(() => { throw new Error("e2e: repeated"); }));
  await page.waitForTimeout(800);
  expect(sent).toBe(1);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  page.problems.length = 0;
});

test("a blocked game file is reported, and the visitor still sees the explanation", async ({ page }) => {
  await page.route(/\/assets\/game-[^/]+\.js$/, route => route.fulfill(HTML_STANDIN));
  const request = nextReport(page);
  await page.goto("/");
  await expect(page.locator("#loadError")).toBeVisible();
  const kinds = [JSON.parse((await request).postData()).kind];
  expect(["load", "resource", "error"]).toContain(kinds[0]);
});

test("if reporting itself fails, nothing is shown and the game plays", async ({ page }) => {
  await page.route("**/api/client-error", route => route.abort());
  await openGame(page);
  await page.evaluate(() => setTimeout(() => { throw new Error("e2e: unreachable server") }));
  await page.waitForTimeout(500);
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await expect(page.locator("#loadError")).toBeHidden();
  page.problems = page.problems.filter(problem => !/unreachable server|client-error|ERR_FAILED/.test(problem));
  expect(page.problems).toEqual([]);
});

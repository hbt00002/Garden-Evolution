import { test, expect, startGame } from "./fixtures.js";

// Visual integrity. The bugs that reached players this month looked fine on
// paper (every size and position was right) and wrong on screen: a board frame
// drawn in one corner, a strip of nothing at the edge of a world. Picture
// comparison against stored screenshots would break on every machine whose
// fonts or graphics differ, so these tests look at what was really drawn, as
// facts that must hold on any machine: the backdrop covers the whole screen,
// the board's frame covers the whole board, every tile sits on a cell, nothing
// is cut off or piled on something else.
//
// For each phone size and each of the five worlds.

const PHONES = [
  { name: "phone upright", width: 390, height: 844 },
  { name: "small phone upright", width: 360, height: 640 },
  { name: "phone sideways", width: 844, height: 390 },
  { name: "short phone sideways (browser bars showing)", width: 667, height: 223 },
  { name: "tablet upright", width: 768, height: 1024 }
];

// What Phaser really drew on a canvas: the share of pixels that are opaque,
// overall and along the outermost rows and columns, and in a region.
const measureCanvas = (page, which) => page.evaluate(game => new Promise(resolve => {
  const engine = game === "world" ? window.gardenEngine : window.gardenBoardEngine;
  const width = Math.floor(engine.scale.width);
  const height = Math.floor(engine.scale.height);
  const finish = image => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    const opaque = (x, y) => data[(y * width + x) * 4 + 3] > 200;
    const share = (x0, y0, x1, y1) => {
      let count = 0, total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { total++; if (opaque(x, y)) count++; }
      return total ? count / total : 1;
    };
    const edge = Math.max(2, Math.round(Math.min(width, height) * 0.01));
    resolve({
      width, height,
      all: share(0, 0, width, height),
      top: share(0, 0, width, edge), bottom: share(0, height - edge, width, height),
      left: share(0, 0, edge, height), right: share(width - edge, 0, width, height),
      // the four quarters of the inner area, away from rounded corners
      quarters: [
        share(Math.round(width * .08), Math.round(height * .08), Math.round(width * .48), Math.round(height * .48)),
        share(Math.round(width * .52), Math.round(height * .08), Math.round(width * .92), Math.round(height * .48)),
        share(Math.round(width * .08), Math.round(height * .52), Math.round(width * .48), Math.round(height * .92)),
        share(Math.round(width * .52), Math.round(height * .52), Math.round(width * .92), Math.round(height * .92))
      ]
    });
  };
  engine.renderer.snapshotArea(0, 0, width, height, image => {
    if (image.complete) finish(image);
    else image.onload = () => finish(image);
  });
}), which);

const rect = (page, selector) => page.locator(selector).first().evaluate(el => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

const overlap = (a, b) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

// Every tile sits exactly on a cell (position and size, within a pixel).
const tileMisalignment = page => page.evaluate(() => {
  const cells = [...document.querySelectorAll("#grid .cell")].map(c => c.getBoundingClientRect());
  const worst = [...document.querySelectorAll("#tiles .tile")].map(tile => {
    const t = tile.getBoundingClientRect();
    return Math.min(...cells.map(c => Math.hypot(c.x - t.x, c.y - t.y) + Math.abs(c.width - t.width)));
  });
  return worst.length ? Math.max(...worst) : 0;
});

// Text that does not fit its box is cut off or spills out.
const clippedText = page => page.evaluate(() => {
  const selectors = [".controls .btn", ".stage-name", ".score-value", ".brand .title", ".stage-kicker"];
  return selectors.flatMap(selector => [...document.querySelectorAll(selector)]
    // (an icon-only button has no text to cut off)
    .filter(el => el.offsetParent && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1)
    .map(el => `${selector} "${el.textContent.trim().slice(0, 24)}" ${el.scrollWidth}>${el.clientWidth}`));
});

for (const phone of PHONES) {
  test(`${phone.name} ${phone.width}x${phone.height}: all five worlds are drawn whole`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.goto("/?features=-worldReveal");
    await page.locator("#startPlayBtn").click();
    await expect(page.locator("#tiles .tile")).toHaveCount(2);
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(160);
    }
    const problems = [];

    for (let stage = 1; stage <= 5; stage++) {
      await page.evaluate(n => window.debugSetEnvironmentStage(n), stage);
      await page.waitForTimeout(1600);
      const label = `world ${stage}`;

      // The backdrop covers the whole screen. (The last world is a picture
      // behind a transparent canvas, so only its canvas is skipped.)
      if (stage < 5) {
        const world = await measureCanvas(page, "world");
        if (world.all < 0.995) problems.push(`${label}: the backdrop is only ${(world.all * 100).toFixed(1)}% painted`);
        for (const side of ["top", "bottom", "left", "right"]) {
          if (world[side] < 0.99) problems.push(`${label}: nothing is drawn along the ${side} edge (${(world[side] * 100).toFixed(0)}%)`);
        }
      }

      // The board's frame covers the whole board, not a corner of it.
      const frame = await measureCanvas(page, "board");
      frame.quarters.forEach((share, index) => {
        if (share < 0.9) problems.push(`${label}: the board's frame is missing in quarter ${index + 1} (${(share * 100).toFixed(0)}% drawn)`);
      });
      // (The frame fills the box Phaser draws in, which is the board without its
      // border: the last world gives the board a 1px border.)
      const box = await rect(page, "#boardEngine");
      if (Math.abs(frame.width - Math.floor(box.width)) > 1) problems.push(`${label}: frame is ${frame.width}px but its box is ${Math.round(box.width)}px`);

      // Tiles sit on cells; nothing is cut off, outside the screen or on top of something else.
      const off = await tileMisalignment(page);
      if (off > 1.5) problems.push(`${label}: a tile is ${off.toFixed(1)}px off its cell`);
      const clipped = await clippedText(page);
      if (clipped.length) problems.push(`${label}: text does not fit: ${clipped.join("; ")}`);
      const parts = {};
      for (const selector of [".brand", ".scores", ".controls", ".evolution", "#board"]) parts[selector] = await rect(page, selector);
      for (const [selector, r] of Object.entries(parts)) {
        if (r.x < -0.5 || r.y < -0.5 || r.x + r.width > phone.width + 0.5 || r.y + r.height > phone.height + 0.5) {
          problems.push(`${label}: ${selector} sticks out of the screen`);
        }
      }
      const names = Object.keys(parts);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        if (overlap(parts[names[i]], parts[names[j]])) problems.push(`${label}: ${names[i]} overlaps ${names[j]}`);
      }
    }
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    if (size[0] > phone.width || size[1] > phone.height) problems.push(`the page scrolls (${size.join("x")})`);
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("turning the phone back and forth keeps everything whole", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  const problems = [];
  const turns = [[844, 390], [390, 844], [667, 223], [844, 283], [390, 844], [844, 390]];
  for (const [width, height] of turns) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(900);
    const frame = await measureCanvas(page, "board");
    frame.quarters.forEach((share, index) => { if (share < 0.9) problems.push(`${width}x${height}: frame missing in quarter ${index + 1}`); });
    const box = await rect(page, "#boardEngine");
    if (Math.abs(frame.width - Math.floor(box.width)) > 1) problems.push(`${width}x${height}: frame ${frame.width}px, its box ${Math.round(box.width)}px`);
    const off = await tileMisalignment(page);
    if (off > 1.5) problems.push(`${width}x${height}: a tile is ${off.toFixed(1)}px off its cell`);
    const world = await measureCanvas(page, "world");
    if (world.all < 0.995) problems.push(`${width}x${height}: the backdrop is ${(world.all * 100).toFixed(1)}% painted`);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("looking around the garden never shows an uncovered edge, in any world", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?features=-worldReveal");
  await page.locator("#startPlayBtn").click();
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  const problems = [];
  for (let stage = 1; stage <= 4; stage++) {
    await page.evaluate(n => window.debugSetEnvironmentStage(n), stage);
    await page.waitForTimeout(1500);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#gardenView.show")).toBeVisible();
    for (const key of ["Home", "End"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(1100);
      const world = await measureCanvas(page, "world");
      if (world.all < 0.995) problems.push(`world ${stage} at ${key}: ${(world.all * 100).toFixed(1)}% painted`);
      for (const side of ["top", "bottom", "left", "right"]) {
        if (world[side] < 0.99) problems.push(`world ${stage} at ${key}: the ${side} edge is uncovered`);
      }
    }
    await page.keyboard.press("Escape");
    await expect(page.locator("#gardenView")).toBeHidden();
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

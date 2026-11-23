import test from "node:test";
import assert from "node:assert/strict";
import { PIXEL_ICONS, pixelIcon } from "../src/pixel-icons.js";

test("every pixel icon draws as a crisp SVG in the current colour", () => {
  assert.ok(PIXEL_ICONS.length > 10);
  for (const name of PIXEL_ICONS) {
    const svg = pixelIcon(name);
    assert.match(svg, /^<svg class="pixel-icon"/, name);
    assert.match(svg, new RegExp(`data-icon="${name}"`), name);
    assert.match(svg, /fill="currentColor"/, name);
    assert.match(svg, /shape-rendering="crispEdges"/, name);
    assert.match(svg, /aria-hidden="true"/, name);
    assert.ok((svg.match(/<rect /g) || []).length > 3, `${name} has pixels`);
  }
});

test("an unknown icon draws nothing", () => {
  assert.equal(pixelIcon("nope"), "");
});

// The two buttons in the game carry the icons in the page itself, so they show
// before any script runs; they must stay the icons this module draws.
test("the gear and picture buttons in the page match the pixel icons", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes(pixelIcon("gear", "gear-ico")), "gear");
  assert.ok(html.includes(pixelIcon("picture", "view-ico")), "picture");
});

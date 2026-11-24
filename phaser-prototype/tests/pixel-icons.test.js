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
  // The flower between the lines above the leaderboard and achievements titles.
  assert.equal(html.split(pixelIcon("flower", "ornament-ico")).length - 1, 2, "ornaments");
  assert.ok(!html.includes("✦"), "no sparkle glyphs");
});

// Settings: every row starts with its own pixel icon, every group heading too.
const SETTING_ICONS = {
  musicVolume: "note", pianoToggle: "piano", sfxToggle: "speaker", hapticsToggle: "vibrate",
  motionToggle: "mountain", particlesToggle: "leaf", contrastToggle: "contrast", revealToggle: "picture",
  languageSelect: "globe", installRow: "home", settingsAchievementsBtn: "medal", privacyLink: "lock"
};

test("the settings icons are pixel icons", () => {
  for (const name of new Set(Object.values(SETTING_ICONS))) assert.ok(PIXEL_ICONS.includes(name), name);
});

test("each settings row and group carries its icon in the page", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const panel = html.slice(html.indexOf('id="settingsPanel"'), html.indexOf("</section>", html.indexOf('id="performanceNote"')));
  for (const [id, name] of Object.entries(SETTING_ICONS)) {
    const at = panel.indexOf(`id="${id}"`);
    assert.ok(at > 0, `${id} in the panel`);
    // The row (the element the id is on, or the label around it) starts with its icon.
    const rowStart = panel.lastIndexOf('class="setting-row', at + 1);
    assert.ok(panel.startsWith(pixelIcon(name, "setting-ico"), panel.indexOf(">", rowStart) + 1), `${id}: ${name}`);
  }
  for (const [key, name] of [["settingsSound", "speaker"], ["settingsView", "mountain"], ["settingsGeneral", "globe"]]) {
    assert.ok(panel.includes(`${pixelIcon(name, "settings-group-ico")}<span data-i18n="${key}">`), key);
  }
});

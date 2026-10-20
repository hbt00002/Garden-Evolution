import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createInstallHint, installContext } from "../src/install.js";
import { TRANSLATIONS } from "../src/i18n.js";

const project = path => fileURLToPath(new URL(`../${path}`, import.meta.url));

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const PIXEL = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP_MAC = IPAD_AS_MAC;

test("where the page is running decides what the Settings row can offer", () => {
  assert.equal(installContext({ userAgent: IPHONE }), "ios");
  assert.equal(installContext({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 }), "ios", "an iPad that asks for the desktop site");
  assert.equal(installContext({ userAgent: DESKTOP_MAC, maxTouchPoints: 0 }), "other", "a real Mac");
  assert.equal(installContext({ userAgent: PIXEL }), "other");
  assert.equal(installContext({ userAgent: IPHONE, standalone: true }), "installed", "already on the home screen (iOS)");
  assert.equal(installContext({ userAgent: PIXEL, displayStandalone: true }), "installed", "already installed (Android)");
});

class FakeElement {
  constructor() { this.hidden = true; this.listeners = {}; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { return Promise.all((this.listeners.click || []).map(fn => fn())); }
}

function setup({ userAgent = PIXEL, maxTouchPoints = 0, standalone = false, displayStandalone = false } = {}) {
  const win = new FakeElement();
  win.matchMedia = query => ({ matches: query === "(display-mode: standalone)" && displayStandalone });
  win.dispatch = (type, event = {}) => (win.listeners[type] || []).forEach(fn => fn(event));
  const els = { row: new FakeElement(), button: new FakeElement(), steps: new FakeElement() };
  const hint = createInstallHint({ ...els, win, nav: { userAgent, maxTouchPoints, standalone } });
  return { win, ...els, hint };
}

const installEvent = () => {
  const event = { prevented: false, prompts: 0, preventDefault() { this.prevented = true; }, async prompt() { this.prompts++; } };
  return event;
};

test("a desktop or Android browser with nothing to offer shows no row", () => {
  const t = setup();
  assert.equal(t.row.hidden, true);
});

test("on iPhone the row shows the steps, not a button", () => {
  const t = setup({ userAgent: IPHONE });
  assert.equal(t.row.hidden, false);
  assert.equal(t.steps.hidden, false);
  assert.equal(t.button.hidden, true);
});

test("once the game is on the home screen there is no row, on either system", () => {
  assert.equal(setup({ userAgent: IPHONE, standalone: true }).row.hidden, true);
  const android = setup({ userAgent: PIXEL, displayStandalone: true });
  android.win.dispatch("beforeinstallprompt", installEvent());
  assert.equal(android.row.hidden, true);
});

test("when the browser offers to install, the row gets a button that opens its prompt once", async () => {
  const t = setup();
  const offer = installEvent();
  t.win.dispatch("beforeinstallprompt", offer);
  assert.equal(offer.prevented, true, "the browser's own banner is held back for the button");
  assert.equal(t.row.hidden, false);
  assert.equal(t.button.hidden, false);
  assert.equal(t.steps.hidden, true);
  await t.button.click();
  assert.equal(offer.prompts, 1);
  assert.equal(t.row.hidden, true, "a prompt can be used only once");
  await t.button.click();
  assert.equal(offer.prompts, 1);
});

test("a refused or closed prompt does not break anything", async () => {
  const t = setup();
  const offer = installEvent();
  offer.prompt = async () => { throw new Error("dismissed"); };
  t.win.dispatch("beforeinstallprompt", offer);
  await assert.doesNotReject(t.button.click());
});

test("installing from the browser's own menu removes the row", () => {
  const t = setup();
  t.win.dispatch("beforeinstallprompt", installEvent());
  assert.equal(t.row.hidden, false);
  t.win.dispatch("appinstalled");
  assert.equal(t.row.hidden, true);
});

test("on iPhone a prompt that never comes leaves the steps showing", () => {
  const t = setup({ userAgent: IPHONE });
  t.win.dispatch("appinstalled");
  assert.equal(t.steps.hidden, false);
});

test("the row is worded in every language", () => {
  for (const [language, copy] of Object.entries(TRANSLATIONS)) {
    for (const key of ["installApp", "installBtn", "installIos"]) assert.ok(copy[key] && copy[key].length > 1, `${language} ${key}`);
  }
});

/* ---------- The manifest and the page ---------- */

test("the manifest has what a phone needs to install the game and open it full screen", async () => {
  const manifest = JSON.parse(await readFile(project("public/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "Garden Evolution");
  assert.ok(manifest.short_name.length <= 12, "a short name fits under an icon");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any", "the game works in both orientations");
  const icons = manifest.icons;
  assert.ok(icons.some(icon => icon.sizes === "192x192" && icon.purpose === "any"));
  assert.ok(icons.some(icon => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(icons.some(icon => icon.sizes === "512x512" && icon.purpose === "maskable"));
  for (const icon of icons) {
    const png = await readFile(project(`public${icon.src}`));
    assert.deepEqual([...png.subarray(1, 4)], [80, 78, 71], `${icon.src} is a PNG`);
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(`${width}x${height}`, icon.sizes, icon.src);
  }
  const html = await readFile(project("index.html"), "utf8");
  assert.match(html, /<meta name="theme-color" content="#eaf3df"/);
  assert.ok(html.includes(`content="${manifest.theme_color}"`), "the page and the manifest agree on the colour");
});

test("iPhone reads its own tags, and the icon it uses is a plain 180 px picture", async () => {
  const html = await readFile(project("index.html"), "utf8");
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Garden Evolution"/);
  const png = await readFile(project("public/icons/apple-touch-icon.png"));
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, "180x180");
  assert.equal(png[25], 2, "colour type 2 (RGB): no transparent corners for iOS to fill with black");
});

test("the manifest and icons are served with sensible caching and the right type", async () => {
  const headers = (await readFile(project("public/_headers"), "utf8")).split("\r\n").join("\n");
  assert.ok(headers.includes("/icons/*\n  Cache-Control: public, max-age=604800"));
  assert.ok(headers.includes("/manifest.webmanifest\n  Cache-Control: public, max-age=86400\n  Content-Type: application/manifest+json"));
});

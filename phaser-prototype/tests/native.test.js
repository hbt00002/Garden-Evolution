import test from "node:test";
import assert from "node:assert/strict";
import { canVibrate, createHaptics, isNativeApp, onBackButton } from "../src/native.js";
import { API_BASE, apiUrl } from "../src/endpoint.js";

test("the website is not the app: no Capacitor, or Capacitor on the web", () => {
  assert.equal(isNativeApp({}), false);
  assert.equal(isNativeApp({ Capacitor: { isNativePlatform: () => false } }), false);
  assert.equal(isNativeApp({ Capacitor: { isNativePlatform: () => true } }), true);
  assert.equal(isNativeApp(undefined), false);
});

test("outside the app, vibration and the back button do nothing (and load no plugin)", async () => {
  const haptics = createHaptics({ enabled: () => true, native: false });
  for (const buzz of ["merge", "world", "end"]) assert.doesNotThrow(() => haptics[buzz]());
  assert.equal(await onBackButton(() => true, false), undefined);
});

test("the website talks to its own server by relative paths", () => {
  assert.equal(API_BASE, "");
  assert.equal(apiUrl("/api/session"), "/api/session");
});

/* ---------- Vibration in a phone's browser ---------- */

const coarse = matches => () => ({ matches });

test("only a touch-screen browser that has navigator.vibrate counts as able to vibrate", () => {
  const vibrate = () => true;
  assert.equal(canVibrate({ vibrate }, coarse(true)), true, "Android Chrome");
  assert.equal(canVibrate({ vibrate }, coarse(false)), false, "desktop Chrome has the function but nothing to buzz");
  assert.equal(canVibrate({}, coarse(true)), false, "iPhone browsers have no navigator.vibrate");
  assert.equal(canVibrate(undefined, coarse(true)), false);
});

test("in a phone's browser each moment has its own buzz, and the Settings switch stops them", () => {
  const buzzes = [];
  let on = true;
  const haptics = createHaptics({ enabled: () => on, native: false, vibrate: pattern => buzzes.push(pattern) });
  haptics.merge();
  haptics.world();
  haptics.end();
  assert.equal(buzzes.length, 3);
  assert.ok(buzzes.every(pattern => pattern !== undefined));
  assert.notDeepEqual(buzzes[0], buzzes[1], "a new world feels different from a merge");
  on = false;
  haptics.merge();
  assert.equal(buzzes.length, 3);
});

test("a browser that refuses to vibrate does not break the game", () => {
  const haptics = createHaptics({ enabled: () => true, native: false, vibrate: () => { throw new Error("blocked"); } });
  assert.doesNotThrow(() => haptics.merge());
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHaptics, isNativeApp, onBackButton } from "../src/native.js";
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

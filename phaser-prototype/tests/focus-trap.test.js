import test from "node:test";
import assert from "node:assert/strict";
import { nextFocus } from "../src/focus-trap.js";

const [close, name, submit] = ["close", "name", "submit"];
const items = [close, name, submit];

test("Tab from the last control wraps to the first", () => {
  assert.equal(nextFocus(items, submit, false), close);
});

test("Shift+Tab from the first control wraps to the last", () => {
  assert.equal(nextFocus(items, close, true), submit);
});

test("Tab inside the dialog is left to the browser", () => {
  assert.equal(nextFocus(items, name, false), null);
  assert.equal(nextFocus(items, name, true), null);
});

test("focus that is outside the dialog is pulled back in", () => {
  assert.equal(nextFocus(items, "page-link", false), close);
  assert.equal(nextFocus(items, "page-link", true), submit);
});

test("a dialog with nothing focusable has no target", () => {
  assert.equal(nextFocus([], null, false), null);
});

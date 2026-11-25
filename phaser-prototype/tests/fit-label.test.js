import test from "node:test";
import assert from "node:assert/strict";
import { fitLabels } from "../src/fit-label.js";

// A button whose text is `chars` characters, each 0.6 of the font size wide.
function button(chars, width, cssSize = 20) {
  const b = {
    clientWidth: width,
    style: { fontSize: "", removeProperty(name) { if (name === "font-size") this.fontSize = ""; } },
    get scrollWidth() { const size = parseFloat(this.style.fontSize) || cssSize; return Math.max(this.clientWidth, Math.ceil(chars * size * .6)); }
  };
  return b;
}
globalThis.getComputedStyle = el => ({ fontSize: `${parseFloat(el.style.fontSize) || 20}px` });

test("a label that fits keeps its own size", () => {
  const b = button(8, 200);
  fitLabels([b]);
  assert.equal(b.style.fontSize, "");
});

test("a label that is too long shrinks a pixel at a time until it fits", () => {
  const b = button(13, 130);
  fitLabels([b]);
  assert.equal(b.style.fontSize, "16px");
  assert.ok(b.scrollWidth <= b.clientWidth);
});

test("it never shrinks below the smallest size, and starts afresh each time", () => {
  const b = button(40, 100);
  fitLabels([b], { min: 12 });
  assert.equal(b.style.fontSize, "12px");
  b.clientWidth = 600;
  fitLabels([b]);
  assert.equal(b.style.fontSize, "", "room again: back to the stylesheet's size");
});

import test from "node:test";
import assert from "node:assert/strict";
import { STAGE_PARTICLES, STAGE_SVG, createFallbackScenery } from "../src/scenery-fallback.js";

test("there is one painted scene and one kind of particle for each of the five worlds", () => {
  assert.equal(STAGE_SVG.length, 5);
  assert.equal(STAGE_PARTICLES.length, 5);
  assert.deepEqual(STAGE_PARTICLES.map(p => p.type), ["snow", "leaf", "pollen", "petal", "firefly"]);
  for (const [index, svg] of STAGE_SVG.entries()) {
    assert.ok(svg.length > 500, `scene ${index + 1} has content`);
    // Balanced tags: a stray one would break everything after it in the page.
    for (const tag of ["g", "defs", "linearGradient", "radialGradient"]) {
      const opened = (svg.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
      const closed = (svg.match(new RegExp(`</${tag}>`, "g")) || []).length;
      assert.equal(opened, closed, `scene ${index + 1}: <${tag}>`);
    }
  }
});

test("ids in a scene's gradients are unique and each reference points at one", () => {
  for (const [index, svg] of STAGE_SVG.entries()) {
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `scene ${index + 1} repeats an id`);
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), `scene ${index + 1} refers to missing #${ref}`);
  }
});

/* ---------- Putting it on the page ---------- */

function fakeElement() {
  return {
    children: [], innerHTML: "", attributes: new Set(), style: { setProperty() {} },
    classList: { add() {}, contains: () => false },
    hasAttribute(name) { return this.attributes.has(name); },
    replaceChildren() { this.innerHTML = ""; },
    appendChild(child) { this.children.push(child); }
  };
}

function setup({ animate = true } = {}) {
  const created = [];
  globalThis.document = {
    body: { classList: { contains: () => false } },
    createElement: () => { const el = fakeElement(); el.className = ""; el.classList = { add: name => { el.className += ` ${name}`; }, contains: () => false }; created.push(el); return el; }
  };
  const env = fakeElement();
  const sky = fakeElement();
  const particles = fakeElement();
  const scenery = createFallbackScenery({ env, sky, particles, canAnimate: () => animate });
  return { env, sky, particles, scenery, created };
}

test("the scene for a world is drawn and replaced when the world changes", () => {
  const { sky, scenery } = setup();
  scenery.renderStage(1);
  assert.equal(sky.innerHTML, STAGE_SVG[0]);
  scenery.renderStage(5);
  assert.equal(sky.innerHTML, STAGE_SVG[4]);
});

test("while Phaser draws the world nothing is drawn here", () => {
  const { env, sky, particles, scenery } = setup();
  env.attributes.add("data-phaser-active");
  sky.innerHTML = "old";
  scenery.renderStage(2);
  assert.equal(sky.innerHTML, "");
  scenery.spawnParticles(2);
  assert.equal(particles.children.length, 0);
});

test("particles match the world, and stay away when motion or particles are off", () => {
  const { particles, scenery } = setup();
  scenery.spawnParticles(4);
  assert.equal(particles.children.length, STAGE_PARTICLES[3].count);
  assert.ok(particles.children.every(el => /env-particle petal/.test(el.className)));
  scenery.clearParticles();
  assert.equal(particles.innerHTML, "");

  const quiet = setup({ animate: false });
  quiet.scenery.spawnParticles(1);
  assert.equal(quiet.particles.children.length, 0);
});

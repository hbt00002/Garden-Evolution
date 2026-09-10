import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBloomFlow } from '../src/bloom-flow.js';

test('thinking preserves streak; each merging turn counts once', () => {
  const b = createBloomFlow();
  assert.equal(b.move(3, 0).streak, 1);
  assert.equal(b.level(10000), 0);
  assert.equal(b.move(1, 10000).streak, 2);
  assert.equal(b.move(0, 10100).streak, 0);
  assert.equal(b.move(1, 10200).best, 2);
});
test('flow decays smoothly, stays bounded and releases without clearing streak', () => {
  const b = createBloomFlow();
  for (let i=0;i<100;i++) b.move(3, i);
  assert.equal(b.level(1299), 8);
  assert.equal(b.level(2299), 4);
  assert.equal(b.level(3299), 0);
  b.cool();
  assert.equal(b.level(0), 0);
  assert.equal(b.move(1, 4000).streak, 101);
  b.reset();
  assert.deepEqual(b.move(0, 5000), { streak:0, best:0, flow:0 });
});

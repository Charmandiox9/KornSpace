import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMascotTimeline, mascotCycleSeconds } from '../.test-dist/lib/mascot-timeline.js';

test('the mascot forms, performs, disperses and repeats for multiple complete cycles', () => {
  for (let cycle = 0; cycle < 4; cycle += 1) {
    const start = cycle * mascotCycleSeconds;
    assert.deepEqual(getMascotTimeline(start), { phase: 'assembling', cycle, dispersion: 1, action: 0 });
    assert.equal(getMascotTimeline(start + 1).phase, 'assembling');
    assert.equal(getMascotTimeline(start + 3).dispersion, 0);
    assert.equal(getMascotTimeline(start + 6).phase, 'performing');
    assert.equal(getMascotTimeline(start + 11).phase, 'dispersing');
    assert.ok(getMascotTimeline(start + 11).dispersion > 0);
  }
});

test('assembly boundaries remain continuous and progress stays within bounds', () => {
  for (const boundary of [2.4, 9.6, mascotCycleSeconds]) {
    const before = getMascotTimeline(boundary - 0.000001);
    const after = getMascotTimeline(boundary);
    assert.ok(Math.abs(before.dispersion - after.dispersion) < 0.00001);
  }
  assert.deepEqual(getMascotTimeline(-1), getMascotTimeline(0));
  for (let time = 0; time < 36; time += 0.025) {
    const state = getMascotTimeline(time);
    assert.ok(state.dispersion >= 0 && state.dispersion <= 1);
    assert.ok(state.action >= 0 && state.action <= 1);
  }
});

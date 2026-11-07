import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMascotTimeline, mascotCycleSeconds } from '../.test-dist/lib/mascot-timeline.js';

test('the mascot forms, performs, disperses and repeats for multiple complete cycles', () => {
  for (let cycle = 0; cycle < 4; cycle += 1) {
    const start = cycle * mascotCycleSeconds;
    assert.deepEqual(getMascotTimeline(start), { phase: 'assembling', cycle, dispersion: 1, action: 0, doorOpen: 0, travel: 0, carrying: true, stored: false });
    assert.equal(getMascotTimeline(start + 1).phase, 'assembling');
    assert.equal(getMascotTimeline(start + 3).dispersion, 0);
    assert.equal(getMascotTimeline(start + 4).phase, 'performing');
    assert.equal(getMascotTimeline(start + 6).phase, 'opening');
    assert.equal(getMascotTimeline(start + 8).phase, 'entering');
    assert.equal(getMascotTimeline(start + 13).phase, 'secured');
    assert.equal(getMascotTimeline(start + 17).phase, 'returning');
    assert.equal(getMascotTimeline(start + 21).phase, 'dispersing');
    assert.ok(getMascotTimeline(start + 21).dispersion > 0);
  }
});

test('assembly boundaries remain continuous and progress stays within bounds', () => {
  for (const boundary of [2.4, 5, 7, 11.5, 14.5, 19, mascotCycleSeconds]) {
    const before = getMascotTimeline(boundary - 0.000001);
    const after = getMascotTimeline(boundary);
    assert.ok(Math.abs(before.dispersion - after.dispersion) < 0.00001);
    assert.ok(Math.abs(before.doorOpen - after.doorOpen) < 0.00001);
    assert.ok(Math.abs(before.travel - after.travel) < 0.00001);
  }
  assert.deepEqual(getMascotTimeline(-1), getMascotTimeline(0));
  for (let time = 0; time < 36; time += 0.025) {
    const state = getMascotTimeline(time);
    assert.ok(state.dispersion >= 0 && state.dispersion <= 1);
    assert.ok(state.action >= 0 && state.action <= 1);
    assert.ok(state.doorOpen >= 0 && state.doorOpen <= 1);
    assert.ok(state.travel >= 0 && state.travel <= 1);
    if (state.travel > 0 && state.travel < 1) assert.equal(state.doorOpen, 1, 'the rooster walks through a fully open door');
  }
});

test('the rooster delivers its folder before returning empty-handed and resets cargo for a new cycle', () => {
  assert.equal(getMascotTimeline(9).carrying, true);
  for (const time of [11.5, 13, 16, 18, 21]) {
    assert.equal(getMascotTimeline(time).carrying, false);
    assert.equal(getMascotTimeline(time).stored, true);
  }
  assert.equal(getMascotTimeline(mascotCycleSeconds).carrying, true);
  assert.equal(getMascotTimeline(mascotCycleSeconds).stored, false);
});

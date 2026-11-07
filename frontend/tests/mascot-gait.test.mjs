import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRoosterGait, roosterLeg } from '../.test-dist/lib/mascot-gait.js';

test('joint angles reach both foot targets throughout the gait without stretching the leg bones', () => {
  for (let distance = 0; distance < 1.2; distance += 0.003) {
    const gait = getRoosterGait(distance, 1);
    for (const foot of [gait.left, gait.right]) {
      const y = roosterLeg.hipY - roosterLeg.upper * Math.cos(foot.hip) - roosterLeg.lower * Math.cos(foot.hip + foot.knee);
      const z = 0.02 - roosterLeg.upper * Math.sin(foot.hip) - roosterLeg.lower * Math.sin(foot.hip + foot.knee);
      assert.ok(Math.abs(y - foot.targetY) < 0.00001);
      assert.ok(Math.abs(z - foot.targetZ) < 0.00001);
    }
    assert.ok(gait.left.lift < 0.00001 || gait.right.lift < 0.00001, 'at least one foot remains planted');
  }
});

test('stopping returns to a stable stance and repeated distance produces the same step', () => {
  const resting = getRoosterGait(0, 0);
  assert.deepEqual(getRoosterGait(0.37, 0), resting);
  assert.deepEqual(getRoosterGait(0.24, 1), getRoosterGait(0.24, 1));
  assert.ok(getRoosterGait(0.48, 1).left.lift > 0);
  assert.equal(resting.bodyLift, 0);
});

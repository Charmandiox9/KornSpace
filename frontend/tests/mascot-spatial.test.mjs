import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMascotPose, vaultLayout } from '../.test-dist/lib/mascot-spatial.js';

test('the entire entry and return route clears the doorway, storage bay and back wall', () => {
  const doorway = vaultLayout.z + vaultLayout.front;
  const storageFront = vaultLayout.z + vaultLayout.storageFront;
  for (let step = 0; step <= 400; step += 1) {
    const pose = getMascotPose(step / 400);
    // Conservative horizontal bounds include body, wings, folder and the shorter tail.
    const halfWidth = 1.1 * pose.scale;
    const halfDepth = 1.1 * pose.scale;
    if (pose.z - halfDepth < doorway) {
      assert.ok(pose.x - halfWidth > vaultLayout.x + vaultLayout.innerLeft, `left jamb at step ${step}`);
      assert.ok(pose.x + halfWidth < vaultLayout.x + vaultLayout.innerRight, `right jamb at step ${step}`);
      assert.ok(pose.z - halfDepth > vaultLayout.z + vaultLayout.back + 0.075, `back wall at step ${step}`);
    }
    if (pose.z - halfDepth < storageFront) {
      assert.ok(pose.x + halfWidth < vaultLayout.x + vaultLayout.storageLeft, `storage collision at step ${step}`);
    }
    assert.ok(Math.abs(pose.y - 1.25 * pose.scale - vaultLayout.floor) < 0.00001, 'feet follow the chamber floor');
  }
  assert.ok(vaultLayout.front - vaultLayout.back >= 2.5, 'the vault has a walkable chamber');
  assert.ok(getMascotPose(1).z + 1.1 * getMascotPose(1).scale < doorway, 'the complete figure fits behind the door');
});

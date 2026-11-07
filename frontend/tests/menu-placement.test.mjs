import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeActionMenu } from '../.test-dist/lib/menu-placement.js';
test('action menus choose space above or below and remain within mobile viewport edges', () => {
  const top = placeActionMenu({ left: 200, right: 236, top: 30, bottom: 66 }, 350, 240, 390, 844);
  assert.equal(top.direction, 'down'); assert.ok(top.top >= 66);
  const bottom = placeActionMenu({ left: 330, right: 366, top: 790, bottom: 826 }, 350, 240, 390, 844);
  assert.equal(bottom.direction, 'up'); assert.ok(bottom.top + bottom.maxHeight < 790);
  const large = placeActionMenu({ left: 0, right: 36, top: 300, bottom: 336 }, 900, 240, 320, 600);
  assert.ok(large.left >= 12 && large.left + 240 <= 308);
  assert.ok(large.top >= 12 && large.top + large.maxHeight <= 588);
});

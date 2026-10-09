import test from 'node:test';
import assert from 'node:assert/strict';
import { BUTTONS, HOLD_MS, padDirection, padAim, createPadReader } from './gamepad.js';

const pad = (pressed = [], axes = [0, 0]) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) });

test('d-pad and left stick map to maze directions with a dead zone', () => {
  assert.equal(padDirection(pad([BUTTONS.right])), 0); assert.equal(padDirection(pad([BUTTONS.down])), 1);
  assert.equal(padDirection(pad([BUTTONS.left])), 2); assert.equal(padDirection(pad([BUTTONS.up])), 3);
  assert.equal(padDirection(pad([], [.3, -.2])), -1);
  assert.equal(padDirection(pad([], [-.9, .4])), 2); assert.equal(padDirection(pad([], [.2, -.8])), 3);
});
test('buttons fire once per press and held directions repeat after a delay', () => {
  const read = createPadReader();
  assert.deepEqual([...read(pad([BUTTONS.cross]), 0).pressed], ['cross']);
  assert.equal(read(pad([BUTTONS.cross]), 16).pressed.size, 0);
  assert.equal(read(pad([BUTTONS.right]), 32).step, 0);
  assert.equal(read(pad([BUTTONS.right]), 100).step, -1);
  assert.equal(read(pad([BUTTONS.right]), 320).step, 0);
  assert.equal(read(pad([BUTTONS.right]), 350).dir, 0);
  assert.equal(read(null, 400).dir, -1);
});
test('× and ○ separate a tap from a hold', () => {
  const read = createPadReader();
  read(pad([BUTTONS.cross]), 0);
  assert.equal(read(pad([]), 200).tapped.has('cross'), true);
  read(pad([BUTTONS.circle]), 300);
  assert.ok(read(pad([BUTTONS.circle]), 300 + HOLD_MS / 2).hold.circle > .4);
  assert.equal(read(pad([BUTTONS.circle]), 300 + HOLD_MS).long.has('circle'), true);
  assert.equal(read(pad([BUTTONS.circle]), 400 + HOLD_MS).long.size, 0);
  assert.equal(read(pad([]), 500 + HOLD_MS).tapped.size, 0);   // a completed hold is not also a tap
  read(pad([BUTTONS.cross]), 2000); read.consume();
  assert.equal(read(pad([]), 2100).tapped.size, 0);              // consumed when the screen changed
});
test('right stick aims the wall once per new direction and ignores the left stick', () => {
  assert.equal(padAim(pad([], [0, 0, .9, .1])), 0); assert.equal(padAim(pad([], [0, 0, 0, -.8])), 3); assert.equal(padAim(pad([], [1, 0, .2, .2])), -1);
  const read = createPadReader();
  assert.equal(read(pad([], [0, 0, -1, 0]), 0).aim, 2);
  assert.equal(read(pad([], [0, 0, -1, 0]), 16).aim, -1);
  assert.equal(read(pad([], [0, 0, 0, 0]), 32).aim, -1);
  assert.equal(read(pad([], [0, 0, 0, 1]), 48).aim, 1);
});
